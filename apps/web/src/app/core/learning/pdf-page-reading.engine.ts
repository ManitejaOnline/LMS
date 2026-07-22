import {
  Injectable,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  Subject,
  Subscription,
  fromEvent,
  merge,
  interval,
  filter,
  map,
} from 'rxjs';
import { LearningApiService } from '../http/learning-api.service';
import { LearningTrackerService } from './learning-tracker.service';
import { ContentProtectionService } from '../content-protection/content-protection.service';
import type { PageProgressDto } from '../models/domain.models';

const IDLE_MS = 30_000;
const TICK_MS = 1_000;
const AUTOSAVE_MS = 5_000;
const STORAGE_PREFIX = 'zebl.pdf.pageProgress.';

export type PageReadingSnapshot = {
  pageNumber: number;
  requiredSeconds: number;
  completedSeconds: number;
  remainingSeconds: number;
  completed: boolean;
};

/**
 * Compliance PDF page timer: only counts when page is loaded, visible,
 * tab active, window focused, and user is not idle.
 */
@Injectable()
export class PdfPageReadingEngine implements OnDestroy {
  private readonly api = inject(LearningApiService);
  private readonly tracker = inject(LearningTrackerService);
  private readonly protection = inject(ContentProtectionService, {
    optional: true,
  });

  readonly requiredSeconds = signal(60);
  readonly pageNumber = signal(1);
  readonly completedSeconds = signal(0);
  readonly pageLoaded = signal(false);
  readonly paused = signal(true);
  readonly completed = signal(false);
  readonly pauseCount = signal(0);
  readonly totalPausedSec = signal(0);
  readonly focusLostCount = signal(0);
  readonly tabSwitchCount = signal(0);
  readonly hiddenCount = signal(0);
  readonly idleCount = signal(0);

  readonly remainingSeconds = computed(() =>
    Math.max(0, this.requiredSeconds() - this.completedSeconds()),
  );

  readonly forwardUnlocked = computed(
    () => this.completed() || this.remainingSeconds() <= 0,
  );

