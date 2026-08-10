import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Message } from 'primeng/message';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { LearningApiService } from '../../core/http/learning-api.service';
import { LearningTrackerService } from '../../core/learning/learning-tracker.service';
import { PdfPageReadingEngine } from '../../core/learning/pdf-page-reading.engine';
import { ContentProtectionService } from '../../core/content-protection/content-protection.service';
import { ProtectedMediaService } from '../../core/content-protection/protected-media.service';
import { PdfViewerComponent } from '../../shared/components/pdf-viewer/pdf-viewer.component';
import { VideoPlayerComponent } from '../../shared/components/video-player/video-player.component';
import { AssessmentRunnerComponent } from '../../shared/components/assessment-runner/assessment-runner.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { ContentProtectionLayerComponent } from '../../shared/components/content-protection-layer/content-protection-layer.component';
import type {
  LessonProgressDto,
  PageProgressDto,
  PlayerLessonDto,
  PlayerPayload,
} from '../../core/models/domain.models';
import { isLessonSequentiallyLocked } from '../../shared/utils/sequential-lessons.util';
import type { QuizSubmitResult } from '../../core/http/quiz-api.service';

@Component({
  selector: 'app-course-player-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    Button,
    ProgressBar,
    Message,
    Dialog,
    InputText,
    PdfViewerComponent,
    VideoPlayerComponent,
    AssessmentRunnerComponent,
    LoadingStateComponent,
    ContentProtectionLayerComponent,
  ],
  providers: [PdfPageReadingEngine],
  template: `
    @if (loading()) {
      <div class="player-loading">
        <app-loading-state message="Opening your course…" />
      </div>
    } @else if (payload()) {
      <div
        class="player"
        [class.outline-open]="outlineOpen()"
        [class.outline-overlay]="outlineOverlay()"
      >
        <header class="player-top">
          <div class="top-left">
            <a [routerLink]="backLink()" class="back" [attr.aria-label]="backLabel()">
              <i class="pi pi-arrow-left"></i>
            </a>
            <h1>{{ payload()!.course.title }}</h1>
          </div>

          <div class="top-actions">
            @if (activeLesson()?.type === 'PDF' || activeLesson()?.type === 'VIDEO') {
              @if (activeLesson()?.type === 'PDF') {
                <div class="header-search">
                  <input
                    pInputText
                    type="search"
                    placeholder="Search"
                    [(ngModel)]="searchQuery"
                    (keydown.enter)="runSearch()"
                    aria-label="Search in document"
                  />
                  <button type="button" class="icon-btn" aria-label="Search" (click)="runSearch()">
                    <i class="pi pi-search"></i>
                  </button>
                </div>
              }
              <button
                type="button"
                class="icon-btn"
                aria-label="Fullscreen"
                (click)="toggleFullscreen()"
              >
                <i class="pi pi-window-maximize"></i>
              </button>
            }
            <button
              type="button"
              class="outline-toggle"
              [class.active]="outlineOpen()"
              (click)="toggleOutline()"
            >
              <i class="pi pi-book" aria-hidden="true"></i>
              Course Outline
            </button>
          </div>
        </header>

        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="player-error" />
        }

        <div class="player-body">
          <section class="center-viewer">
            @if (activeLesson(); as lesson) {
              <div class="viewer-body">
                <app-content-protection-layer
                  class="cp-host"
                  [lessonId]="viewMode() === 'assessment' ? null : lesson.id"
                >
                  @if (viewMode() === 'assessment' && lesson.assessment) {
                    <app-assessment-runner
                      [assignmentId]="payload()!.assignment.id"
                      [lessonId]="lesson.id"
                      [assessment]="lesson.assessment"
                      (completed)="onAssessmentCompleted($event)"
                      (continueNext)="goNextAfterAssessment()"
                    />
                  } @else if (lesson.type === 'PDF' && mediaUrl(lesson)) {
                    <app-pdf-viewer
                      #pdfViewer
                      chrome="minimal"
                      [src]="mediaUrl(lesson)!"
                      [initialPage]="pdfInitialPage()"
                      [pageStart]="chapterStart(lesson)"
                      [pageEnd]="chapterEnd(lesson)"
                      [forwardLocked]="!pageEngine.forwardUnlocked()"
                      [lockTooltip]="pageLockTooltip"
                      [learningPageLabel]="fullscreenPageLabel()"
                      [learningTimerLabel]="pageEngine.timerLabel()"
                      [learningPaused]="pageEngine.paused() || protection.forcePaused()"
                      [learningComplete]="pageEngine.forwardUnlocked()"
                      (pageChange)="onPdfPage($event)"
                      (pageLoaded)="onPdfPageLoaded($event)"
                      (scrollChange)="onPdfScroll($event)"
                      (fullscreenChange)="onViewerFullscreen($event)"
                    />
                  } @else if (lesson.type === 'VIDEO' && mediaUrl(lesson)) {
                    <app-video-player
                      #videoPlayer
                      [src]="mediaUrl(lesson)!"
                      [startAt]="currentProgress()?.resumePositionSec || 0"
                      [learningPageLabel]="displayLessonTitle(lesson)"
                      [learningTimerLabel]="videoWatchLabel()"
                      [learningPaused]="tabHidden() || protection.forcePaused()"
                      [learningComplete]="(currentProgress()?.watchPercentage ?? 0) >= (payload()?.videoCompletionPercent ?? 90)"
                      (play)="onVideoPlay($event)"
                      (pause)="onVideoPause($event)"
                      (seek)="onVideoSeek($event)"
                      (speed)="onVideoSpeed($event)"
                      (progress)="onVideoProgress($event)"
                      (fullscreenChange)="onViewerFullscreen($event)"
                    />
                  } @else {
                    <div class="placeholder">
                      <h3>Content unavailable</h3>
                      <p>This lesson is not ready yet. Contact your administrator.</p>
                    </div>
                  }
                </app-content-protection-layer>
              </div>
            }

            @if (!outlineOpen()) {
              <button
                type="button"
                class="outline-edge"
                aria-label="Open course outline"
                (click)="outlineOpen.set(true)"
              >
                Course Outline
                <span aria-hidden="true">▶</span>
              </button>
            }
          </section>

          @if (outlineOpen() && outlineOverlay()) {
            <button
              type="button"
              class="outline-backdrop"
              aria-label="Close course outline"
              (click)="outlineOpen.set(false)"
            ></button>
          }

          <aside
            class="outline-drawer"
            [class.is-open]="outlineOpen()"
            aria-label="Course outline"
          >
            <div class="drawer-panel">
              <div class="drawer-head">
                <span>Course Outline</span>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Close course outline"
                  (click)="outlineOpen.set(false)"
                >
                  <i class="pi pi-times"></i>
                </button>
              </div>

              <div class="drawer-course">
                <strong>{{ payload()!.course.title }}</strong>
                <div class="drawer-progress">
                  <span>{{ payload()!.assignment.progressPercent }}% Completed</span>
                  <p-progressBar
                    [value]="payload()!.assignment.progressPercent"
                    [showValue]="false"
                  />
                </div>
              </div>

              <div class="outline-list">
                @for (lesson of flatLessons(); track lesson.id) {
                  <div class="outline-group">
                    <button
                      type="button"
                      class="outline-card"
                      [class.active]="lesson.id === activeLessonId() && viewMode() === 'lesson'"
                      [class.done]="lessonStatus(lesson.id) === 'COMPLETED'"
                      [class.locked]="isLessonLocked(lesson)"
                      [disabled]="isLessonLocked(lesson)"
                      (click)="selectLesson(lesson.id)"
                    >
                      <span class="card-icon" aria-hidden="true">
                        @if (lessonStatus(lesson.id) === 'COMPLETED') {
                          <i class="pi pi-check-circle"></i>
                        } @else if (isLessonLocked(lesson)) {
                          <i class="pi pi-lock"></i>
                        } @else if (lesson.type === 'VIDEO') {
                          <i class="pi pi-video"></i>
                        } @else {
                          <i class="pi pi-file"></i>
                        }
                      </span>
                      <span class="card-body">
                        <span class="card-title">{{ outlineItemTitle(lesson) }}</span>
                        <span class="card-meta">{{ outlineItemMeta(lesson) }}</span>
                        @if (lesson.id === activeLessonId() && viewMode() === 'lesson' && lessonStatus(lesson.id) !== 'COMPLETED') {
                          <span class="card-badge current">Current Lesson</span>
                        }
                        @if (isLessonLocked(lesson)) {
                          <span class="card-badge locked">Locked</span>
                        }
                      </span>
                    </button>
                    @if (lesson.assessment; as assessment) {
                      <button
                        type="button"
                        class="outline-card assessment-card"
                        [class.active]="lesson.id === activeLessonId() && viewMode() === 'assessment'"
                        [class.done]="assessment.state === 'passed'"
                        [class.locked]="!canOpenAssessment(lesson)"
                        [disabled]="!canOpenAssessment(lesson)"
                        (click)="openAssessment(lesson.id)"
                      >
                        <span class="card-icon"><i class="pi pi-pencil"></i></span>
                        <span class="card-body">
                          <span class="card-title">{{ assessment.title || 'Assessment' }}</span>
                          <span class="card-meta">{{ assessmentOutlineMeta(assessment) }}</span>
                          <span class="card-badge" [class.locked]="assessment.state === 'locked' || assessment.state === 'exhausted'" [class.current]="assessment.state === 'ready'" [class.action]="assessment.state === 'failed'">
                            {{ assessmentOutlineBadge(assessment) }}
                          </span>
                        </span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </aside>
        </div>

        <footer class="player-bottom">
          @if (activeLesson()?.type === 'PDF') {
            <div class="reading-timer" [class.paused]="pageEngine.paused()">
              <div class="timer-meta">
                Page {{ pdfRelativePage() }} of {{ pdfChapterTotal() || '…' }}
                <span class="sep">·</span>
                Reading Timer
                @if (pageEngine.paused()) {
                  <span class="paused-badge">Paused</span>
                }
              </div>
              <div class="timer-value" [attr.title]="pageLockTooltip">
                {{ pageEngine.timerLabel() }} remaining
              </div>
              <div class="timer-bar" aria-hidden="true">
                <span [style.width.%]="pageEngine.progressPercent()"></span>
              </div>
            </div>
          }

          <div class="player-nav-row">
            <div class="nav-group">
              <p-button
                label="Previous lesson"
                icon="pi pi-angle-double-left"
                severity="secondary"
                [outlined]="true"
                size="small"
                [disabled]="!hasPrev()"
                (onClick)="goPrev()"
              />
              <p-button
                label="Previous page"
                icon="pi pi-angle-left"
                severity="secondary"
                [outlined]="true"
                size="small"
                [disabled]="!canPrevPage()"
                (onClick)="goPrevPage()"
              />
            </div>
            <div class="bottom-center muted">
              @if (activeLesson(); as lesson) {
                @if (lesson.type !== 'PDF') {
                  {{ displayLessonTitle(lesson) }}
                  <span class="sep">·</span>
                  Lesson {{ activeIndex() + 1 }} of {{ payload()!.lessons.length }}
                }
              }
            </div>
            <div class="nav-group end">
              <span
                class="next-wrap"
                [attr.title]="
                  activeLesson()?.type === 'PDF' && !pageEngine.forwardUnlocked()
                    ? pageLockTooltip
                    : null
                "
              >
                <p-button
                  label="Next Page"
                  icon="pi pi-angle-right"
                  iconPos="right"
                  severity="secondary"
                  [outlined]="true"
                  size="small"
                  [disabled]="!canNextPage()"
                  (onClick)="goNextPage()"
                />
              </span>
              <p-button
                label="Next lesson"
                icon="pi pi-angle-double-right"
                iconPos="right"
                size="small"
                [disabled]="!canGoNextLesson()"
                (onClick)="goNext()"
              />
            </div>
          </div>
        </footer>
      </div>
    }

    <p-dialog header="Level Complete" [(visible)]="levelCompleteVisible" [modal]="true" [style]="{ width: 'min(420px, 94vw)' }">
      <p>{{ completedLevelTitle }} completed.</p>
      <p>You've completed all required courses in this level.</p>
      @if (nextLevelTitle) {
        <p>Next: {{ nextLevelTitle }}</p>
      }
      <p-button label="Continue" (onClick)="levelCompleteVisible = false" />
    </p-dialog>
  `,
  styles: [
    `
      :host {
        display: block;
        margin: calc(-1 * var(--ctp-page-pad));
        min-height: calc(100vh - var(--ctp-header-h));
      }
      .player-loading {
        padding: var(--s5);
      }
      .player {
        height: calc(100vh - var(--ctp-header-h));
        display: grid;
        grid-template-rows: auto 1fr auto;
        background: var(--ctp-bg);
      }
      .player-top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 0 12px;
        height: 44px;
        background: var(--ctp-surface);
        border-bottom: 1px solid var(--ctp-border);
      }
      .top-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .back {
        width: 30px;
        height: 30px;
        border-radius: var(--ctp-radius);
        border: 1px solid var(--ctp-border);
        display: grid;
        place-items: center;
        color: var(--ctp-muted);
        text-decoration: none;
        flex-shrink: 0;
      }
      .back:hover {
        color: var(--ctp-primary);
        border-color: var(--ctp-primary);
      }
      h1 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--ctp-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .top-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
      }
      .header-search {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .header-search input {
        width: 150px;
        min-height: 30px !important;
        height: 30px;
        padding: 0 8px !important;
        font-size: 12px !important;
      }
      .icon-btn {
        width: 30px;
        height: 30px;
        border: 1px solid var(--ctp-border);
        background: var(--ctp-surface);
        border-radius: var(--ctp-radius);
        color: var(--ctp-muted);
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 12px;
      }
      .icon-btn:hover {
        color: var(--ctp-ink);
        background: var(--ctp-bg);
      }
      .outline-toggle {
        height: 30px;
        padding: 0 10px;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-surface);
        color: var(--ctp-ink);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .outline-toggle i {
        font-size: 13px;
      }
      .outline-toggle.active,
      .outline-toggle:hover {
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        border-color: color-mix(in srgb, var(--ctp-primary) 30%, var(--ctp-border));
      }
      .player-error {
        margin: 6px 12px 0 !important;
      }
      .player-body {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 0fr;
        min-height: 0;
        overflow: hidden;
        transition: grid-template-columns 250ms ease;
      }
      .player.outline-open:not(.outline-overlay) .player-body {
        grid-template-columns: minmax(0, 1fr) 360px;
      }
      .center-viewer {
        position: relative;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: #eef2f7;
        overflow: hidden;
      }
      .viewer-body {
        flex: 1;
        min-height: 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .viewer-body > .cp-host,
      .viewer-body ::ng-deep .cp-content > app-pdf-viewer,
      .viewer-body ::ng-deep .cp-content > app-video-player,
      .viewer-body ::ng-deep .cp-content > app-assessment-runner,
      .viewer-body ::ng-deep .cp-content > app-quiz-runner {
        flex: 1;
        min-height: 0;
        min-width: 0;
        height: 100%;
      }
      .outline-edge {
        position: absolute;
        top: 50%;
        right: 0;
        z-index: 6;
        transform: translateY(-50%);
        writing-mode: vertical-rl;
        transform-origin: center;
        border: 1px solid var(--ctp-border);
        border-right: none;
        border-radius: 10px 0 0 10px;
        background: var(--ctp-surface);
        color: var(--ctp-ink);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        padding: 14px 8px;
        cursor: pointer;
        box-shadow: -2px 0 10px rgba(17, 24, 39, 0.08);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 120px;
      }
      .outline-edge:hover {
        color: var(--ctp-primary);
        background: var(--ctp-primary-soft);
      }
      .outline-backdrop {
        position: absolute;
        inset: 0;
        z-index: 8;
        border: none;
        background: rgba(15, 23, 42, 0.35);
        cursor: pointer;
      }
      .outline-drawer {
        width: 0;
        min-width: 0;
        overflow: hidden;
        background: var(--ctp-surface);
        border-left: 1px solid transparent;
        display: flex;
        flex-direction: column;
        transition:
          width 250ms ease,
          min-width 250ms ease,
          border-color 250ms ease;
        z-index: 9;
      }
      .outline-drawer.is-open {
        width: 360px;
        min-width: 360px;
        border-left-color: var(--ctp-border);
      }
      .drawer-panel {
        width: 360px;
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .player.outline-overlay .outline-drawer {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 0;
        min-width: 0;
        box-shadow: none;
      }
      .player.outline-overlay .outline-drawer.is-open {
        width: min(360px, 92vw);
        min-width: min(360px, 92vw);
        box-shadow: -8px 0 28px rgba(15, 23, 42, 0.18);
      }
      .player.outline-overlay .drawer-panel {
        width: min(360px, 92vw);
      }
      .drawer-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--ctp-border);
        font-size: 14px;
        font-weight: 700;
        color: var(--ctp-ink);
        flex-shrink: 0;
      }
      .drawer-course {
        padding: 14px;
        border-bottom: 1px solid var(--ctp-border);
        flex-shrink: 0;
      }
      .drawer-course strong {
        display: block;
        font-size: 14px;
        color: var(--ctp-ink);
        margin-bottom: 8px;
        line-height: 1.35;
      }
      .drawer-progress {
        display: grid;
        gap: 6px;
        font-size: 12px;
        color: var(--ctp-muted);
      }
      .outline-list {
        flex: 1;
        overflow: auto;
        padding: 12px;
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .outline-card {
        width: 100%;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        text-align: left;
        border: 1px solid var(--ctp-border);
        background: var(--ctp-surface);
        border-radius: 12px;
        padding: 12px;
        cursor: pointer;
        font-family: inherit;
        color: var(--ctp-ink);
        transition:
          background 160ms ease,
          border-color 160ms ease;
      }
      .outline-card:hover:not(:disabled) {
        background: var(--ctp-bg);
      }
      .outline-card.active {
        border-color: var(--ctp-primary);
        background: var(--ctp-primary-soft);
      }
      .outline-card.done {
        border-color: color-mix(in srgb, var(--ctp-success) 35%, var(--ctp-border));
      }
      .outline-card.locked {
        cursor: not-allowed;
        opacity: 0.72;
        color: var(--ctp-muted);
      }
      .outline-group { display: grid; gap: 0.45rem; }
      .assessment-card { margin-left: 1.1rem; }
      .card-icon {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        background: var(--ctp-bg);
        color: var(--ctp-muted);
        font-size: 14px;
      }
      .outline-card.active .card-icon {
        background: color-mix(in srgb, var(--ctp-primary) 16%, #fff);
        color: var(--ctp-primary);
      }
      .outline-card.done .card-icon {
        color: var(--ctp-success);
        background: color-mix(in srgb, var(--ctp-success) 14%, #fff);
      }
      .card-body {
        display: grid;
        gap: 4px;
        min-width: 0;
        flex: 1;
      }
      .card-title {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.3;
      }
      .card-meta {
        font-size: 12px;
        color: var(--ctp-muted);
      }
      .card-badge {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        margin-top: 4px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 999px;
        padding: 2px 8px;
      }
      .card-badge.current {
        color: var(--ctp-primary);
        background: color-mix(in srgb, var(--ctp-primary) 12%, #fff);
      }
      .card-badge.locked {
        color: #64748b;
        background: #f1f5f9;
      }
      .card-badge.action {
        color: var(--ctp-primary);
        background: transparent;
        padding-left: 0;
      }
      .placeholder {
        display: grid;
        place-content: center;
        text-align: center;
        color: var(--ctp-muted);
        padding: var(--s5);
        min-height: 240px;
        font-size: var(--ctp-fs-body);
      }
      .player-bottom {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 12px;
        background: var(--ctp-surface);
        border-top: 1px solid var(--ctp-border);
      }
      .player-nav-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        min-height: 36px;
      }
      .nav-group {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .nav-group.end {
        justify-content: flex-end;
      }
      .bottom-center {
        font-size: 12px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 40vw;
      }
      .reading-timer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        width: 100%;
        padding: 4px 0 2px;
        white-space: normal;
      }
      .reading-timer.paused .timer-value {
        color: var(--ctp-muted);
      }
      .timer-meta {
        font-size: 11px;
        color: var(--ctp-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 4px;
      }
      .paused-badge {
        font-size: 10px;
        font-weight: 600;
        color: #b45309;
        background: #fef3c7;
        padding: 1px 6px;
        border-radius: 4px;
      }
      .timer-value {
        font-size: 15px;
        font-weight: 700;
        color: var(--ctp-ink);
        font-variant-numeric: tabular-nums;
      }
      .timer-bar {
        width: min(220px, 70vw);
        height: 4px;
        border-radius: 999px;
        background: var(--ctp-border);
        overflow: hidden;
      }
      .timer-bar > span {
        display: block;
        height: 100%;
        background: var(--ctp-primary);
        transition: width 0.3s ease;
      }
      .next-wrap {
        display: inline-flex;
      }
      .sep {
        margin: 0 4px;
        opacity: 0.5;
      }
      .muted {
        color: var(--ctp-muted);
      }
      @media (max-width: 1100px) {
        .player.outline-open:not(.outline-overlay) .player-body {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (max-width: 800px) {
        .header-search {
          display: none;
        }
        .outline-toggle span,
        .outline-toggle {
          font-size: 12px;
        }
        .player-nav-row {
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .bottom-center {
          display: none;
        }
        .nav-group.end {
          grid-column: 2;
        }
        .reading-timer {
          padding: 6px 0;
          border-bottom: 1px solid var(--ctp-border);
        }
        .timer-value {
          font-size: 16px;
        }
        .timer-bar {
          width: min(260px, 80vw);
        }
        :host ::ng-deep .player-nav-row .p-button {
          min-height: 44px;
        }
      }
    `,
  ],
})
export class CoursePlayerPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(LearningApiService);
  private readonly tracker = inject(LearningTrackerService);
  readonly pageEngine = inject(PdfPageReadingEngine);
  readonly protection = inject(ContentProtectionService);
  private readonly protectedMedia = inject(ProtectedMediaService);
  private readonly pdfViewer = viewChild<PdfViewerComponent>('pdfViewer');
  private readonly videoPlayer = viewChild<VideoPlayerComponent>('videoPlayer');

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly payload = signal<PlayerPayload | null>(null);
  readonly activeLessonId = signal<string | null>(null);
  readonly progressMap = signal<Record<string, LessonProgressDto>>({});
  readonly outlineOpen = signal(false);
  readonly outlineOverlay = signal(false);
  readonly pdfCanPrev = signal(false);
  readonly pdfCanNext = signal(false);
  readonly pdfInitialPage = signal(1);
  readonly pageProgressByLesson = signal<Record<string, PageProgressDto[]>>({});
  readonly tabHidden = signal(false);

  readonly pageLockTooltip =
    'You must spend 1 minute on this page before continuing.';

  searchQuery = '';

  private readingTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleStartedAt: number | null = null;
  private hidden = false;
  private blurred = false;
  private completingLesson = false;
  readonly viewMode = signal<'lesson' | 'assessment'>('lesson');
  levelCompleteVisible = false;
  completedLevelTitle = '';
  nextLevelTitle = '';

  constructor() {
    effect(() => {
      if (!this.canMarkComplete()) return;
      queueMicrotask(() => this.completeLesson());
    });
  }

  readonly activeLesson = computed(() => {
    const id = this.activeLessonId();
    return this.payload()?.lessons.find((l) => l.id === id) ?? null;
  });

  readonly activeIndex = computed(() => {
    const id = this.activeLessonId();
    return this.payload()?.lessons.findIndex((l) => l.id === id) ?? 0;
  });

  readonly flatLessons = computed(() => this.payload()?.lessons ?? []);

  readonly currentProgress = computed(() => {
    const id = this.activeLessonId();
    return id ? this.progressMap()[id] ?? null : null;
  });

  backLink(): string[] {
    const programId = this.route.snapshot.queryParamMap.get('programId');
    const levelId = this.route.snapshot.queryParamMap.get('levelId');
    if (programId && levelId) {
      return ['/app/learning/programs', programId, 'levels', levelId];
    }
    return ['/app/my-learning'];
  }

  backLabel(): string {
    return this.route.snapshot.queryParamMap.get('levelId') ? 'Back to Level' : 'Back to My Learning';
  }

  ngOnInit(): void {
    this.syncOverlayMode();
    const assignmentId = this.route.snapshot.paramMap.get('assignmentId')!;
    this.tracker.bind(assignmentId);
    this.api.player(assignmentId).subscribe({
      next: (data) => {
        this.payload.set(data);
        this.syncProgress(data.progress);
        this.syncPageProgress(data.pageProgress ?? []);
        this.activeLessonId.set(data.resumeLessonId || data.lessons[0]?.id || null);
        if (this.activeLessonId()) {
          this.tracker.track('LESSON_OPENED', this.activeLessonId()!);
          this.bindPageEngineForActiveLesson();
        }
        this.loading.set(false);
        this.startTrackingHooks();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Unable to open course');
      },
    });
  }

  ngOnDestroy(): void {
    this.pageEngine.unbind();
    this.stopTrackingHooks();
    this.tracker.flush();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement)?.isContentEditable) {
      return;
    }

    if (event.key === 'ArrowLeft' && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void this.goPrevPage();
      return;
    }
    if (event.key === 'ArrowRight' && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      if (this.activeLesson()?.type === 'PDF' && !this.pageEngine.forwardUnlocked()) {
        return;
      }
      void this.goNextPage();
      return;
    }
    if (event.key === '[' || (event.key === 'ArrowLeft' && event.altKey)) {
      event.preventDefault();
      this.goPrev();
      return;
    }
    if (event.key === ']' || (event.key === 'ArrowRight' && event.altKey)) {
      event.preventDefault();
      this.goNext();
      return;
    }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const input = document.querySelector<HTMLInputElement>('.header-search input');
      input?.focus();
      return;
    }
    if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void this.toggleFullscreen();
    }
  }

  mediaUrl(lesson: PlayerLessonDto): string | null {
    return this.protectedMedia.resolveMediaUrl(lesson.contentMedia);
  }

  onViewerFullscreen(active: boolean): void {
    if (!active) {
      this.protection.notifyFullscreenExit();
    }
  }

  chapterStart(lesson: PlayerLessonDto): number | null {
    const c = lesson.quizConfig;
    if (!c || c['kind'] !== 'PDF_CHAPTER') return null;
    return Number(c['pageStart']) || null;
  }

  chapterEnd(lesson: PlayerLessonDto): number | null {
    const c = lesson.quizConfig;
    if (!c || c['kind'] !== 'PDF_CHAPTER') return null;
    return Number(c['pageEnd']) || null;
  }

  /** Never surface uploaded filenames — prefer authoring title, else a learning label. */
  displayLessonTitle(lesson: PlayerLessonDto | null): string {
    if (!lesson) return '';
    const original = lesson.contentMedia?.originalName?.trim() ?? '';
    let title = (lesson.title ?? '').trim();

    if (original && this.sameAsFilename(title, original)) {
      title = '';
    }
    title = title.replace(/\.(pdf|docx?|pptx?|xlsx?|mp4|webm|mov)$/i, '').trim();

    if (!title) {
      if (lesson.type === 'QUIZ') return 'Quiz';
      if (lesson.type === 'VIDEO') return 'Video';
      return 'Reading';
    }
    return title;
  }

  lessonStatus(lessonId: string): string {
    return this.progressMap()[lessonId]?.status ?? 'NOT_STARTED';
  }

  toggleOutline(): void {
    this.outlineOpen.update((v) => !v);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.syncOverlayMode();
  }

  selectLesson(lessonId: string): void {
    if (this.isLessonLockedById(lessonId)) return;
    this.viewMode.set('lesson');
    this.activeLessonId.set(lessonId);
    this.tracker.track('LESSON_OPENED', lessonId);
    this.pdfCanPrev.set(false);
    this.pdfCanNext.set(false);
    this.bindPageEngineForActiveLesson();
    if (this.outlineOverlay()) {
      this.outlineOpen.set(false);
    }
  }

  isLessonLocked(lesson: PlayerLessonDto): boolean {
    return this.isLessonLockedById(lesson.id);
  }

  canOpenAssessment(lesson: PlayerLessonDto): boolean {
    return !this.isLessonLocked(lesson) && this.lessonStatus(lesson.id) === 'COMPLETED' && !!lesson.assessment;
  }

  openAssessment(lessonId: string): void {
    const lesson = this.payload()?.lessons.find((item) => item.id === lessonId);
    if (!lesson || !this.canOpenAssessment(lesson)) return;
    this.activeLessonId.set(lessonId);
    this.viewMode.set('assessment');
  }

  assessmentOutlineMeta(assessment: NonNullable<PlayerLessonDto['assessment']>): string {
    if (assessment.state === 'passed') return 'Passed';
    if (assessment.state === 'failed') return 'Not passed';
    if (assessment.state === 'exhausted') return 'Attempts exhausted';
    if (assessment.lockReason) return assessment.lockReason;
    return `${assessment.questionCount} questions · Pass ${assessment.passingScore}%`;
  }

  assessmentOutlineBadge(assessment: NonNullable<PlayerLessonDto['assessment']>): string {
    if (assessment.state === 'passed') return 'Passed';
    if (assessment.state === 'failed') return 'Try again';
    if (assessment.state === 'exhausted') return 'Attempts exhausted';
    if (assessment.state === 'locked') return assessment.lockReason || 'Locked';
    return 'Start';
  }

  outlineItemTitle(lesson: PlayerLessonDto): string {
    return this.displayLessonTitle(lesson);
  }

  outlineItemMeta(lesson: PlayerLessonDto): string {
    if (lesson.type === 'PDF') {
      const total = this.lessonPageTotal(lesson);
      return total ? `${total} pages` : 'PDF';
    }
    if (lesson.type === 'VIDEO') {
      if (lesson.durationSeconds) {
        const mins = Math.max(1, Math.round(lesson.durationSeconds / 60));
        return `${mins} min`;
      }
      const watched = Math.round(this.progressMap()[lesson.id]?.watchPercentage ?? 0);
      return watched ? `${watched}% watched` : 'Video';
    }
    return lesson.type;
  }

  lessonPageTotal(lesson: PlayerLessonDto): number | null {
    const start = this.chapterStart(lesson);
    const end = this.chapterEnd(lesson);
    if (start && end) return end - start + 1;
    return this.progressMap()[lesson.id]?.totalPages ?? null;
  }

  hasPrev(): boolean {
    return this.activeIndex() > 0;
  }

  hasNext(): boolean {
    const total = this.payload()?.lessons.length ?? 0;
    return this.activeIndex() < total - 1;
  }

  goPrev(): void {
    const lessons = this.payload()?.lessons ?? [];
    const prev = lessons[this.activeIndex() - 1];
    if (prev) this.selectLesson(prev.id);
  }

  goNext(): void {
    if (!this.canGoNextLesson()) return;
    const lessons = this.payload()?.lessons ?? [];
    const next = lessons[this.activeIndex() + 1];
    if (next && !this.isLessonLocked(next)) this.selectLesson(next.id);
  }

  canGoNextLesson(): boolean {
    if (!this.hasNext()) return false;
    const lessons = this.payload()?.lessons ?? [];
    const next = lessons[this.activeIndex() + 1];
    if (next && this.isLessonLocked(next)) return false;
    const lesson = this.activeLesson();
    if (!lesson || lesson.type !== 'PDF') return true;
    if (this.lessonStatus(lesson.id) === 'COMPLETED') return true;
    return this.pageEngine.forwardUnlocked() && this.isLastPageInChapter();
  }

  canPrevPage(): boolean {
    return this.activeLesson()?.type === 'PDF' && this.pdfCanPrev();
  }

  canNextPage(): boolean {
    return (
      this.activeLesson()?.type === 'PDF' &&
      this.pdfCanNext() &&
      this.pageEngine.forwardUnlocked()
    );
  }

  canMarkComplete(): boolean {
    const lesson = this.activeLesson();
    if (!lesson || this.lessonStatus(lesson.id) === 'COMPLETED') return false;
    if (lesson.type === 'PDF') {
      return this.pageEngine.forwardUnlocked() && this.isLastPageInChapter();
    }
    if (lesson.type === 'VIDEO') {
      const threshold = this.payload()?.videoCompletionPercent ?? 90;
      return (this.currentProgress()?.watchPercentage ?? 0) >= threshold;
    }
    return false;
  }

  pdfRelativePage(): number {
    const lesson = this.activeLesson();
    if (!lesson) return this.pageEngine.pageNumber();
    const start = this.chapterStart(lesson) || 1;
    return this.pageEngine.pageNumber() - start + 1;
  }

  pdfChapterTotal(): number | null {
    const lesson = this.activeLesson();
    if (!lesson) return null;
    const start = this.chapterStart(lesson);
    const end = this.chapterEnd(lesson);
    if (start && end) return end - start + 1;
    return this.currentProgress()?.totalPages ?? null;
  }

  fullscreenPageLabel(): string {
    const total = this.pdfChapterTotal();
    if (!total) return `Page ${this.pdfRelativePage()}`;
    return `Page ${this.pdfRelativePage()} / ${total}`;
  }

  videoWatchLabel(): string {
    return `${Math.round(this.currentProgress()?.watchPercentage ?? 0)}% watched`;
  }

  isLastPageInChapter(): boolean {
    const lesson = this.activeLesson();
    if (!lesson) return false;
    const end = this.chapterEnd(lesson);
    if (end) return this.pageEngine.pageNumber() >= end;
    const total = this.currentProgress()?.totalPages;
    return total != null && this.pageEngine.pageNumber() >= total;
  }

  async goPrevPage(): Promise<void> {
    if (this.activeLesson()?.type !== 'PDF') return;
    await this.pdfViewer()?.prev();
    this.syncPdfNav();
  }

  async goNextPage(): Promise<void> {
    if (this.activeLesson()?.type !== 'PDF') return;
    if (!this.pageEngine.forwardUnlocked()) return;
    await this.pdfViewer()?.next();
    this.syncPdfNav();
  }

  async runSearch(): Promise<void> {
    if (this.activeLesson()?.type !== 'PDF') return;
    await this.pdfViewer()?.runSearch(this.searchQuery);
  }

  async toggleFullscreen(): Promise<void> {
    if (this.activeLesson()?.type === 'VIDEO') {
      await this.videoPlayer()?.toggleFullscreen();
      return;
    }
    await this.pdfViewer()?.toggleFullscreen();
  }

  completeLesson(): void {
    const assignmentId = this.payload()?.assignment.id;
    const lessonId = this.activeLessonId();
    if (!assignmentId || !lessonId || this.completingLesson) return;
    if (this.lessonStatus(lessonId) === 'COMPLETED') return;
    this.completingLesson = true;
    this.api.completeLesson(assignmentId, lessonId).subscribe({
      next: (res) => {
        this.completingLesson = false;
        this.payload.update((p) =>
          p ? { ...p, assignment: { ...p.assignment, ...res.assignment } } : p,
        );
        this.progressMap.update((map) => ({
          ...map,
          [lessonId]: res.progress,
        }));
        this.handleProgramEvent(res.assignment.programEvent);
        const lesson = this.activeLesson();
        if (lesson?.assessment) {
          this.api.player(assignmentId).subscribe({
            next: (payload) => {
              this.payload.set(payload);
              this.syncProgress(payload.progress);
              this.viewMode.set('assessment');
            },
          });
        }
      },
      error: (err) => {
        this.completingLesson = false;
        this.error.set(err?.error?.error?.message ?? 'Could not complete lesson');
      },
    });
  }

  onAssessmentCompleted(_result: QuizSubmitResult): void {
    this.handleProgramEvent(_result.programEvent);
    const assignmentId = this.payload()?.assignment.id;
    if (!assignmentId) return;
    this.api.player(assignmentId).subscribe({
      next: (payload) => {
        this.payload.set(payload);
        this.syncProgress(payload.progress);
      },
    });
  }

  goNextAfterAssessment(): void {
    this.viewMode.set('lesson');
    this.goNext();
  }

  private handleProgramEvent(
    event?: {
      newlyCompletedLevelId: string | null;
      newlyCompletedLevelTitle: string | null;
      nextLevelTitle: string | null;
      programJustCompleted: boolean;
    } | null,
  ): void {
    if (!event?.newlyCompletedLevelTitle) return;
    this.completedLevelTitle = event.newlyCompletedLevelTitle;
    this.nextLevelTitle = event.nextLevelTitle ?? '';
    this.levelCompleteVisible = true;
    sessionStorage.setItem('zebl-level-complete', JSON.stringify(event));
  }

  onPdfPage(event: {
    currentPage: number;
    totalPages: number;
    visitedPages: number[];
  }): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('PAGE_VIEW', lessonId, event);
    this.tracker.track('RESUME_POSITION', lessonId, event);
    this.pageEngine.setTotalPages(event.totalPages);
    this.syncPdfNav();
  }

  onPdfPageLoaded(event: { currentPage: number; totalPages: number }): void {
    this.pageEngine.onPageLoaded(event.currentPage, event.totalPages);
    this.syncPdfNav();
    if (this.canMarkComplete()) {
      this.completeLesson();
    }
  }

  onPdfScroll(pct: number): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('SCROLL', lessonId, { scrollPercentage: pct });
  }

  onVideoPlay(event: { currentTime: number; playbackSpeed: number }): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('VIDEO_PLAY', lessonId, event);
  }

  onVideoPause(event: {
    currentTime: number;
    watchPercentage: number;
    playbackSpeed: number;
  }): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('VIDEO_PAUSE', lessonId, event);
  }

  onVideoSeek(event: { currentTime: number; watchPercentage: number }): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('VIDEO_SEEK', lessonId, event);
  }

  onVideoSpeed(event: { playbackSpeed: number }): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('VIDEO_SPEED', lessonId, event);
  }

  onVideoProgress(event: {
    currentTime: number;
    watchPercentage: number;
    playbackSpeed: number;
  }): void {
    const lessonId = this.activeLessonId();
    if (!lessonId) return;
    this.tracker.track('VIDEO_PROGRESS', lessonId, event);
    this.progressMap.update((map) => {
      const current = map[lessonId];
      if (!current) return map;
      return {
        ...map,
        [lessonId]: { ...current, watchPercentage: event.watchPercentage, resumePositionSec: event.currentTime },
      };
    });
    if (this.canMarkComplete()) {
      this.completeLesson();
    }
  }

  private syncOverlayMode(): void {
    const overlay = window.matchMedia('(max-width: 1100px)').matches;
    this.outlineOverlay.set(overlay);
  }

  private isLessonLockedById(lessonId: string): boolean {
    const lessons = this.payload()?.lessons ?? [];
    const completed = new Set(
      lessons
        .filter((lesson) => this.lessonStatus(lesson.id) === 'COMPLETED')
        .map((lesson) => lesson.id),
    );
    const passed = new Set(
      lessons.filter((lesson) => lesson.assessment?.passed).map((lesson) => lesson.id),
    );
    return isLessonSequentiallyLocked(
      lessons.map((lesson) => ({ id: lesson.id, hasAssessment: !!lesson.assessment })),
      lessonId,
      completed,
      passed,
    );
  }

  private sameAsFilename(title: string, originalName: string): boolean {
    const norm = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/\.(pdf|docx?|pptx?|xlsx?|mp4|webm|mov)$/i, '');
    return norm(title) === norm(originalName) || title.trim() === originalName.trim();
  }

  private syncPdfNav(): void {
    const viewer = this.pdfViewer();
    this.pdfCanPrev.set(viewer?.canPrevPage() ?? false);
    this.pdfCanNext.set(
      (viewer?.canNextPage() ?? false) && this.pageEngine.forwardUnlocked(),
    );
  }

  private syncProgress(progress: LessonProgressDto[]): void {
    const map: Record<string, LessonProgressDto> = {};
    for (const row of progress) {
      map[row.lessonId] = row;
    }
    this.progressMap.set(map);
  }

  private syncPageProgress(pages: PageProgressDto[]): void {
    const map: Record<string, PageProgressDto[]> = {};
    for (const row of pages) {
      const list = map[row.lessonId] ?? [];
      list.push(row);
      map[row.lessonId] = list;
    }
    this.pageProgressByLesson.set(map);
  }

  private bindPageEngineForActiveLesson(): void {
    const payload = this.payload();
    const lesson = this.activeLesson();
    if (!payload || !lesson) return;

    if (lesson.type !== 'PDF') {
      this.pageEngine.unbind();
      return;
    }

    const assignmentId = payload.assignment.id;
    const pageStart = this.chapterStart(lesson) || 1;
    const pageEnd = this.chapterEnd(lesson);
    const pages = this.pageProgressByLesson()[lesson.id] ?? [];
    const required =
      payload.requiredSecondsPerPage ??
      pages[0]?.requiredSeconds ??
      60;

    this.pageEngine.bind({
      assignmentId,
      lessonId: lesson.id,
      pageStart,
      pageEnd,
      requiredSeconds: required,
      pages,
    });

    this.api.resumePdfLesson(assignmentId, lesson.id).subscribe({
      next: (resume) => {
        this.pageEngine.hydrateFromServer(
          resume.pages,
          resume.requiredSecondsPerPage,
        );
        this.pageProgressByLesson.update((m) => ({
          ...m,
          [lesson.id]: resume.pages,
        }));
        this.pdfInitialPage.set(resume.lastPage || pageStart);
        if (resume.lessonProgress) {
          this.progressMap.update((map) => ({
            ...map,
            [lesson.id]: resume.lessonProgress!,
          }));
        }
      },
      error: () => {
        const hint =
          this.progressMap()[lesson.id]?.currentPage ||
          pageStart;
        this.pdfInitialPage.set(hint);
      },
    });
  }

  private startTrackingHooks(): void {
    this.readingTimer = setInterval(() => {
      const lessonId = this.activeLessonId();
      if (!lessonId || this.hidden || this.blurred || this.idleStartedAt) return;
      this.tracker.track('READING_TIME', lessonId, { deltaSeconds: 5 });
    }, 5000);

    const onVisibility = () => {
      const lessonId = this.activeLessonId();
      if (document.hidden) {
        this.hidden = true;
        this.tabHidden.set(true);
        if (lessonId) this.tracker.track('TAB_HIDDEN', lessonId);
      } else {
        this.hidden = false;
        this.tabHidden.set(false);
        if (lessonId) this.tracker.track('TAB_VISIBLE', lessonId);
      }
    };

    const onBlur = () => {
      this.blurred = true;
      const lessonId = this.activeLessonId();
      if (lessonId) this.tracker.track('WINDOW_BLUR', lessonId);
      this.beginIdle(lessonId);
    };

    const onFocus = () => {
      this.blurred = false;
      const lessonId = this.activeLessonId();
      if (lessonId) this.tracker.track('WINDOW_FOCUS', lessonId);
      this.endIdle(lessonId);
    };

    const onActivity = () => {
      const lessonId = this.activeLessonId();
      this.endIdle(lessonId);
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => this.beginIdle(lessonId), 30000);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);

    (this as unknown as { _cleanup?: () => void })._cleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }

  private stopTrackingHooks(): void {
    if (this.readingTimer) clearInterval(this.readingTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    (this as unknown as { _cleanup?: () => void })._cleanup?.();
  }

  private beginIdle(lessonId: string | null): void {
    if (this.idleStartedAt || !lessonId) return;
    this.idleStartedAt = Date.now();
    this.tracker.track('IDLE_START', lessonId);
  }

  private endIdle(lessonId: string | null): void {
    if (!this.idleStartedAt || !lessonId) return;
    const deltaSeconds = Math.round((Date.now() - this.idleStartedAt) / 1000);
    this.idleStartedAt = null;
    this.tracker.track('IDLE_END', lessonId, { deltaSeconds });
  }
}
