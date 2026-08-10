import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  effect,
  input,
  output,
  viewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import * as pdfjsLib from 'pdfjs-dist';
import { configurePdfJsWorker } from '../../utils/pdfjs-setup';
import { FullscreenLearningToolbarComponent } from '../fullscreen-learning-toolbar/fullscreen-learning-toolbar.component';

type FitMode = 'width' | 'page' | 'custom';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [
    Button,
    InputText,
    FormsModule,
    Tooltip,
    FullscreenLearningToolbarComponent,
  ],
  template: `
    <div class="pdf-shell" #shell [class.is-fullscreen]="isFullscreen()">
      <app-fullscreen-learning-toolbar
        #fsToolbar
        [active]="isFullscreen()"
        mode="pdf"
        [pageLabel]="learningPageLabel()"
        [timerLabel]="learningTimerLabel()"
        [paused]="learningPaused()"
        [complete]="learningComplete()"
        [zoomPercent]="zoomPercent()"
        (exitFullscreen)="exitFullscreen()"
        (toggleFullscreen)="toggleFullscreen()"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (search)="runSearch($event)"
      />

      <div class="toolbar" [class.is-hidden-fs]="isFullscreen()">
        <div class="toolbar-group">
          <p-button
            icon="pi pi-chevron-left"
            [text]="true"
            size="small"
            [disabled]="page() <= minPage()"
            (onClick)="prev()"
            ariaLabel="Previous page"
          />
          <span class="page-label">{{ pageLabel() }}</span>
          <p-button
            icon="pi pi-chevron-right"
            [text]="true"
            size="small"
            [disabled]="!canAdvance()"
            (onClick)="next()"
            [pTooltip]="forwardLockTooltip()"
            tooltipPosition="top"
            ariaLabel="Next page"
          />
        </div>

        <div class="toolbar-group">
          <p-button
            label="Fit width"
            [text]="true"
            size="small"
            [styleClass]="fitMode() === 'width' ? 'pdf-fit-active' : ''"
            (onClick)="setFit('width')"
          />
          <p-button
            label="Fit page"
            [text]="true"
            size="small"
            [styleClass]="fitMode() === 'page' ? 'pdf-fit-active' : ''"
            (onClick)="setFit('page')"
          />
          <p-button
            icon="pi pi-minus"
            [text]="true"
            size="small"
            (onClick)="zoomOut()"
            ariaLabel="Zoom out"
          />
          <span class="zoom-label">{{ zoomPercent() }}%</span>
          <p-button
            icon="pi pi-plus"
            [text]="true"
            size="small"
            (onClick)="zoomIn()"
            ariaLabel="Zoom in"
          />
          <p-button
            icon="pi pi-replay"
            [text]="true"
            size="small"
            (onClick)="rotate()"
            ariaLabel="Rotate"
          />
        </div>

        @if (chrome() === 'full') {
          <div class="toolbar-group">
            <p-button
              [icon]="isFullscreen() ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
              [text]="true"
              size="small"
              (onClick)="toggleFullscreen()"
              ariaLabel="Fullscreen"
            />
          </div>
          <div class="toolbar-group search">
            <input
              #searchInput
              pInputText
              type="search"
              placeholder="Search…"
              [(ngModel)]="searchQuery"
              (keydown.enter)="searchNext()"
              aria-label="Search in document"
            />
            <p-button
              icon="pi pi-search"
              [text]="true"
              size="small"
              (onClick)="searchNext()"
              ariaLabel="Find next"
            />
          </div>
        }
      </div>

      <div
        class="viewport"
        #viewport
        (scroll)="onScroll($event)"
        (wheel)="onWheel($event)"
      >
        <div class="pdf-page">
          <canvas #canvas></canvas>
          <div class="pdf-watermark" aria-hidden="true">Zebl India LMS</div>
        </div>
      </div>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }
      @if (searchStatus()) {
        <div class="search-status">{{ searchStatus() }}</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
      .pdf-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: #eef2f7;
        position: relative;
      }
      .pdf-shell.is-fullscreen {
        background: #eef2f7;
      }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 4px 8px;
        min-height: 36px;
        padding: 2px 8px;
        background: var(--ctp-surface);
        border-bottom: 1px solid var(--ctp-border);
        font-size: 12px;
        color: var(--ctp-muted);
        flex-shrink: 0;
      }
      .toolbar.is-hidden-fs {
        display: none;
      }
      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .toolbar-group.search input {
        width: 140px;
        min-height: 28px !important;
        height: 28px;
        padding: 0 8px !important;
        font-size: 12px !important;
      }
      :host ::ng-deep .pdf-fit-active {
        color: var(--ctp-primary) !important;
        font-weight: 600 !important;
      }
      .page-label,
      .zoom-label {
        min-width: 3.5rem;
        text-align: center;
        font-variant-numeric: tabular-nums;
        font-size: 12px;
        color: var(--ctp-ink);
      }
      .viewport {
        flex: 1;
        overflow: auto;
        min-height: 0;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 8px;
      }
      /* Positioning wrapper only — must not size-contain or clip the canvas.
         container-type:inline-size + overflow:hidden collapsed this box to 0×? and hid the PDF. */
      .pdf-page {
        position: relative;
      }
      canvas {
        display: block;
        box-shadow: var(--ctp-shadow);
        background: #fff;
        max-width: none;
      }
      .pdf-watermark {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(-20deg);
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        z-index: 1;
        color: #64748b;
        opacity: 0.12;
        font-size: 16px;
        font-weight: 500;
        letter-spacing: 0.02em;
        white-space: nowrap;
        line-height: 1.2;
      }
      .error,
      .search-status {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 12px;
        padding: 6px 10px;
        border-radius: var(--ctp-radius);
        font-size: 12px;
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        box-shadow: var(--ctp-shadow);
        z-index: 2;
      }
      .error {
        color: var(--ctp-danger);
      }
      .search-status {
        color: var(--ctp-muted);
      }
    `,
  ],
})
export class PdfViewerComponent implements OnChanges, OnDestroy {
  readonly src = input.required<string>();
  readonly initialPage = input(1);
  /** Chapter bound — absolute PDF page numbers (1-based). */
  readonly pageStart = input<number | null>(null);
  readonly pageEnd = input<number | null>(null);
  /** full = include search/fullscreen; minimal = page/zoom only (parent owns chrome). */
  readonly chrome = input<'full' | 'minimal'>('full');
  /** When true, forward navigation (next / search ahead / wheel) is blocked. */
  readonly forwardLocked = input(false);
  readonly lockTooltip = input(
    'You must spend 1 minute on this page before continuing.',
  );

