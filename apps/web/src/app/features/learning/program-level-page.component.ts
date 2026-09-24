import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type {
  LearnerLevelCourseDetail,
  LearnerLevelDetail,
  LearnerLevelLessonDetail,
} from '../../core/models/program.models';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { programRoute } from '../../shared/utils/program-progress.util';

@Component({
  selector: 'app-program-level-page',
  standalone: true,
  imports: [PageHeaderComponent, LoadingStateComponent, RouterLink, Button, Message],
  template: `
    @if (detail(); as view) {
      <a [routerLink]="programRoute(view.programId)" class="back">← Back to {{ view.programName }}</a>
    } @else {
      <a routerLink="/app/my-learning" class="back">← Back to My Learning</a>
    }

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-3" />
    }
    @if (loading()) {
      <app-loading-state message="Loading level…" />
    } @else if (detail(); as view) {
      <app-page-header
        [title]="heading(view)"
        [subtitle]="levelSubtitle(view)"
      />

      @if (view.level.locked) {
        <p-message
          severity="warn"
          [text]="'🔒 Level Locked. ' + (view.unlockHint || 'Complete the previous level to unlock this level.')"
          styleClass="w-full mb-3"
        />
      }

      <div class="courses" role="list">
        @for (course of view.courses; track course.levelCourseId; let i = $index) {
          <article class="course-card" [class.locked]="course.isLocked" role="listitem">
            <div class="course-main">
              <p class="mark">
                @if (course.isLocked) { 🔒 }
                @else if (course.completed) { ✓ }
                @else if (course.status === 'IN_PROGRESS') { ● }
                @else { ○ }
                <span class="day">Day {{ i + 1 }}</span>
              </p>
              <h3>{{ course.title }}</h3>
              <p class="muted">
                @if (course.isLocked) { Locked }
                @else if (course.completed) { Completed }
                @else if (course.status === 'IN_PROGRESS') { In Progress · {{ course.progress }}% }
                @else { Not Started }
                · {{ course.isRequired ? 'Required' : 'Optional' }}
                @if (courseMeta(course); as meta) {
                  · {{ meta }}
                }
              </p>
              @if (course.description && !course.isLocked) {
                <p class="muted">{{ course.description }}</p>
              }
              @if (course.lessons?.length) {
                <ul class="lessons">
                  @for (lesson of course.lessons; track lesson.id) {
                    <li>
                      <span class="lesson-type">{{ lessonTypeLabel(lesson) }}</span>
                      <span class="lesson-title">{{ lesson.title }}</span>
                      @if (lessonDuration(lesson); as duration) {
                        <span class="lesson-duration">{{ duration }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
            @if (course.isLocked) {
              <p-button label="Locked" [disabled]="true" size="small" />
            } @else if (!course.assignmentId) {
              <p-button label="Unavailable" [disabled]="true" size="small" />
            } @else if (course.completed) {
              <a [routerLink]="['/app/learn', course.assignmentId]" [queryParams]="returnParams()" class="no-underline">
                <p-button label="View" size="small" />
              </a>
            } @else if (course.status === 'IN_PROGRESS') {
              <a [routerLink]="['/app/learn', course.assignmentId]" [queryParams]="returnParams()" class="no-underline">
                <p-button label="Continue" size="small" />
              </a>
            } @else {
              <a [routerLink]="['/app/learn', course.assignmentId]" [queryParams]="returnParams()" class="no-underline">
                <p-button label="Start" size="small" />
              </a>
            }
          </article>
        } @empty {
          <div class="empty">
            <p class="empty-title">No courses in this level yet</p>
            <p class="muted">Ask your admin to add Day / course content to this level.</p>
          </div>
        }
      </div>

      @if (view.level.isFinal && view.level.finalAssessment) {
        <section class="final">
          <div>
            <h3>{{ view.level.finalAssessment.title || 'Final assessment' }}</h3>
            <p class="muted">Complete required courses, then pass the final assessment.</p>
          </div>
          @if (view.level.finalAssessment.passed) {
            <span class="ok">Passed</span>
          } @else if (view.level.finalAssessment.available) {
            <a [routerLink]="['/app/programs', view.programId, 'final-assessment']" class="no-underline">
              <p-button label="Start final assessment" size="small" />
            </a>
          } @else {
            <p-button label="Locked" [disabled]="true" size="small" />
          }
        </section>
      }
    }
  `,
  styles: [
    `
      .back {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        margin-bottom: var(--s3);
        color: var(--ctp-primary);
        text-decoration: none;
      }
      .courses { display: grid; gap: 12px; }
      .course-card, .final {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 16px;
        min-height: 88px;
        background: var(--ctp-surface, #fff);
      }
      .course-card.locked { opacity: 0.85; background: #fafafa; }
      .course-main { min-width: 0; flex: 1; }
      .mark {
        margin: 0;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--ctp-muted);
      }
      .day {
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ctp-ink, #0f172a);
      }
      h3 { margin: 4px 0 0; font-size: 16px; }
      .muted { color: var(--ctp-muted); font-size: 13px; margin: 4px 0 0; }
      .lessons {
        list-style: none;
        margin: 12px 0 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .lessons li {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 8px 10px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--ctp-border) 35%, transparent);
        font-size: 13px;
      }
      .lesson-type {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ctp-primary);
      }
      .lesson-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lesson-duration { color: var(--ctp-muted); white-space: nowrap; }
      .ok { color: #157347; font-weight: 600; }
      .final { margin-top: var(--s4); align-items: center; }
      .empty {
        border: 1px dashed var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 24px 16px;
        text-align: center;
      }
      .empty-title { margin: 0; font-weight: 600; }
      :host ::ng-deep .p-button { min-height: 44px; }
      @media (max-width: 720px) {
        .courses { display: flex; flex-direction: column; }
        .course-card, .final { flex-direction: column; align-items: stretch; }
        .lessons li { grid-template-columns: auto 1fr; }
        .lesson-duration { grid-column: 2; }
      }
    `,
  ],
})
export class ProgramLevelPageComponent implements OnInit {
  private readonly api = inject(ProgramsApiService);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<LearnerLevelDetail | null>(null);
  programRoute = programRoute;

