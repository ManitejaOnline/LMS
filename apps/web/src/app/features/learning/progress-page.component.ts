import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
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
  currentProgramLevel,
  levelLabel,
  levelRoute,
  programRoute,
  standaloneAssignments,
} from '../../shared/utils/program-progress.util';

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
    ProgressBar,
    Message,
    Dialog,
    DatePipe,
  ],
  template: `
    <app-page-header
      title="Progress"
      subtitle="Track completion across your mandatory training."
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

      @for (program of programs(); track program.enrollmentId) {
        <section class="ctp-card program mb">
          <div class="program-head">
            <div>
              <h2 class="ctp-section-title">
                <a [routerLink]="programRoute(program.programId)" class="program-link">{{ program.programName }}</a>
              </h2>
              <p class="muted">
                {{ program.completedCourses }} / {{ program.totalCourses }} courses · {{ program.progressPercent }}%
              </p>
              @if (currentLevel(program); as current) {
                <p class="muted">Current: {{ levelLabel(current) }}</p>
              }
            </div>
            <div class="program-actions">
              <app-status-badge [status]="program.status" />
              @if (currentLevel(program); as current) {
                <a [routerLink]="levelRoute(program.programId, current.id)" class="no-underline">
                  <p-button label="Continue" size="small" />
                </a>
              } @else {
                <a [routerLink]="programRoute(program.programId)" class="no-underline">
                  <p-button label="Open" size="small" [outlined]="true" />
                </a>
              }
            </div>
          </div>
          <div class="bar"><span [style.width.%]="program.progressPercent"></span></div>
        </section>
      }

      <section class="ctp-card panel">
        <h2 class="ctp-section-title">Course progress</h2>
        <table class="ctp-data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of assignments(); track item.id) {
              <tr>
                <td>
                  <div class="strong">{{ item.course.title }}</div>
                  <div class="ctp-muted tiny">{{ item.course.code }}</div>
                </td>
                <td><app-status-badge [status]="item.status" /></td>
                <td class="prog">
                  <p-progressBar [value]="item.progressPercent" [showValue]="false" styleClass="h-prog" />
                  <span>{{ item.progressPercent }}%</span>
                </td>
                <td>{{ item.dueAt ? (item.dueAt | date: 'mediumDate') : '—' }}</td>
                <td>
                  @if (item.isLocked) {
                    <p-button label="Locked" size="small" [outlined]="true" [disabled]="true" icon="pi pi-lock" />
                  } @else {
                    <a [routerLink]="['/app/learn', item.id]" class="no-underline">
                      <p-button label="Open" size="small" [outlined]="true" />
                    </a>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="ctp-muted">
                  {{ programs().length ? 'No standalone courses.' : 'No assigned courses yet.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
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
      .mb {
        margin-bottom: var(--ctp-section-gap);
      }
      .panel {
        padding: var(--ctp-card-pad);
      }
      .program {
        padding: var(--ctp-card-pad);
        display: grid;
        gap: 10px;
      }
      .program-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .program-link {
        color: inherit;
        text-decoration: none;
      }
      .program-link:hover {
        color: var(--ctp-primary);
      }
      .program-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .muted {
        margin: 2px 0 0;
        color: var(--ctp-muted);
        font-size: 13px;
      }
      .bar {
        height: 4px;
        border-radius: 999px;
        background: var(--ctp-border);
        overflow: hidden;
      }
      .bar span {
        display: block;
        height: 100%;
        background: var(--ctp-primary);
      }
      .strong {
        font-weight: 600;
        font-size: var(--ctp-fs-body);
      }
      .tiny {
        font-size: var(--ctp-fs-small);
      }
      .prog {
        display: flex;
        align-items: center;
        gap: var(--s2);
        min-width: 140px;
      }
      .prog span {
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
        min-width: 32px;
      }
      :host ::ng-deep .h-prog {
        height: 4px;
        flex: 1;
      }
      @media (max-width: 720px) {
        .program-head {
          flex-direction: column;
          align-items: stretch;
        }
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

  currentLevel = currentProgramLevel;
  levelLabel = levelLabel;
  levelRoute = levelRoute;
  programRoute = programRoute;

  overall(): number {
    const items = this.assignments();
    const programs = this.programs();
    if (!items.length && !programs.length) return 0;
    if (programs.length && !items.length) {
      const sum = programs.reduce((s, p) => s + (p.progressPercent || 0), 0);
      return Math.round(sum / programs.length);
    }
    if (!items.length) return 0;
    const sum = items.reduce((s, a) => s + (a.progressPercent || 0), 0);
    return Math.round(sum / items.length);
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