  /** Learning timer overlay (fullscreen) — driven by parent engine; never reset here. */
  readonly learningPageLabel = input<string | null>(null);
  readonly learningTimerLabel = input('00:00');
  readonly learningPaused = input(false);
  readonly learningComplete = input(false);

  readonly pageChange = output<{
    currentPage: number;
    totalPages: number;
    visitedPages: number[];
  }>();
  readonly scrollChange = output<number>();
  readonly pageLoaded = output<{
    currentPage: number;
    totalPages: number;
  }>();
  readonly navigateBlocked = output<{ targetPage: number; reason: string }>();
  readonly fullscreenChange = output<boolean>();

  readonly shell = viewChild.required<ElementRef<HTMLElement>>('shell');
  readonly viewportEl = viewChild.required<ElementRef<HTMLElement>>('viewport');
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  readonly fsToolbar =
    viewChild<FullscreenLearningToolbarComponent>('fsToolbar');

  readonly page = signal(1);
  readonly totalPages = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly fitMode = signal<FitMode>('width');
  readonly zoomPercent = signal(100);
  readonly rotation = signal(0);
  readonly isFullscreen = signal(false);
  readonly searchStatus = signal<string | null>(null);

  searchQuery = '';

  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private visited = new Set<number>();
  private renderTask: pdfjsLib.RenderTask | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private renderSeq = 0;
  private customScale = 1;
  private searchMatches: number[] = [];
  private searchIndex = -1;
  private searchQueryUsed = '';
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeRaf: number | null = null;
  private lastRenderKey = '';

  constructor() {
    effect(() => {
      if (this.isFullscreen()) {
        queueMicrotask(() => this.fsToolbar()?.onFullscreenEntered());
      }
    });
  }

  minPage(): number {
    return Math.max(1, this.pageStart() || 1);
  }

  maxPage(): number {
    const total = this.totalPages() || 1;
    const end = this.pageEnd();
    return end ? Math.min(total, end) : total;
  }

  pageLabel(): string {
    const total = this.displayTotal();
    if (!total) return '…';
    const relative = this.page() - this.minPage() + 1;
    return `${relative} / ${total}`;
  }

