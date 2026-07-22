import {
  Component,
  HostListener,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';

export type FullscreenLearningMode = 'pdf' | 'video';

/**
 * Minimal overlay learning chrome for Fullscreen API sessions.
 * Floats above content — does not reduce the document viewport.
 */
@Component({
  selector: 'app-fullscreen-learning-toolbar',
  standalone: true,
  imports: [Button, InputText, FormsModule],
  template: `
    @if (active()) {
      <div
        class="fs-chrome"
        [class.is-visible]="chromeVisible()"
        [class.is-paused]="paused()"
        (mousemove)="onChromePointer()"
      >
        <div class="fs-toolbar" role="toolbar" aria-label="Fullscreen learning controls">
          <div class="fs-group fs-left">
            <button type="button" class="fs-exit" (click)="exitFullscreen.emit()">
              <i class="pi pi-arrow-left" aria-hidden="true"></i>
              <span>Exit Fullscreen</span>
            </button>
            @if (mode() === 'pdf' && pageLabel()) {
              <span class="fs-page">{{ pageLabel() }}</span>
            }
            @if (mode() === 'video' && pageLabel()) {
              <span class="fs-page">{{ pageLabel() }}</span>
            }
          </div>

          <div class="fs-group fs-center">
            @if (paused()) {
              <div class="fs-paused">
                <span class="fs-paused-title">{{
                  mode() === 'pdf' ? '⏸ Reading Paused' : '⏸ Playback Paused'
                }}</span>
                <span class="fs-paused-hint">Return to this tab to continue.</span>
              </div>
            } @else if (pageComplete()) {
              <div class="fs-complete">
                <span class="fs-complete-title">{{
                  mode() === 'pdf' ? '✓ Page Complete' : '✓ Complete'
                }}</span>
              </div>
            } @else if (mode() === 'pdf') {
              <div class="fs-timer">
                <span class="fs-timer-label">⏱ Reading Time Remaining</span>
                <strong class="fs-timer-value">{{ timerLabel() }}</strong>
              </div>
            } @else {
              <div class="fs-timer">
                <span class="fs-timer-label">Watch Progress</span>
                <strong class="fs-timer-value">{{ timerLabel() }}</strong>
              </div>
            }
          </div>

          <div class="fs-group fs-actions">
            @if (mode() === 'pdf') {
              <p-button
                icon="pi pi-minus"
                [text]="true"
                size="small"
                (onClick)="zoomOut.emit()"
                ariaLabel="Zoom out"
              />
              <span class="fs-zoom">{{ zoomPercent() }}%</span>
              <p-button
                icon="pi pi-plus"
                [text]="true"
                size="small"
                (onClick)="zoomIn.emit()"
                ariaLabel="Zoom in"
              />
              <div class="fs-search">
                <input
                  pInputText
                  type="search"
                  placeholder="Search"
                  [(ngModel)]="searchQuery"
                  (keydown.enter)="emitSearch()"
                  aria-label="Search in document"
                />
                <p-button
                  icon="pi pi-search"
                  [text]="true"
                  size="small"
                  (onClick)="emitSearch()"
                  ariaLabel="Search"
                />
              </div>
            }

            <p-button
              icon="pi pi-window-minimize"
              [text]="true"
              size="small"
              (onClick)="toggleFullscreen.emit()"
              ariaLabel="Exit fullscreen"
            />
          </div>
        </div>
      </div>

      <!-- Persistent timer chip when the full toolbar is auto-hidden -->
      @if (!chromeVisible() && !paused()) {
        <div class="fs-timer-chip" aria-live="polite">
          @if (pageComplete()) {
            <span>✓ Page Complete</span>
          } @else {
            <span class="chip-label">⏱</span>
            <strong>{{ timerLabel() }}</strong>
          }
        </div>
      }

      @if (!chromeVisible() && paused()) {
        <div class="fs-timer-chip is-paused" aria-live="polite">
          <span>⏸ Reading Paused</span>
        </div>
      }

      <div
        class="fs-hotzone"
        (mouseenter)="revealChrome()"
        (mousemove)="revealChrome()"
        aria-hidden="true"
      ></div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .fs-chrome {
        position: absolute;
        inset: 0 0 auto 0;
        z-index: 40;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-10px);
        transition:
          opacity 200ms ease,
          transform 200ms ease;
      }
      .fs-chrome.is-visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      .fs-toolbar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 10px;
        height: 48px;
        min-height: 48px;
        max-height: 48px;
        padding: 0 12px;
        box-sizing: border-box;
        background: color-mix(in srgb, #0f172a 82%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid color-mix(in srgb, #fff 10%, transparent);
        color: #f8fafc;
      }
      .fs-group {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .fs-left {
        justify-content: flex-start;
      }
      .fs-center {
        justify-content: center;
        text-align: center;
      }
      .fs-actions {
        justify-content: flex-end;
      }
      .fs-exit {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid color-mix(in srgb, #fff 16%, transparent);
        background: color-mix(in srgb, #fff 8%, transparent);
        color: #f8fafc;
        border-radius: 6px;
        padding: 5px 9px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .fs-exit:hover {
        background: color-mix(in srgb, #fff 14%, transparent);
      }
      .fs-page {
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        opacity: 0.92;
      }
      .fs-timer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.15;
        gap: 1px;
      }
      .fs-timer-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
        opacity: 0.78;
        white-space: nowrap;
      }
      .fs-timer-value {
        font-size: 18px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
        color: #fff;
      }
      .fs-paused {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        line-height: 1.15;
      }
      .fs-paused-title {
        font-size: 14px;
        font-weight: 700;
        color: #fde68a;
        white-space: nowrap;
      }
      .fs-paused-hint {
        font-size: 11px;
        opacity: 0.85;
        white-space: nowrap;
      }
      .fs-complete {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .fs-complete-title {
        font-size: 15px;
        font-weight: 700;
        color: #86efac;
        white-space: nowrap;
      }
      .fs-zoom {
        min-width: 2.75rem;
        text-align: center;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .fs-search {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .fs-search input {
        width: 120px;
        min-height: 28px !important;
        height: 28px;
        padding: 0 8px !important;
        font-size: 12px !important;
        background: color-mix(in srgb, #fff 10%, transparent) !important;
        border-color: color-mix(in srgb, #fff 16%, transparent) !important;
        color: #f8fafc !important;
      }
      .fs-search input::placeholder {
        color: color-mix(in srgb, #f8fafc 55%, transparent);
      }
      :host ::ng-deep .p-button.p-button-text {
        color: #e2e8f0 !important;
      }
      .fs-timer-chip {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 38;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        background: color-mix(in srgb, #0f172a 78%, transparent);
        backdrop-filter: blur(8px);
        border: 1px solid color-mix(in srgb, #fff 12%, transparent);
        color: #f8fafc;
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.25);
      }
      .fs-timer-chip .chip-label {
        opacity: 0.85;
        font-weight: 600;
      }
      .fs-timer-chip.is-paused {
        color: #fde68a;
      }
      .fs-hotzone {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 48px;
        z-index: 39;
        pointer-events: auto;
      }
      .fs-chrome.is-visible + .fs-timer-chip,
      .fs-chrome.is-visible ~ .fs-hotzone {
        pointer-events: none;
      }
      .fs-chrome.is-visible ~ .fs-hotzone {
        pointer-events: none;
      }
      @media (max-width: 900px) {
        .fs-toolbar {
          grid-template-columns: auto 1fr auto;
          gap: 6px;
        }
        .fs-exit span {
          display: none;
        }
        .fs-search input {
          width: 96px;
        }
      }
    `,
  ],
})
export class FullscreenLearningToolbarComponent implements OnDestroy {
  readonly active = input(false);
  readonly mode = input<FullscreenLearningMode>('pdf');
  readonly pageLabel = input<string | null>(null);
  readonly timerLabel = input('00:00');
  readonly paused = input(false);
  readonly zoomPercent = input(100);
  /** Optional: true when required reading time for the current page is done. */
  readonly complete = input(false);

  readonly exitFullscreen = output<void>();
  readonly toggleFullscreen = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly search = output<string>();

  searchQuery = '';

  private readonly revealed = signal(true);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly chromeVisible = computed(() => this.active() && this.revealed());

  readonly pageComplete = computed(
    () => this.complete() || this.timerLabel() === '00:00',
  );

  constructor() {
    effect(() => {
      if (this.active() && this.paused()) {
        this.revealed.set(true);
        this.clearHideTimer();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearHideTimer();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(_event: MouseEvent): void {
    if (!this.active()) return;
    this.revealChrome();
  }

  onChromePointer(): void {
    if (!this.active()) return;
    this.revealChrome();
  }

  revealChrome(): void {
    this.revealed.set(true);
    this.scheduleHide();
  }

  emitSearch(): void {
    this.search.emit(this.searchQuery.trim());
  }

  /** Called by parent when fullscreen starts so chrome is visible immediately. */
  onFullscreenEntered(): void {
    this.revealed.set(true);
    this.scheduleHide();
  }

  private scheduleHide(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      if (this.paused()) {
        this.revealed.set(true);
        return;
      }
      this.revealed.set(false);
    }, 3000);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