  ngOnInit(): void {
    const programId = this.route.snapshot.paramMap.get('programId') ?? '';
    const levelId = this.route.snapshot.paramMap.get('levelId') ?? '';
    this.api.myLevel(programId, levelId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Level not found');
      },
    });
  }

  heading(view: LearnerLevelDetail): string {
    if (view.level.isFinal) return `Final Level — ${view.level.title}`;
    return `Level ${view.level.number} — ${view.level.title}`;
  }

  levelSubtitle(view: LearnerLevelDetail): string {
    const courses = view.courses.length;
    const videos = view.courses.reduce((sum, course) => sum + (course.videoCount || 0), 0);
    const lessons = view.courses.reduce((sum, course) => sum + (course.lessonCount || 0), 0);
    const courseLabel = `${courses} ${courses === 1 ? 'Course' : 'Courses'}`;
    if (videos > 0) return `${courseLabel} · ${videos} ${videos === 1 ? 'Video' : 'Videos'}`;
    if (lessons > 0) return `${courseLabel} · ${lessons} ${lessons === 1 ? 'Lesson' : 'Lessons'}`;
    return courseLabel;
  }

  courseMeta(course: LearnerLevelCourseDetail): string | null {
    if (course.videoCount > 0 && course.lessonCount === course.videoCount) {
      return `${course.videoCount} ${course.videoCount === 1 ? 'video' : 'videos'}`;
    }
    if (course.lessonCount > 0) {
      return `${course.lessonCount} ${course.lessonCount === 1 ? 'lesson' : 'lessons'}`;
    }
    return null;
  }

  lessonTypeLabel(lesson: LearnerLevelLessonDetail): string {
    if (lesson.type === 'VIDEO') return 'Video';
    if (lesson.type === 'PDF') return 'PDF';
    return lesson.type || 'Lesson';
  }

  lessonDuration(lesson: LearnerLevelLessonDetail): string | null {
    if (!lesson.durationSeconds || lesson.durationSeconds < 1) return null;
    const minutes = Math.max(1, Math.round(lesson.durationSeconds / 60));
    return `${minutes} min`;
  }

  returnParams() {
    const view = this.detail();
    if (!view) return {};
    return { programId: view.programId, levelId: view.level.id };
  }
}
