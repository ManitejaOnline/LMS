import {
  Component,
  OnChanges,
  SimpleChanges,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import {
  type ChapterDraft,
  type PdfPageThumb,
  chapterCoveringPage,
  chapterPageCount,
  estimateReadingMinutes,
  newChapterClientId,
  pagesOverlapChapter,
  renderPdfPageThumbnails,
} from '../../utils/pdf-meta.util';

const CHAPTER_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#ca8a04',
];

@Component({
  selector: 'app-pdf-document-organizer',
  standalone: true,
  imports: [FormsModule, DragDropModule, Button, InputText],
  template: `
    <div class="organizer">
      @if (!src()) {
        <div class="empty">
          <i class="pi pi-file-pdf empty-icon"></i>
          <p>Upload a PDF to organize pages into chapters.</p>
          <p class="hint">Each chapter becomes a lesson automatically.</p>
        </div>
      } @else if (loadingThumbs()) {
        <div class="loading">
          <div class="loading-bar">
            <div class="loading-fill" [style.width.%]="loadPct()"></div>
          </div>
          <p>Preparing document… {{ thumbsDone() }} / {{ thumbsTotal() || '…' }} pages</p>
        </div>
      } @else if (loadError()) {
        <div class="empty error">
          <p>{{ loadError() }}</p>
          <p-button label="Retry" size="small" (onClick)="reload()" />
        </div>
      } @else {
        <div class="toolbar">
          <div class="toolbar-meta">
            <strong>{{ pageCount() }} pages</strong>
            <span class="sep">·</span>
            <span>{{ chapters().length }} chapter{{ chapters().length === 1 ? '' : 's' }}</span>
            @if (selectionLabel()) {
              <span class="sep">·</span>
              <span class="sel-label">Selection {{ selectionLabel() }}</span>
            }
          </div>
          <div class="toolbar-actions">
            @if (rangeStart() != null) {
              <p-button
                label="Clear selection"
                severity="secondary"
                [text]="true"
                size="small"
                (onClick)="clearSelection()"
              />
            }
          </div>
        </div>

        @if (rangeStart() != null && rangeEnd() != null) {
          <div class="create-bar">
            <div class="create-info">
              <span class="create-pages">Pages {{ rangeLo() }}–{{ rangeHi() }}</span>
              <span class="create-meta"
                >{{ selectedPageCount() }} pages · ~{{ selectedReadMins() }} min</span
              >
            </div>
            <input
              pInputText
              class="create-title"
              [ngModel]="newChapterTitle()"
              (ngModelChange)="newChapterTitle.set($event)"
              placeholder="Chapter name (e.g. Introduction)"
              (keydown.enter)="createChapterFromSelection()"
            />
            <p-button
              label="Create chapter"
              icon="pi pi-plus"
              size="small"
              [disabled]="!canCreateFromSelection()"
              (onClick)="createChapterFromSelection()"
            />
            @if (selectionBlockedReason(); as reason) {
              <span class="create-warn">{{ reason }}</span>
            }
          </div>
        } @else {
          <p class="instruction">
            Click a start page, then an end page to define a chapter range.
          </p>
        }

        <div class="workspace">
          <div class="thumbs-pane">
            <div class="thumbs-grid">
              @for (thumb of thumbs(); track thumb.page) {
                @let covering = chapterAt(thumb.page);
                @let color = covering ? chapterColor(covering.clientId) : null;
                <button
                  type="button"
                  class="thumb"
                  [class.in-chapter]="!!covering"
                  [class.selected]="isSelected(thumb.page)"
                  [class.range-anchor]="thumb.page === rangeStart()"
                  [style.--ch-color]="color"
                  (click)="onPageClick(thumb.page, $event)"
                  [attr.aria-label]="'Page ' + thumb.page"
                >
                  <img [src]="thumb.dataUrl" [alt]="'Page ' + thumb.page" draggable="false" />
                  <span class="page-num">{{ thumb.page }}</span>
                  @if (covering) {
                    <span class="thumb-ch" [title]="covering.title">{{ covering.title }}</span>
                  }
                </button>
              }
            </div>
          </div>

          <div class="preview-pane">
            @if (previewThumb(); as p) {
              <div class="preview-frame">
                <img [src]="p.dataUrl" [alt]="'Page ' + p.page" />
              </div>
              <div class="preview-cap">Page {{ p.page }} of {{ pageCount() }}</div>
            } @else {
              <div class="preview-empty">Select a page to preview</div>
            }
          </div>
        </div>

        <div class="chapters-block">
          <div class="chapters-head">
            <h3>Chapters</h3>
            <span class="meta">Drag to reorder · rename · split · merge</span>
          </div>

          <div
            class="chapter-list"
            cdkDropList
            (cdkDropListDropped)="onChapterDrop($event)"
          >
            @for (ch of chapters(); track ch.clientId; let i = $index) {
              <div class="chapter-card" cdkDrag [style.--ch-color]="chapterColor(ch.clientId)">
                <i class="pi pi-bars drag-handle" cdkDragHandle></i>
                <div class="ch-color" aria-hidden="true"></div>
                <div class="ch-body">
                  <input
                    pInputText
                    class="ch-title"
                    [(ngModel)]="ch.title"
                    (blur)="renameChapter(ch.clientId, ch.title)"
                    placeholder="Chapter name"
                  />
                  <div class="ch-stats">
                    <span>Pages {{ ch.pageStart }}–{{ ch.pageEnd }}</span>
                    <span>{{ chapterPageCount(ch) }} pages</span>
                    <span>~{{ estimateReadingMinutes(chapterPageCount(ch)) }} min</span>
                  </div>
                </div>
                <div class="ch-actions">
                  <p-button
                    icon="pi pi-arrow-right-arrow-left"
                    [text]="true"
                    size="small"
                    severity="secondary"
                    [disabled]="i >= chapters().length - 1"
                    aria-label="Merge with next chapter"
                    (onClick)="mergeWithNext(i)"
                    title="Merge with next"
                  />
                  <p-button
                    icon="pi pi-minus"
                    [text]="true"
                    size="small"
                    severity="secondary"
                    [disabled]="chapterPageCount(ch) < 2"
                    aria-label="Split chapter"
                    (onClick)="splitChapter(i)"
                    title="Split at midpoint"
                  />
                  <p-button
                    icon="pi pi-trash"
                    [text]="true"
                    size="small"
                    severity="danger"
                    aria-label="Delete chapter"
                    (onClick)="deleteChapter(i)"
                    title="Delete chapter"
                  />
                </div>
              </div>
            } @empty {
              <p class="empty-chapters">
                No chapters yet. Select a page range above to create the first chapter.
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .organizer {
        display: grid;
        gap: var(--s3);
      }
      .empty,
      .loading {
        display: grid;
        gap: var(--s2);
        place-items: center;
        padding: var(--s5) var(--s4);
        border: 1px dashed var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
        color: var(--ctp-muted);
        text-align: center;
      }
      .empty p,
      .loading p {
        margin: 0;
        font-size: var(--ctp-fs-label);
      }
      .empty-icon {
        font-size: 22px;
        color: var(--ctp-primary);
        opacity: 0.85;
      }
      .hint {
        font-size: var(--ctp-fs-small) !important;
      }
      .empty.error {
        border-color: color-mix(in srgb, var(--ctp-danger) 40%, var(--ctp-border));
        color: var(--ctp-danger);
      }
      .loading-bar {
        width: min(280px, 100%);
        height: 4px;
        border-radius: 999px;
        background: var(--ctp-border);
        overflow: hidden;
      }
      .loading-fill {
        height: 100%;
        background: var(--ctp-primary);
        transition: width 0.15s ease;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s2);
        flex-wrap: wrap;
      }
      .toolbar-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--ctp-fs-label);
        color: var(--ctp-ink);
      }
      .toolbar-meta strong {
        font-weight: 600;
      }
      .sep {
        color: var(--ctp-muted);
      }
      .sel-label {
        color: var(--ctp-primary);
        font-weight: 560;
      }
      .instruction {
        margin: 0;
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .create-bar {
        display: flex;
        align-items: center;
        gap: var(--s2);
        flex-wrap: wrap;
        padding: var(--s2) var(--s3);
        background: var(--ctp-primary-soft);
        border: 1px solid color-mix(in srgb, var(--ctp-primary) 28%, transparent);
        border-radius: var(--ctp-radius);
      }
      .create-info {
        display: grid;
        gap: 1px;
        min-width: 120px;
      }
      .create-pages {
        font-size: var(--ctp-fs-label);
        font-weight: 600;
        color: var(--ctp-ink);
      }
      .create-meta {
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .create-title {
        flex: 1;
        min-width: 180px;
      }
      .create-warn {
        flex-basis: 100%;
        font-size: var(--ctp-fs-small);
        color: #b45309;
      }
      .workspace {
        display: grid;
        grid-template-columns: 1fr minmax(160px, 220px);
        gap: var(--s3);
        min-height: 280px;
      }
      .thumbs-pane {
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
        overflow: auto;
        max-height: 420px;
        padding: var(--s2);
      }
      .thumbs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
        gap: var(--s2);
      }
      .thumb {
        position: relative;
        display: grid;
        gap: 4px;
        padding: 4px;
        border: 2px solid var(--ctp-border);
        border-radius: 4px;
        background: var(--ctp-surface);
        cursor: pointer;
        text-align: center;
        transition:
          border-color 0.12s ease,
          box-shadow 0.12s ease;
      }
      .thumb:hover {
        border-color: color-mix(in srgb, var(--ctp-primary) 45%, var(--ctp-border));
      }
      .thumb.in-chapter {
        border-left-width: 4px;
        border-left-color: var(--ch-color, var(--ctp-primary));
      }
      .thumb.selected {
        border-color: var(--ctp-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--ctp-primary) 25%, transparent);
        background: var(--ctp-primary-soft);
      }
      .thumb.range-anchor {
        outline: 2px solid var(--ctp-primary);
        outline-offset: 1px;
      }
      .thumb img {
        width: 100%;
        aspect-ratio: 3 / 4;
        object-fit: cover;
        object-position: top;
        border-radius: 2px;
        background: #fff;
        pointer-events: none;
      }
      .page-num {
        font-size: 11px;
        font-weight: 600;
        color: var(--ctp-ink);
        font-variant-numeric: tabular-nums;
      }
      .thumb-ch {
        font-size: 10px;
        color: var(--ctp-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      .preview-pane {
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: #e8eef5;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      .preview-frame {
        flex: 1;
        overflow: auto;
        display: grid;
        place-items: start center;
        padding: var(--s2);
      }
      .preview-frame img {
        width: 100%;
        box-shadow: var(--ctp-shadow);
        background: #fff;
      }
      .preview-cap {
        padding: 6px var(--s2);
        text-align: center;
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
        background: var(--ctp-surface);
        border-top: 1px solid var(--ctp-border);
      }
      .preview-empty {
        flex: 1;
        display: grid;
        place-items: center;
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
        padding: var(--s3);
      }
      .chapters-block {
        display: grid;
        gap: var(--s2);
      }
      .chapters-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--s2);
      }
      .chapters-head h3 {
        margin: 0;
        font-size: var(--ctp-fs-label);
        font-weight: 600;
      }
      .meta {
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .chapter-list {
        display: grid;
        gap: 6px;
      }
      .chapter-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-surface);
      }
      .ch-color {
        width: 4px;
        align-self: stretch;
        border-radius: 2px;
        background: var(--ch-color, var(--ctp-primary));
        flex-shrink: 0;
      }
      .drag-handle {
        cursor: grab;
        color: var(--ctp-muted);
        font-size: 12px;
      }
      .ch-body {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 4px;
      }
      .ch-title {
        width: 100%;
        font-weight: 560;
      }
      .ch-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .ch-actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
      .empty-chapters {
        margin: 0;
        padding: var(--s3);
        border: 1px dashed var(--ctp-border);
        border-radius: var(--ctp-radius);
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
        background: var(--ctp-bg);
      }
      .cdk-drag-preview {
        box-shadow: 0 8px 24px rgba(17, 24, 39, 0.12);
      }
      @media (max-width: 900px) {
        .workspace {
          grid-template-columns: 1fr;
        }
        .preview-pane {
          min-height: 200px;
        }
      }
    `,
  ],
})
export class PdfDocumentOrganizerComponent implements OnChanges {
  readonly src = input<string | null>(null);
  readonly chapters = input<ChapterDraft[]>([]);

