import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Dialog } from 'primeng/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LearningApiService } from '../../core/http/learning-api.service';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type { CourseAssignmentDto, LearningDashboardDto } from '../../core/models/domain.models';
import type { LearnerLevelSummary, ProgramProgressView } from '../../core/models/program.models';
import {
  currentProgramLevel,
  levelEyebrow,
  levelLabel,
  levelRoute,
  programRoute,
  standaloneAssignments,
} from '../../shared/utils/program-progress.util';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-my-learning-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatCardComponent,
    StatusBadgeComponent,
    RouterLink,
    Button,
    Message,
    Dialog,
    DatePipe,
  ],
  template: `
    <app-page-header title="My Learning" subtitle="Learning programs first. Standalone courses stay separate." />

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
    }

    @if (loading()) {
      <app-loading-state message="Loading your assignments…" />
    } @else {
      <div class="ctp-kpi-grid mb">
        <app-stat-card label="Assigned" [value]="dash().total" icon="pi pi-bookmark" />
        <app-stat-card label="Not started" [value]="dash().notStarted" icon="pi pi-circle" tone="neutral" />
        <app-stat-card label="In progress" [value]="dash().inProgress" icon="pi pi-clock" tone="warning" />
        <app-stat-card label="Completed" [value]="dash().completed" icon="pi pi-check-circle" tone="success" />
      </div>

      @for (program of programs(); track program.enrollmentId) {
        <article class="ctp-card program">
          <header class="program-head">
            <div>
              <h2>
                <a [routerLink]="programRoute(program.programId)" class="program-link">{{ program.programName }}</a>
              </h2>
              <p class="progress-label">Overall Progress</p>
              <p class="progress-copy">
                {{ program.completedCourses }} / {{ program.totalCourses }} Courses Completed
              </p>
              @if (currentLevel(program); as current) {
                <p class="muted">Current: {{ levelLabel(current) }}</p>
              }
            </div>
            <app-status-badge [status]="program.status" />
          </header>
          <div class="bar"><span [style.width.%]="program.progressPercent"></span></div>

          @if (program.programCompleted && program.certificate) {
            <div class="complete-banner">
              <div>
                <strong>Congratulations!</strong>
                <p>You've completed {{ program.programName }} on {{ program.certificate.issuedAt | date: 'd MMMM y' }}.</p>
              </div>
              <a [routerLink]="['/app/programs', program.programId, 'certificate']" class="no-underline">
                <p-button label="View Certificate" size="small" />
              </a>
            </div>
          }

          <div class="levels">
            @for (level of program.levels; track level.id) {
              <a [routerLink]="levelRoute(program.programId, level.id)" class="level-card" [class.locked]="level.locked">
                <div>
                  <p class="eyebrow">{{ levelEyebrow(level) }}</p>
                  <h3>{{ level.title }}</h3>
                  <p class="muted">{{ levelMeta(level) }}</p>
                  <p class="muted">{{ levelCounts(level) }}</p>
                  <p class="state" [class.ok]="level.completed" [class.current]="level.status === 'CURRENT'" [class.lock]="level.locked">
                    {{ levelState(level) }}
                  </p>
                </div>
                <span class="open">View Level →</span>
              </a>
            }
          </div>
        </article>
      }

      @if (assignments().length) {
        <h2 class="section-title">Standalone courses</h2>
        <div class="grid">
          @for (item of assignments(); track item.id) {
            <article class="card ctp-card">
              <div class="card-top">
                @if (item.course.thumbnailMedia?.publicUrl) {
                  <img [src]="mediaUrl(item.course.thumbnailMedia!.publicUrl)" alt="" />
                } @else {
                  <div class="fallback">{{ item.course.title[0] }}</div>
                }
                <div>
                  <h3>{{ item.course.title }}</h3>
                  <p class="muted">{{ item.course.code }}</p>
                  <div class="tags">
                    <app-status-badge [status]="item.status" />
                    @if (item.isOverdue) {
                      <app-status-badge status="OVERDUE" />
                    }
                  </div>
                </div>
              </div>
              <div class="progress">
                <div class="bar"><span [style.width.%]="item.progressPercent"></span></div>
                <div class="pct">{{ item.progressPercent }}%</div>
              </div>
              <div class="card-actions">
                <a [routerLink]="['/app/learn', item.id]" class="no-underline">
                  <p-button
                    [label]="item.status === 'COMPLETED' ? 'Review' : item.status === 'NOT_STARTED' ? 'Start' : 'Continue'"
                    icon="pi pi-play"
                  />
                </a>
                @if (item.dueAt) {
                  <span class="muted">Due {{ item.dueAt | date: 'mediumDate' }}</span>
                }
              </div>
            </article>
          }
        </div>
      } @else if (!programs().length) {
        <p class="muted empty">No courses assigned yet. Contact your training administrator.</p>
      }
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
      .mb { margin-bottom: var(--ctp-section-gap); }
      .program { padding: 18px; margin-bottom: var(--ctp-section-gap); display: grid; gap: 12px; }
      .program-head { display: flex; justify-content: space-between; gap: 12px; }
      .program-link { color: inherit; text-decoration: none; }
      .program-link:hover { color: var(--ctp-primary); }
      .eyebrow { margin: 0; font-size: 14px; letter-spacing: 0.06em; color: var(--ctp-muted); font-weight: 600; }
      h2 { margin: 0 0 6px; font-size: 18px; line-height: 1.3; }
      .section-title { font-size: 18px; margin: var(--ctp-section-gap) 0 12px; }
      .progress-label { margin: 0; font-size: 13px; color: var(--ctp-muted); }
      .progress-copy { margin: 2px 0 0; font-size: 13px; font-weight: 600; }
      .levels { display: grid; gap: 12px; }
      .level-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 16px;
        min-height: 88px;
        text-decoration: none;
        color: inherit;
      }
      .level-card.locked { opacity: 0.9; background: #fafafa; }
      .open {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        min-width: 112px;
        padding: 0 12px;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }
      .complete-banner {
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 16px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }
      h3 { margin: 2px 0 0; font-size: 16px; }
      .muted { color: var(--ctp-muted); font-size: 13px; margin: 2px 0 0; }
      .state { font-size: 13px; font-weight: 600; margin: 6px 0 0; }
      .ok { color: #157347; }
      .current { color: var(--ctp-primary); }
      .lock { color: var(--ctp-muted); }
      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      @media (min-width: 721px) {
        .grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      }
      .card { padding: 16px; display: grid; gap: 12px; }
      .card-top { display: flex; gap: 12px; }
      .card-top img, .fallback {
        width: 40px; height: 40px; border-radius: var(--ctp-radius); object-fit: cover; flex-shrink: 0;
      }
      .fallback {
        display: grid; place-items: center; background: var(--ctp-primary-soft); color: var(--ctp-primary); font-weight: 700;
      }
      .tags { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
      .progress { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
      .bar { height: 4px; border-radius: 999px; background: var(--ctp-border); overflow: hidden; }
      .bar span { display: block; height: 100%; background: var(--ctp-primary); }
      .pct { font-size: 13px; color: var(--ctp-muted); }
      .card-actions { display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
      .empty { margin-top: 8px; }
      @media (max-width: 720px) {
        .program-head, .complete-banner, .level-card { flex-direction: column; align-items: stretch; }
        .open { width: 100%; }
        .levels, .grid { display: flex; flex-direction: column; }
      }
    `,
  ],
})
export class MyLearningPageComponent implements OnInit {
  private readonly api = inject(LearningApiService);
  private readonly programsApi = inject(ProgramsApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly assignments = signal<CourseAssignmentDto[]>([]);
  readonly programs = signal<ProgramProgressView[]>([]);
  readonly dash = signal<LearningDashboardDto>({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    recent: [],
  });

  levelCompleteVisible = false;
  completedLevelTitle = '';
  nextLevelTitle = '';

  ngOnInit(): void {
    this.api.dashboard().subscribe({
      next: (d) => this.dash.set(d),
    });
    forkJoin({
      assignments: this.api.myAssignments(),
      programs: this.programsApi.myPrograms(),
    }).subscribe({
      next: ({ assignments, programs }) => {
        this.programs.set(programs);
        this.assignments.set(standaloneAssignments(assignments, programs));
        this.loading.set(false);
        this.maybeShowStoredLevelComplete();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Failed to load assignments');
      },
    });
  }

  currentLevel = currentProgramLevel;
  levelLabel = levelLabel;
  levelEyebrow = levelEyebrow;
  levelRoute = levelRoute;
  programRoute = programRoute;

  levelMeta(level: LearnerLevelSummary): string {
    if (level.isFinal && level.finalAssessment) return 'Final Assessment';
    return `${level.courseCount} ${level.courseCount === 1 ? 'Course' : 'Courses'}`;
  }

  levelCounts(level: LearnerLevelSummary): string {
    if (level.isFinal && !level.courseCount) return '';
    return `${level.completedCourseCount} / ${level.courseCount} Completed`;
  }

  levelState(level: LearnerLevelSummary): string {
    if (level.locked) return '🔒 Locked';
    if (level.completed) return '✓ Completed';
    if (level.status === 'CURRENT') return '● Current';
    return '● Current';
  }

  mediaUrl(path: string): string {
    return path.startsWith('http') ? path : `${environment.mediaBaseUrl}${path}`;
  }

  private maybeShowStoredLevelComplete(): void {
    const raw = sessionStorage.getItem('zebl-level-complete');
    if (!raw) return;
    sessionStorage.removeItem('zebl-level-complete');
    try {
      const event = JSON.parse(raw) as { newlyCompletedLevelTitle?: string; nextLevelTitle?: string };
      if (event.newlyCompletedLevelTitle) {
        this.completedLevelTitle = event.newlyCompletedLevelTitle;
        this.nextLevelTitle = event.nextLevelTitle ?? '';
        this.levelCompleteVisible = true;
      }
    } catch {
      /* ignore */
    }
  }
}