  displayTotal(): number | null {
    if (!this.totalPages()) return null;
    return this.maxPage() - this.minPage() + 1;
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['src'] && this.src()) {
      await this.load(this.src());
    } else if (changes['pageStart'] || changes['initialPage'] || changes['pageEnd']) {
      if (this.pdfDoc) {
        const start = Math.min(
          Math.max(this.minPage(), this.initialPage() || this.minPage()),
          this.maxPage(),
        );
        await this.goTo(start);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (this.resizeRaf != null) cancelAnimationFrame(this.resizeRaf);
    this.renderTask?.cancel();
    void this.pdfDoc?.destroy();
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleRerender();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    const shell = this.shell()?.nativeElement;
    const active = !!shell && document.fullscreenElement === shell;
    this.isFullscreen.set(active);
    this.fullscreenChange.emit(active);
    if (active) {
      queueMicrotask(() => this.fsToolbar()?.onFullscreenEntered());
    }
    void this.rerender();
  }

  async prev(): Promise<void> {
    if (this.page() <= this.minPage()) return;
    await this.goTo(this.page() - 1);
  }

  async next(): Promise<void> {
    if (!this.canAdvance()) return;
    await this.goTo(this.page() + 1);
  }

  canPrevPage(): boolean {
    return this.page() > this.minPage();
  }

  canNextPage(): boolean {
    return this.canAdvance();
  }

  canAdvance(): boolean {
    return (
      !!this.totalPages() &&
      this.page() < this.maxPage() &&
      !this.forwardLocked()
    );
  }

  forwardLockTooltip(): string | undefined {
    if (!this.forwardLocked() || this.page() >= this.maxPage()) return undefined;
    return this.lockTooltip();
  }

  async runSearch(query: string): Promise<void> {
    this.searchQuery = query;
    await this.searchNext();
  }

  focusSearch(): void {
    this.searchInput()?.nativeElement?.focus();
  }

  setFit(mode: 'width' | 'page'): void {
    this.fitMode.set(mode);
    void this.rerender();
  }

  zoomIn(): void {
    this.bumpZoom(1.15);
  }

  zoomOut(): void {
    this.bumpZoom(1 / 1.15);
  }

  rotate(): void {
    this.rotation.update((r) => (r + 90) % 360);
    void this.rerender();
  }

  async toggleFullscreen(): Promise<void> {
    const el = this.shell().nativeElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await document.exitFullscreen();
        await el.requestFullscreen();
      }
    } catch {
      // Browser may reject fullscreen without a user gesture
    }
  }

  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }

  async searchNext(): Promise<void> {
    const q = this.searchQuery.trim();
    if (!q || !this.pdfDoc) return;

    if (q !== this.searchQueryUsed) {
      this.searchQueryUsed = q;
      this.searchMatches = await this.findPages(q);
      this.searchIndex = -1;
    }

    if (this.searchMatches.length === 0) {
      this.flashStatus('No matches found');
      return;
    }

    // Prefer matches on current/previous pages while forward is locked
    const candidates = this.forwardLocked()
      ? this.searchMatches.filter((p) => p <= this.page())
      : this.searchMatches;

    if (candidates.length === 0) {
      this.flashStatus('Finish the reading timer before jumping ahead');
      this.navigateBlocked.emit({
        targetPage: this.searchMatches[0]!,
        reason: 'forward_locked',
      });
      return;
    }

    this.searchIndex = (this.searchIndex + 1) % candidates.length;
    const pageNum = candidates[this.searchIndex]!;
    this.flashStatus(
      `Match ${this.searchIndex + 1} of ${candidates.length}`,
    );
    await this.goTo(pageNum);
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max <= 0 ? 100 : Math.round((el.scrollTop / max) * 100);
    this.scrollChange.emit(Math.min(100, Math.max(0, pct)));
  }

  onWheel(event: WheelEvent): void {
    // Block intentional page-flip gestures while locked (Ctrl+wheel zoom still ok)
    if (!this.forwardLocked()) return;
    if (event.ctrlKey || event.metaKey) return;
    const viewport = this.viewportEl().nativeElement;
    const atBottom =
      viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
    if (event.deltaY > 0 && atBottom) {
      event.preventDefault();
      this.navigateBlocked.emit({
        targetPage: this.page() + 1,
        reason: 'wheel_locked',
      });
    }
  }

  private bumpZoom(factor: number): void {
    const next = Math.min(4, Math.max(0.4, this.customScale * factor));
    this.customScale = next;
    this.fitMode.set('custom');
    this.zoomPercent.set(Math.round(next * 100));
    void this.rerender();
  }

  private ensureResizeObserver(): void {
    if (this.resizeObserver) return;
    const viewport = this.viewportEl()?.nativeElement;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.scheduleRerender());
    this.resizeObserver.observe(viewport);
  }

  private scheduleRerender(): void {
    if (this.resizeRaf != null) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      void this.rerender();
    });
  }

  private async load(url: string): Promise<void> {
    this.error.set(null);
    this.searchMatches = [];
    this.searchIndex = -1;
    this.searchQueryUsed = '';
    try {
      configurePdfJsWorker();
      await this.pdfDoc?.destroy();
      this.pdfDoc = await pdfjsLib.getDocument(url).promise;
      this.totalPages.set(this.pdfDoc.numPages);
      this.fitMode.set('width');
      this.rotation.set(0);
      this.ensureResizeObserver();
      const start = Math.min(
        Math.max(this.minPage(), this.initialPage() || this.minPage()),
        this.maxPage(),
      );
      await this.goTo(start);
    } catch {
      this.error.set('Unable to load PDF document');
    }
  }

  private async goTo(pageNumber: number): Promise<void> {
    if (!this.pdfDoc) return;
    const clamped = Math.min(Math.max(pageNumber, this.minPage()), this.maxPage());
    if (clamped > this.page() && this.forwardLocked()) {
      this.navigateBlocked.emit({ targetPage: clamped, reason: 'forward_locked' });
      return;
    }
    this.page.set(clamped);
    this.visited.add(clamped);
    await this.rerender();
    this.pageChange.emit({
      currentPage: clamped,
      totalPages: this.pdfDoc.numPages,
      visitedPages: [...this.visited],
    });
  }

  private async rerender(): Promise<void> {
    if (!this.pdfDoc) return;
    const seq = ++this.renderSeq;
    const pageNum = this.page();
    const page = await this.pdfDoc.getPage(pageNum);
    if (seq !== this.renderSeq) return;

    const rotation = this.rotation();
    const base = page.getViewport({ scale: 1, rotation });
    const viewportBox = this.viewportEl().nativeElement;
    const pad = 16;
    const availW = Math.max(120, viewportBox.clientWidth - pad);
    const availH = Math.max(120, viewportBox.clientHeight - pad);

    let scale: number;
    const mode = this.fitMode();
    if (mode === 'width') {
      scale = availW / base.width;
    } else if (mode === 'page') {
      scale = Math.min(availW / base.width, availH / base.height);
    } else {
      scale = this.customScale;
    }

    scale = Math.min(4, Math.max(0.25, scale));
    if (mode !== 'custom') {
      this.customScale = scale;
      this.zoomPercent.set(Math.round(scale * 100));
    }

    const renderKey = `${pageNum}|${mode}|${rotation}|${scale.toFixed(3)}|${availW}x${availH}`;
    if (renderKey === this.lastRenderKey) {
      this.pageLoaded.emit({
        currentPage: pageNum,
        totalPages: this.pdfDoc.numPages,
      });
      return;
    }
    this.lastRenderKey = renderKey;

    const viewport = page.getViewport({ scale, rotation });
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.renderTask?.cancel();
    this.renderTask = page.render({ canvasContext: context, viewport });
    try {
      await this.renderTask.promise;
      if (seq !== this.renderSeq) return;
      this.pageLoaded.emit({
        currentPage: pageNum,
        totalPages: this.pdfDoc.numPages,
      });
    } catch {
      // cancelled
    }
  }

  private async findPages(query: string): Promise<number[]> {
    if (!this.pdfDoc) return [];
    const q = query.toLowerCase();
    const matches: number[] = [];
    const start = this.minPage();
    const end = this.maxPage();
    for (let i = start; i <= end; i += 1) {
      const page = await this.pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? String(item.str) : ''))
        .join(' ')
        .toLowerCase();
      if (text.includes(q)) matches.push(i);
    }
    return matches;
  }

  private flashStatus(message: string): void {
    this.searchStatus.set(message);
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.searchStatus.set(null), 2200);
  }
}