  readonly chaptersChange = output<ChapterDraft[]>();
  readonly pageCountChange = output<number>();
  readonly busyChange = output<boolean>();

  readonly thumbs = signal<PdfPageThumb[]>([]);
  readonly pageCount = signal(0);
  readonly loadingThumbs = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly thumbsDone = signal(0);
  readonly thumbsTotal = signal(0);
  readonly rangeStart = signal<number | null>(null);
  readonly rangeEnd = signal<number | null>(null);
  readonly previewPage = signal<number | null>(null);
  readonly newChapterTitle = signal('');

  private loadToken = 0;
  private colorMap = new Map<string, string>();

  readonly loadPct = computed(() => {
    const t = this.thumbsTotal();
    if (!t) return 0;
    return Math.round((this.thumbsDone() / t) * 100);
  });

  readonly rangeLo = computed(() => {
    const a = this.rangeStart();
    const b = this.rangeEnd() ?? a;
    if (a == null || b == null) return 0;
    return Math.min(a, b);
  });

  readonly rangeHi = computed(() => {
    const a = this.rangeStart();
    const b = this.rangeEnd() ?? a;
    if (a == null || b == null) return 0;
    return Math.max(a, b);
  });

  readonly selectedPageCount = computed(() => {
    if (this.rangeStart() == null) return 0;
    return this.rangeHi() - this.rangeLo() + 1;
  });