  readonly timerLabel = computed(() => {
    const rem = this.remainingSeconds();
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  readonly progressPercent = computed(() => {
    const req = this.requiredSeconds();
    if (req <= 0) return 100;
    return Math.min(100, Math.round((this.completedSeconds() / req) * 100));
  });

  private assignmentId: string | null = null;
  private lessonId: string | null = null;
  private pageStart = 1;
  private pageEnd: number | null = null;
  private totalPages: number | null = null;
  private byPage = new Map<number, PageProgressDto>();

  private destroy$ = new Subject<void>();
  private hooksSub: Subscription | null = null;
  private tickSub: Subscription | null = null;
  private saveSub: Subscription | null = null;

  private tabHidden = false;
  private windowBlurred = false;
  private idle = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseStartedAt: number | null = null;

  private pendingActiveSec = 0;
  private pendingPauseCount = 0;
  private pendingPausedSec = 0;
  private pendingFocusLost = 0;
  private pendingTabSwitch = 0;
  private pendingHidden = 0;
  private pendingIdle = 0;
  private saving = false;

  constructor() {
    effect(() => {
      const blocked = this.protection?.forcePaused() ?? false;
      if (!this.assignmentId) return;
      if (blocked) {
        this.setPaused(true, 'PAGE_PAUSED');
      } else {
        this.recomputePause('PAGE_RESUMED');
      }
    });
  }

  bind(opts: {
    assignmentId: string;
    lessonId: string;
    pageStart: number;
    pageEnd: number | null;
    requiredSeconds?: number;
    pages?: PageProgressDto[];
  }): void {
    this.flushPending(true);
    this.teardownHooks();

    this.assignmentId = opts.assignmentId;
    this.lessonId = opts.lessonId;
    this.pageStart = opts.pageStart;
    this.pageEnd = opts.pageEnd;
    this.requiredSeconds.set(opts.requiredSeconds ?? 60);
    this.byPage = new Map((opts.pages ?? []).map((p) => [p.pageNumber, p]));
    this.pageLoaded.set(false);
    this.pendingActiveSec = 0;
    this.resetPendingCounters();
    this.tabHidden = document.hidden;
    this.windowBlurred = !document.hasFocus();
    this.idle = false;
    this.attachHooks();
    this.startLoops();
  }

  unbind(): void {
    this.flushPending(true);
    this.teardownHooks();
    this.assignmentId = null;
    this.lessonId = null;
  }

  ngOnDestroy(): void {
    this.unbind();
    this.destroy$.next();
    this.destroy$.complete();
  }

  hydrateFromServer(pages: PageProgressDto[], requiredSeconds?: number): void {
    if (requiredSeconds) this.requiredSeconds.set(requiredSeconds);
    this.byPage = new Map(pages.map((p) => [p.pageNumber, p]));
    this.applyPageState(this.pageNumber());
  }

  setTotalPages(total: number): void {
    this.totalPages = total;
  }

  /** Called when the PDF page canvas finished rendering. */
  onPageLoaded(pageNumber: number, totalPages: number): void {
    this.totalPages = totalPages;
    const prev = this.pageNumber();
    if (prev !== pageNumber) {
      this.flushPending(true);
      this.tracker.track('PAGE_CHANGED', this.lessonId ?? undefined, {
        from: prev,
        to: pageNumber,
      });
    }
    this.pageNumber.set(pageNumber);
    this.pageLoaded.set(true);
    this.applyPageState(pageNumber);
    this.recomputePause('PAGE_STARTED');
  }

  onPageUnload(): void {
    this.pageLoaded.set(false);
    this.setPaused(true, 'PAGE_PAUSED');
  }

  canNavigateTo(targetPage: number): boolean {
    if (targetPage <= this.pageNumber()) return true;
    if (targetPage === this.pageNumber() + 1) {
      return this.forwardUnlocked();
    }
    for (let p = this.pageStart; p < targetPage; p += 1) {
      if (p === this.pageNumber()) {
        if (!this.forwardUnlocked()) return false;
        continue;
      }
      if (!this.byPage.get(p)?.completed) return false;
    }
    return true;
  }

  resumePageHint(): number {
    const incomplete = [...this.byPage.values()]
      .filter((p) => !p.completed)
      .sort((a, b) => a.pageNumber - b.pageNumber)[0];
    return incomplete?.pageNumber ?? this.pageNumber();
  }

  private applyPageState(pageNumber: number): void {
    const local = this.readLocal(pageNumber);
    const server = this.byPage.get(pageNumber);
    const completedSeconds = Math.max(
      server?.completedSeconds ?? 0,
      local?.completedSeconds ?? 0,
    );
    const required =
      server?.requiredSeconds ?? this.requiredSeconds() ?? 60;
    this.requiredSeconds.set(required);
    this.completedSeconds.set(Math.min(required, completedSeconds));
    this.completed.set(
      !!server?.completed || completedSeconds >= required,
    );
    this.pauseCount.set(server?.pauseCount ?? 0);
    this.totalPausedSec.set(server?.totalPausedSec ?? 0);
    this.focusLostCount.set(server?.focusLostCount ?? 0);
    this.tabSwitchCount.set(server?.tabSwitchCount ?? 0);
    this.hiddenCount.set(server?.hiddenCount ?? 0);
    this.idleCount.set(server?.idleCount ?? 0);
  }

  private attachHooks(): void {
    const visibility$ = fromEvent(document, 'visibilitychange').pipe(
      map(() => document.hidden),
    );
    const blur$ = fromEvent(window, 'blur').pipe(map(() => true));
    const focus$ = fromEvent(window, 'focus').pipe(map(() => false));
    const activity$ = merge(
      fromEvent(window, 'mousemove'),
      fromEvent(window, 'keydown'),
      fromEvent(window, 'pointerdown'),
      fromEvent(window, 'scroll'),
    );

    this.hooksSub = new Subscription();

    this.hooksSub.add(
      visibility$.subscribe((hidden) => {
        const lessonId = this.lessonId ?? undefined;
        if (hidden) {
          this.tabHidden = true;
          this.pendingTabSwitch += 1;
          this.pendingHidden += 1;
          this.tabSwitchCount.update((n) => n + 1);
          this.hiddenCount.update((n) => n + 1);
          this.tracker.track('TAB_HIDDEN', lessonId);
          this.setPaused(true, 'PAGE_PAUSED');
        } else {
          this.tabHidden = false;
          this.tracker.track('TAB_VISIBLE', lessonId);
          this.tracker.track('RETURNED', lessonId, { reason: 'tab' });
          this.recomputePause('PAGE_RESUMED');
        }
      }),
    );

    this.hooksSub.add(
      blur$.subscribe(() => {
        this.windowBlurred = true;
        this.pendingFocusLost += 1;
        this.focusLostCount.update((n) => n + 1);
        this.tracker.track('WINDOW_BLUR', this.lessonId ?? undefined);
        this.setPaused(true, 'PAGE_PAUSED');
        this.armIdle();
      }),
    );

    this.hooksSub.add(
      focus$.subscribe(() => {
        this.windowBlurred = false;
        this.tracker.track('WINDOW_FOCUS', this.lessonId ?? undefined);
        this.tracker.track('RETURNED', this.lessonId ?? undefined, {
          reason: 'focus',
        });
        this.clearIdle(false);
        this.recomputePause('PAGE_RESUMED');
      }),
    );

    this.hooksSub.add(
      activity$.subscribe(() => {
        this.clearIdle(true);
        this.armIdle();
      }),
    );

    this.armIdle();
  }

  private startLoops(): void {
    this.tickSub?.unsubscribe();
    this.saveSub?.unsubscribe();

    this.tickSub = interval(TICK_MS).subscribe(() => this.onTick());

    this.saveSub = interval(AUTOSAVE_MS)
      .pipe(filter(() => !!this.assignmentId && !!this.lessonId))
      .subscribe(() => this.flushPending(false));
  }

  private onTick(): void {
    if (this.completed() || this.paused()) return;
    if (!this.canCountTime()) {
      this.setPaused(true, 'PAGE_PAUSED');
      return;
    }
    this.completedSeconds.update((s) =>
      Math.min(this.requiredSeconds(), s + 1),
    );
    this.pendingActiveSec += 1;
    this.writeLocal();

    if (this.remainingSeconds() <= 0) {
      this.completed.set(true);
      this.tracker.track('PAGE_COMPLETED', this.lessonId ?? undefined, {
        pageNumber: this.pageNumber(),
      });
      this.flushPending(true);
    }
  }

  private canCountTime(): boolean {
    return (
      this.pageLoaded() &&
      !this.tabHidden &&
      !document.hidden &&
      !this.windowBlurred &&
      document.hasFocus() &&
      !this.idle &&
      !this.completed() &&
      !this.protection?.forcePaused()
    );
  }

  private recomputePause(resumeEvent?: 'PAGE_RESUMED' | 'PAGE_STARTED'): void {
    if (this.canCountTime()) {
      this.setPaused(false, resumeEvent);
    } else {
      this.setPaused(true, 'PAGE_PAUSED');
    }
  }

  private setPaused(
    paused: boolean,
    event?: 'PAGE_PAUSED' | 'PAGE_RESUMED' | 'PAGE_STARTED',
  ): void {
    const was = this.paused();
    if (was === paused) return;
    this.paused.set(paused);
    if (paused) {
      this.pauseStartedAt = Date.now();
      this.pendingPauseCount += 1;
      this.pauseCount.update((n) => n + 1);
      if (event === 'PAGE_PAUSED') {
        this.tracker.track('PAGE_PAUSED', this.lessonId ?? undefined, {
          pageNumber: this.pageNumber(),
        });
      }
    } else {
      if (this.pauseStartedAt) {
        const sec = Math.round((Date.now() - this.pauseStartedAt) / 1000);
        this.pendingPausedSec += sec;
        this.totalPausedSec.update((n) => n + sec);
        this.pauseStartedAt = null;
      }
      if (event === 'PAGE_RESUMED' || event === 'PAGE_STARTED') {
        this.tracker.track(event, this.lessonId ?? undefined, {
          pageNumber: this.pageNumber(),
        });
      }
    }
  }

  private armIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.idle) return;
      this.idle = true;
      this.pendingIdle += 1;
      this.idleCount.update((n) => n + 1);
      this.tracker.track('IDLE', this.lessonId ?? undefined, {
        pageNumber: this.pageNumber(),
      });
      this.setPaused(true, 'PAGE_PAUSED');
    }, IDLE_MS);
  }

  private clearIdle(emitReturned: boolean): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.idle) {
      this.idle = false;
      if (emitReturned) {
        this.tracker.track('RETURNED', this.lessonId ?? undefined, {
          reason: 'activity',
        });
      }
      this.recomputePause('PAGE_RESUMED');
    }
  }

  private flushPending(force: boolean): void {
    if (!this.assignmentId || !this.lessonId) return;
    if (
      !force &&
      this.pendingActiveSec <= 0 &&
      this.pendingPauseCount <= 0 &&
      this.pendingFocusLost <= 0 &&
      this.pendingTabSwitch <= 0 &&
      this.pendingHidden <= 0 &&
      this.pendingIdle <= 0 &&
      this.pendingPausedSec <= 0
    ) {
      return;
    }
    if (this.saving && !force) return;

    const body = {
      pageNumber: this.pageNumber(),
      deltaSeconds: this.pendingActiveSec,
      pauseCountDelta: this.pendingPauseCount,
      pausedSecondsDelta: this.pendingPausedSec,
      focusLostDelta: this.pendingFocusLost,
      tabSwitchDelta: this.pendingTabSwitch,
      hiddenDelta: this.pendingHidden,
      idleDelta: this.pendingIdle,
      totalPages: this.totalPages ?? undefined,
    };

    this.pendingActiveSec = 0;
    this.resetPendingCounters();
    this.saving = true;

    this.api
      .savePageProgress(this.assignmentId, this.lessonId, body)
      .subscribe({
        next: (row) => {
          this.saving = false;
          this.byPage.set(row.pageNumber, row);
          if (row.pageNumber === this.pageNumber()) {
            this.completedSeconds.set(row.completedSeconds);
            this.completed.set(row.completed);
            this.requiredSeconds.set(row.requiredSeconds);
          }
          this.writeLocal();
          if (row.completed) {
            this.api
              .completePage(this.assignmentId!, this.lessonId!, row.pageNumber)
              .subscribe({ error: () => undefined });
          }
        },
        error: () => {
          this.saving = false;
          // re-credit failed delta into pending so next save retries
          this.pendingActiveSec += body.deltaSeconds;
          this.pendingPauseCount += body.pauseCountDelta;
          this.pendingPausedSec += body.pausedSecondsDelta;
          this.pendingFocusLost += body.focusLostDelta;
          this.pendingTabSwitch += body.tabSwitchDelta;
          this.pendingHidden += body.hiddenDelta;
          this.pendingIdle += body.idleDelta;
        },
      });
  }

  private resetPendingCounters(): void {
    this.pendingPauseCount = 0;
    this.pendingPausedSec = 0;
    this.pendingFocusLost = 0;
    this.pendingTabSwitch = 0;
    this.pendingHidden = 0;
    this.pendingIdle = 0;
  }

  private storageKey(pageNumber: number): string {
    return `${STORAGE_PREFIX}${this.assignmentId}.${this.lessonId}.${pageNumber}`;
  }

  private writeLocal(): void {
    if (!this.assignmentId || !this.lessonId) return;
    try {
      const snap: PageReadingSnapshot = {
        pageNumber: this.pageNumber(),
        requiredSeconds: this.requiredSeconds(),
        completedSeconds: this.completedSeconds(),
        remainingSeconds: this.remainingSeconds(),
        completed: this.completed(),
      };
      localStorage.setItem(
        this.storageKey(this.pageNumber()),
        JSON.stringify(snap),
      );
    } catch {
      /* ignore */
    }
  }

  private readLocal(pageNumber: number): PageReadingSnapshot | null {
    if (!this.assignmentId || !this.lessonId) return null;
    try {
      const raw = localStorage.getItem(this.storageKey(pageNumber));
      if (!raw) return null;
      return JSON.parse(raw) as PageReadingSnapshot;
    } catch {
      return null;
    }
  }

  private teardownHooks(): void {
    this.hooksSub?.unsubscribe();
    this.hooksSub = null;
    this.tickSub?.unsubscribe();
    this.tickSub = null;
    this.saveSub?.unsubscribe();
    this.saveSub = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
