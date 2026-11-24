import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Dialog } from 'primeng/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { LearningApiService } from '../../core/http/learning-api.service';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type { CourseAssignmentDto, LearningDashboardDto } from '../../core/models/domain.models';
import type { ProgramProgressView } from '../../core/models/program.models';
import {
  levelRoute,
  programRoute,
  standaloneAssignments,
} from '../../shared/utils/program-progress.util';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-progress-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
    StatCardComponent,
    RouterLink,
    Button,
    Message,
    Dialog,
    DatePipe,
  ],
  template: `
    <app-page-header
      title="Progress"
      subtitle="Your training programs and courses."
    />

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-3" />
    }

    @if (loading()) {
      <app-loading-state message="Loading progress…" />
    } @else {
      <div class="ctp-kpi-grid mb">
        <app-stat-card label="Overall %" [value]="overall()" icon="pi pi-chart-pie" />
        <app-stat-card label="Completed" [value]="dash().completed" icon="pi pi-check-circle" tone="success" />
        <app-stat-card label="In progress" [value]="dash().inProgress" icon="pi pi-clock" tone="warning" />
        <app-stat-card label="Overdue" [value]="dash().overdue" icon="pi pi-exclamation-triangle" tone="danger" />
      </div>

      @if (!programs().length && !assignments().length) {
        <p class="muted empty">No training assigned yet. Contact your administrator.</p>
      } @else {
        <div class="tile-grid">
          @for (program of programs(); track program.enrollmentId) {
            <article class="tile program-tile">
              <div class="tile-top">
                <app-status-badge [status]="program.status" />
                <span class="levels-pill">{{ program.levels.length }} levels</span>
              </div>
              <h2>{{ program.programName }}</h2>
              <p class="muted">
                {{ program.completedCourses }} / {{ program.totalCourses }} courses · {{ program.progressPercent }}%
              </p>
              <div class="level-chips" aria-label="Levels">
                @for (level of program.levels; track level.id) {
                  <a
                    [routerLink]="levelRoute(program.programId, level.id)"
                    class="chip"
                    [class.locked]="level.locked"
                    [class.done]="level.completed"
                    [attr.aria-disabled]="level.locked ? true : null"
                    (click)="level.locked && $event.preventDefault()"
                  >
                    <i class="pi pi-play" aria-hidden="true"></i>
                    {{ level.isFinal ? 'Final' : 'L' + level.number }}
                  </a>
                }
              </div>
              <div class="bar"><span [style.width.%]="program.progressPercent"></span></div>
              <a
                [routerLink]="programRoute(program.programId)"
                class="no-underline start-wrap"
              >
                <p-button label="Start" icon="pi pi-play" size="small" />
              </a>
            </article>
          }

          @for (item of assignments(); track item.id) {
            <article class="tile course-tile" [class.locked]="item.isLocked">
              <div class="tile-top">
                <app-status-badge [status]="item.isLocked ? 'LOCKED' : item.status" />
                @if (item.dueAt) {
                  <span class="due">Due {{ item.dueAt | date: 'mediumDate' }}</span>
                }
              </div>
              <div class="course-head">
                @if (item.course.thumbnailMedia?.publicUrl) {
                  <img [src]="mediaUrl(item.course.thumbnailMedia!.publicUrl)" alt="" />
                } @else {
                  <div class="thumb">{{ item.course.title[0] }}</div>
                }
                <div>
                  <h2>{{ item.course.title }}</h2>
                  <p class="muted">{{ item.course.code }} · Course</p>
                </div>
              </div>
              <div class="bar"><span [style.width.%]="item.progressPercent"></span></div>
              <p class="muted pct">{{ item.progressPercent }}% complete</p>
              @if (item.isLocked) {
                <p-button label="Locked" size="small" [outlined]="true" [disabled]="true" icon="pi pi-lock" />
              } @else {
                <a [routerLink]="['/app/learn', item.id]" class="no-underline">
                  <p-button
                    [label]="item.status === 'COMPLETED' ? 'Review' : item.status === 'IN_PROGRESS' ? 'Continue' : 'Start'"
                    size="small"
                  />
                </a>
              }
            </article>
          }
        </div>
      }
    }

    <p-dialog header="Level Complete" [(visible)]="levelCompleteVisible" [modal]="true" [style]="{ width: 'min(420px, 94vw)' }">
      <p>{{ completedLevelTitle }} completed.</p>
      <p>You've completed all required courses in this level. The next level is unlocked.</p>
      @if (nextLevelTitle) {
        <p>Next: {{ nextLevelTitle }}</p>
      }
      <p-button label="Continue" (onClick)="levelCompleteVisible = false" />
    </p-dialog>
  `,
  styles: [
    `
      .mb { margin-bottom: var(--ctp-section-gap); }
      .muted { margin: 4px 0 0; color: var(--ctp-muted); font-size: 13px; }
      .empty { margin-top: 8px; }
      .tile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .tile {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 18px;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: #fff;
        text-decoration: none;
        color: inherit;
        min-height: 220px;
        box-sizing: border-box;
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }
      a.tile:hover {
        border-color: color-mix(in srgb, var(--ctp-primary) 45%, var(--ctp-border));
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      }
      .tile.locked { opacity: 0.92; background: #fafafa; }
      .tile-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .levels-pill, .due {
        font-size: 12px;
        font-weight: 600;
        color: var(--ctp-muted);
        letter-spacing: 0.02em;
      }
      h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.3;
      }
      .current {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--ctp-primary);
      }
      .level-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--ctp-border);
        background: #fff;
        color: var(--ctp-ink);
        text-decoration: none;
        min-height: 32px;
      }
      .chip i { font-size: 10px; }
      .chip:hover:not(.locked) {
        border-color: color-mix(in srgb, var(--ctp-primary) 40%, var(--ctp-border));
        color: var(--ctp-primary);
      }
      .chip.locked { color: var(--ctp-muted); background: #f3f4f6; pointer-events: none; }
      .chip.done { color: #157347; border-color: #b7e4c7; background: #edf7f0; }
      .start-wrap { margin-top: 4px; align-self: flex-start; }
      .current { display: none; }
      .cta { display: none; }
      .bar {
        height: 4px;
        border-radius: 999px;
        background: var(--ctp-border);
        overflow: hidden;
        margin-top: auto;
      }
      .bar span {
        display: block;
        height: 100%;
        background: var(--ctp-primary);
      }
      .cta {
        font-size: 13px;
        font-weight: 600;
        color: var(--ctp-primary);
      }
      .course-head {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .course-head img, .thumb {
        width: 44px;
        height: 44px;
        border-radius: var(--ctp-radius);
        object-fit: cover;
        flex-shrink: 0;
      }
      .thumb {
        display: grid;
        place-items: center;
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        font-weight: 700;
      }
      .pct { margin: 0; }
      @media (max-width: 720px) {
        .tile-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class ProgressPageComponent implements OnInit {
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

  levelRoute = levelRoute;
  programRoute = programRoute;

  mediaUrl(path: string): string {
    return path.startsWith('http') ? path : `${environment.mediaBaseUrl}${path}`;
  }

  overall(): number {
    const items = this.assignments();
    const programs = this.programs();
    if (!items.length && !programs.length) return 0;
    const values = [
      ...programs.map((p) => p.progressPercent || 0),
      ...items.map((a) => a.progressPercent || 0),
    ];
    return Math.round(values.reduce((s, n) => s + n, 0) / values.length);
  }

  ngOnInit(): void {
    this.api.dashboard().subscribe({ next: (d) => this.dash.set(d) });
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
        this.error.set(err?.error?.error?.message ?? 'Failed to load progress');
      },
    });
  }

  private maybeShowStoredLevelComplete(): void {
    const raw =
      sessionStorage.getItem('veb-level-complete') ??
      sessionStorage.getItem('zebl-level-complete');
    if (!raw) return;
    sessionStorage.removeItem('veb-level-complete');
    sessionStorage.removeItem('zebl-level-complete');
    try {
      const event = JSON.parse(raw) as {
        newlyCompletedLevelTitle?: string;
        nextLevelTitle?: string;
      };
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