  readonly selectedReadMins = computed(() =>
    estimateReadingMinutes(this.selectedPageCount()),
  );

  readonly selectionLabel = computed(() => {
    if (this.rangeStart() == null) return null;
    if (this.rangeEnd() == null) return `page ${this.rangeStart()}`;
    return `${this.rangeLo()}–${this.rangeHi()}`;
  });

  readonly selectionBlockedReason = computed(() => {
    if (this.rangeStart() == null || this.rangeEnd() == null) return null;
    if (this.newChapterTitle().trim().length < 2) {
      return 'Enter a chapter name (at least 2 characters).';
    }
    if (pagesOverlapChapter(this.chapters(), this.rangeLo(), this.rangeHi())) {
      return 'This range overlaps an existing chapter. Clear or adjust the selection.';
    }
    return null;
  });

  readonly previewThumb = computed(() => {
    const p = this.previewPage();
    if (p == null) return this.thumbs()[0] ?? null;
    return this.thumbs().find((t) => t.page === p) ?? null;
  });

  // Expose helpers for template
  readonly chapterPageCount = chapterPageCount;
  readonly estimateReadingMinutes = estimateReadingMinutes;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) {
      void this.reload();
    }
  }

  reload(): void {
    void this.loadDocument();
  }

  chapterAt(page: number): ChapterDraft | null {
    return chapterCoveringPage(this.chapters(), page);
  }

  chapterColor(clientId: string): string {
    let color = this.colorMap.get(clientId);
    if (!color) {
      color = CHAPTER_COLORS[this.colorMap.size % CHAPTER_COLORS.length];
      this.colorMap.set(clientId, color);
    }
    return color;
  }

  isSelected(page: number): boolean {
    if (this.rangeStart() == null) return false;
    const lo = this.rangeLo();
    const hi = this.rangeEnd() == null ? this.rangeStart()! : this.rangeHi();
    return page >= lo && page <= hi;
  }

  onPageClick(page: number, event: MouseEvent): void {
    this.previewPage.set(page);
    const start = this.rangeStart();
    const end = this.rangeEnd();

    if (event.shiftKey && start != null) {
      this.rangeEnd.set(page);
      this.newChapterTitle.set(
        this.defaultTitleForRange(Math.min(start, page), Math.max(start, page)),
      );
      return;
    }

    if (start == null || (start != null && end != null)) {
      this.rangeStart.set(page);
      this.rangeEnd.set(null);
      this.newChapterTitle.set('');
      return;
    }

    this.rangeEnd.set(page);
    this.newChapterTitle.set(
      this.defaultTitleForRange(Math.min(start, page), Math.max(start, page)),
    );
  }

  clearSelection(): void {
    this.rangeStart.set(null);
    this.rangeEnd.set(null);
    this.newChapterTitle.set('');
  }

  canCreateFromSelection(): boolean {
    if (this.rangeStart() == null || this.rangeEnd() == null) return false;
    const title = this.newChapterTitle().trim();
    if (title.length < 2) return false;
    return !pagesOverlapChapter(this.chapters(), this.rangeLo(), this.rangeHi());
  }

  createChapterFromSelection(): void {
    if (!this.canCreateFromSelection()) return;
    const draft: ChapterDraft = {
      clientId: newChapterClientId(),
      title: this.newChapterTitle().trim(),
      pageStart: this.rangeLo(),
      pageEnd: this.rangeHi(),
    };
    const next = [...this.chapters(), draft].sort(
      (a, b) => a.pageStart - b.pageStart,
    );
    this.emitChapters(next);
    this.clearSelection();
  }

  renameChapter(clientId: string, title: string): void {
    this.emitChapters(
      this.chapters().map((c) => (c.clientId === clientId ? { ...c, title } : c)),
    );
  }

  deleteChapter(index: number): void {
    const next = [...this.chapters()];
    next.splice(index, 1);
    this.emitChapters(next);
  }

  mergeWithNext(index: number): void {
    const list = [...this.chapters()];
    if (index < 0 || index >= list.length - 1) return;
    const a = list[index];
    const b = list[index + 1];
    if (a.pageEnd + 1 !== b.pageStart) {
      // allow merge only when contiguous; still merge ranges if overlapping edges
    }
    list[index] = {
      ...a,
      title: a.title,
      pageStart: Math.min(a.pageStart, b.pageStart),
      pageEnd: Math.max(a.pageEnd, b.pageEnd),
      lessonId: a.lessonId,
    };
    list.splice(index + 1, 1);
    this.emitChapters(list);
  }

  splitChapter(index: number): void {
    const list = [...this.chapters()];
    const ch = list[index];
    const count = chapterPageCount(ch);
    if (count < 2) return;
    const mid = ch.pageStart + Math.floor(count / 2) - 1;
    const firstEnd = mid;
    const secondStart = mid + 1;
    if (secondStart > ch.pageEnd) return;

    const first: ChapterDraft = {
      ...ch,
      pageEnd: firstEnd,
    };
    const second: ChapterDraft = {
      clientId: newChapterClientId(),
      title: `${ch.title} (cont.)`,
      pageStart: secondStart,
      pageEnd: ch.pageEnd,
    };
    list.splice(index, 1, first, second);
    this.emitChapters(list);
  }

  onChapterDrop(event: CdkDragDrop<ChapterDraft[]>): void {
    const items = [...this.chapters()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.emitChapters(items);
  }

  private emitChapters(next: ChapterDraft[]): void {
    this.chaptersChange.emit(next);
  }

  private defaultTitleForRange(start: number, end: number): string {
    const n = this.chapters().length + 1;
    if (start === end) return `Chapter ${n}`;
    return `Chapter ${n}`;
  }

  private async loadDocument(): Promise<void> {
    const url = this.src();
    this.loadToken += 1;
    const token = this.loadToken;
    this.thumbs.set([]);
    this.pageCount.set(0);
    this.loadError.set(null);
    this.clearSelection();
    this.previewPage.set(null);

    if (!url) {
      this.loadingThumbs.set(false);
      this.busyChange.emit(false);
      return;
    }

    this.loadingThumbs.set(true);
    this.busyChange.emit(true);
    this.thumbsDone.set(0);
    this.thumbsTotal.set(0);

    try {
      const { pageCount, thumbs } = await renderPdfPageThumbnails(url, (done, total) => {
        if (token !== this.loadToken) return;
        this.thumbsDone.set(done);
        this.thumbsTotal.set(total);
      });
      if (token !== this.loadToken) return;
      this.pageCount.set(pageCount);
      this.thumbs.set(thumbs);
      this.previewPage.set(1);
      this.pageCountChange.emit(pageCount);
    } catch {
      if (token !== this.loadToken) return;
      this.loadError.set('Could not load this PDF. Try uploading again.');
    } finally {
      if (token === this.loadToken) {
        this.loadingThumbs.set(false);
        this.busyChange.emit(false);
      }
    }
  }
}
