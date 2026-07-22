import {
  Injectable,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { LearningTrackerService } from '../learning/learning-tracker.service';
import { environment } from '../../../environments/environment';
import type { LearningEventType } from '../models/domain.models';

export type ContentProtectionEvent =
  | 'RIGHT_CLICK_BLOCKED'
  | 'COPY_BLOCKED'
  | 'PRINT_BLOCKED'
  | 'SELECT_ALL_BLOCKED'
  | 'SAVE_BLOCKED'
  | 'SCREENSHOT_ATTEMPT'
  | 'DEVTOOLS_OPENED'
  | 'DEVTOOLS_CLOSED'
  | 'WINDOW_BLUR'
  | 'TAB_HIDDEN'
  | 'FULLSCREEN_EXIT';

export type WatermarkPayload = {
  employeeName: string;
  employeeId: string;
  companyName: string;
  timestampLabel: string;
};

/**
 * Best-effort content deterrence for the learning player.
 * Does not claim DRM-level screenshot/recording prevention.
 */
@Injectable({ providedIn: 'root' })
export class ContentProtectionService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly tracker = inject(LearningTrackerService);

  readonly active = signal(false);
  readonly blurred = signal(false);
  readonly forcePaused = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly watermarkClock = signal(Date.now());

  readonly watermark = computed((): WatermarkPayload => {
    const user = this.auth.currentUser();
    const now = new Date(this.watermarkClock());
    return {
      employeeName: this.auth.displayName(),
      employeeId: user?.employeeCode?.trim() || user?.id?.slice(0, 8) || 'N/A',
      companyName: environment.appName,
      timestampLabel: formatStamp(now),
    };
  });

  private lessonId: string | null = null;
  private hostEl: HTMLElement | null = null;
  private listeners: Array<() => void> = [];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private clockSub: Subscription | null = null;
  private devtoolsSub: Subscription | null = null;
  private lastDevtools = false;
  private focusPaused = false;

  enable(opts: { lessonId: string; host: HTMLElement }): void {
    this.disable();
    this.lessonId = opts.lessonId;
    this.hostEl = opts.host;
    this.active.set(true);
    this.blurred.set(false);
    this.forcePaused.set(false);
    this.attachDomGuards();
    this.startClock();
    this.startDevtoolsWatch();
    this.syncFocusState();
  }

  disable(): void {
    this.teardownListeners();
    this.clockSub?.unsubscribe();
    this.clockSub = null;
    this.devtoolsSub?.unsubscribe();
    this.devtoolsSub = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.active.set(false);
    this.blurred.set(false);
    this.forcePaused.set(false);
    this.toastMessage.set(null);
    this.lessonId = null;
    this.hostEl = null;
    this.focusPaused = false;
    this.lastDevtools = false;
  }

  ngOnDestroy(): void {
    this.disable();
  }

  notifyFullscreenExit(): void {
    if (!this.active()) return;
    this.log('FULLSCREEN_EXIT');
  }

  private attachDomGuards(): void {
    const host = this.hostEl;
    if (!host) return;

    const onContextMenu = (e: Event) => {
      if (!this.active()) return;
      e.preventDefault();
      e.stopPropagation();
      this.log('RIGHT_CLICK_BLOCKED');
      this.showToast('This action is disabled during training.');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.active()) return;
      if (this.handleScreenshotKey(e)) return;
      if (!this.isBlockedShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const eventType = this.mapShortcutEvent(e);
      this.log(eventType);
      this.showToast('This action is disabled during training.');
    };

    const onVisibility = () => {
      if (!this.active()) return;
      if (document.hidden) {
        this.log('TAB_HIDDEN');
        this.enterFocusPause();
      } else {
        this.exitFocusPause();
      }
    };

    const onBlur = () => {
      if (!this.active()) return;
      this.log('WINDOW_BLUR');
      this.enterFocusPause();
    };

    const onFocus = () => {
      if (!this.active()) return;
      this.exitFocusPause();
    };

    const onCopy = (e: ClipboardEvent) => {
      if (!this.active()) return;
      e.preventDefault();
      this.log('COPY_BLOCKED');
      this.showToast('This action is disabled during training.');
    };

    const onSelectStart = (e: Event) => {
      if (!this.active()) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    };

    const onDragStart = (e: Event) => {
      if (!this.active()) return;
      e.preventDefault();
    };

    host.addEventListener('contextmenu', onContextMenu, true);
    host.addEventListener('copy', onCopy, true);
    host.addEventListener('cut', onCopy, true);
    host.addEventListener('selectstart', onSelectStart, true);
    host.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    this.listeners = [
      () => host.removeEventListener('contextmenu', onContextMenu, true),
      () => host.removeEventListener('copy', onCopy, true),
      () => host.removeEventListener('cut', onCopy, true),
      () => host.removeEventListener('selectstart', onSelectStart, true),
      () => host.removeEventListener('dragstart', onDragStart, true),
      () => window.removeEventListener('keydown', onKeyDown, true),
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => window.removeEventListener('blur', onBlur),
      () => window.removeEventListener('focus', onFocus),
    ];
  }

  private handleScreenshotKey(e: KeyboardEvent): boolean {
    const key = e.key;
    const isPrintScreen =
      key === 'PrintScreen' ||
      key === 'PrtSc' ||
      e.code === 'PrintScreen';

    // Best-effort only — browsers rarely expose Win+PrtSc as a web event.
    if (!isPrintScreen) return false;

    e.preventDefault();
    this.log('SCREENSHOT_ATTEMPT');
    this.triggerScreenshotDeterrent();
    return true;
  }

  private triggerScreenshotDeterrent(): void {
    this.blurred.set(true);
    this.showToast('Screen capture is discouraged and has been logged.');
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      if (!this.forcePaused() && !this.focusPaused) {
        this.blurred.set(false);
      }
      this.blurTimer = null;
    }, 2000);
  }

  private isBlockedShortcut(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return false;
    const k = e.key.toLowerCase();
    return k === 'c' || k === 's' || k === 'p' || k === 'a';
  }

  private mapShortcutEvent(e: KeyboardEvent): ContentProtectionEvent {
    const k = e.key.toLowerCase();
    if (k === 'c') return 'COPY_BLOCKED';
    if (k === 's') return 'SAVE_BLOCKED';
    if (k === 'p') return 'PRINT_BLOCKED';
    return 'SELECT_ALL_BLOCKED';
  }

  private enterFocusPause(): void {
    this.focusPaused = true;
    this.blurred.set(true);
    this.recomputeForcePaused();
  }

  private exitFocusPause(): void {
    if (document.hidden || !document.hasFocus()) return;
    this.focusPaused = false;
    this.recomputeForcePaused();
    if (!this.forcePaused() && !this.blurTimer) {
      this.blurred.set(false);
    }
  }

  private syncFocusState(): void {
    if (document.hidden || !document.hasFocus()) {
      this.enterFocusPause();
    }
  }

  private startClock(): void {
    this.watermarkClock.set(Date.now());
    this.clockSub = interval(60_000).subscribe(() => {
      this.watermarkClock.set(Date.now());
    });
  }

  /**
   * Heuristic DevTools detection (threshold / size). Best-effort only.
   */
  private startDevtoolsWatch(): void {
    this.devtoolsSub = interval(1200).subscribe(() => {
      if (!this.active()) return;
      const open = this.detectDevtools();
      if (open === this.lastDevtools) return;
      this.lastDevtools = open;
      if (open) {
        this.log('DEVTOOLS_OPENED');
        this.showToast(
          'Developer tools are not allowed while viewing training content.',
        );
      } else {
        this.log('DEVTOOLS_CLOSED');
      }
      this.recomputeForcePaused();
    });
  }

  private detectDevtools(): boolean {
    const widthGap = Math.abs(window.outerWidth - window.innerWidth);
    const heightGap = Math.abs(window.outerHeight - window.innerHeight);
    // Docked DevTools usually creates a large chrome gap; keep threshold high
    // to reduce false positives on browser UI / scrollbars / mobile.
    return widthGap > 160 || heightGap > 160;
  }

  private recomputeForcePaused(): void {
    const blocked = this.lastDevtools || this.focusPaused;
    this.forcePaused.set(blocked);
    if (blocked) {
      this.blurred.set(true);
    } else if (!this.blurTimer) {
      this.blurred.set(false);
    }
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
      this.toastTimer = null;
    }, 2800);
  }

  private log(eventType: ContentProtectionEvent): void {
    const lessonId = this.lessonId ?? undefined;
    const user = this.auth.currentUser();
    this.tracker.track(eventType as LearningEventType, lessonId, {
      employeeId: user?.employeeCode || user?.id || null,
      lessonId: lessonId ?? null,
      timestamp: new Date().toISOString(),
      browser: navigator.userAgent,
      device: `${navigator.platform || 'unknown'} | ${window.innerWidth}x${window.innerHeight}`,
      note: 'deterrence-best-effort',
    });
  }

  private teardownListeners(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}

function formatStamp(d: Date): string {
  const day = d.getDate();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mon = months[d.getMonth()]!;
  const year = d.getFullYear();
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${mon} ${year} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
}
