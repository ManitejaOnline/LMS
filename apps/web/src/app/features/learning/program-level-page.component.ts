import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type { LearnerLevelDetail } from '../../core/models/program.models';
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
        [subtitle]="view.level.progress.totalCourses + ' Courses'"
      />

      @if (view.level.locked) {
        <p-message
          severity="warn"
          [text]="'🔒 Level Locked. ' + (view.unlockHint || 'Complete the previous level to unlock this level.')"
          styleClass="w-full mb-3"
        />
      }

      <div class="courses">
        @for (course of view.courses; track course.id) {
          <article class="course-card" [class.locked]="course.isLocked">
            <div>
              <p class="mark">
                @if (course.isLocked) { 🔒 }
                @else if (course.completed) { ✓ }
                @else if (course.status === 'IN_PROGRESS') { ● }
                @else { ○ }
              </p>
              <h3>{{ course.title }}</h3>
              <p class="muted">
                @if (course.isLocked) { Locked }
                @else if (course.completed) { Completed }
                @else if (course.status === 'IN_PROGRESS') { In Progress · {{ course.progress }}% }
                @else { Not Started }
                · {{ course.isRequired ? 'Required' : 'Optional' }}
              </p>
              @if (course.description && !course.isLocked) {
                <p class="muted">{{ course.description }}</p>
              }
            </div>
            @if (course.isLocked || !course.assignmentId) {
              <p-button label="Locked" [disabled]="true" size="small" />
            } @else if (course.completed) {
              <a [routerLink]="['/app/learn', course.assignmentId]" [queryParams]="returnParams()" class="no-underline">
                <p-button label="View Course" size="small" />
              </a>
            } @else if (course.status === 'IN_PROGRESS') {
              <a [routerLink]="['/app/learn', course.assignmentId]" [queryParams]="returnParams()" class="no-underline">
                <p-button label="Continue" size="small" />
              </a>
            } @else {
              <a [routerLink]="['/app/learn', course.assignmentId]" [queryParams]="returnParams()" class="no-underline">
                <p-button label="Start Course" size="small" />
              </a>
            }
          </article>
        } @empty {
          <p class="muted">No courses in this level.</p>
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
        align-items: center;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 16px;
        min-height: 88px;
      }
      .course-card.locked { opacity: 0.8; background: #fafafa; }
      .mark { margin: 0; font-size: 14px; }
      h3 { margin: 4px 0 0; font-size: 16px; }
      .muted { color: var(--ctp-muted); font-size: 13px; margin: 4px 0 0; }
      .ok { color: #157347; font-weight: 600; }
      .final { margin-top: var(--s4); }
      :host ::ng-deep .p-button { min-height: 44px; }
      @media (max-width: 720px) {
        .courses { display: flex; flex-direction: column; }
        .course-card, .final { flex-direction: column; align-items: stretch; }
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

  returnParams() {
    const view = this.detail();
    if (!view) return {};
    return { programId: view.programId, levelId: view.level.id };
  }
}
