import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { CoursesApiService } from '../../core/http/courses-api.service';
import { LearningApiService } from '../../core/http/learning-api.service';
import { ReportsApiService } from '../../core/http/reports-api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import type { CourseDto } from '../../core/models/domain.models';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    RouterLink,
    Button,
    DatePipe,
  ],
  template: `
    <app-page-header
      [title]="dashboardTitle()"
      [subtitle]="dashboardSubtitle()"
    />

    @if (isCourseAdmin()) {
      <div class="ctp-kpi-grid mb">
        <app-stat-card
          label="Courses"
          [value]="kpi().courses"
          icon="pi pi-folder"
          tone="primary"
        />
        <app-stat-card
          label="Employees"
          [value]="kpi().users"
          icon="pi pi-users"
          tone="neutral"
        />
        <app-stat-card
          label="In progress"
          [value]="kpi().inProgress"
          icon="pi pi-clock"
          tone="warning"
        />
        <app-stat-card
          label="Completed"
          [value]="kpi().completed"
          icon="pi pi-check-circle"
          tone="success"
        />
      </div>

      <div class="dash-grid">
        <section class="ctp-card panel">
          <div class="panel-head">
            <h2 class="ctp-section-title">Recent courses</h2>
            <a routerLink="/app/courses" class="link">View all</a>
          </div>
          <div class="table-pad">
            <table class="ctp-data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of recentCourses(); track c.id) {
                  <tr>
                    <td>
                      <div class="course-cell">
                        <span class="file-icon" aria-hidden="true"><i class="pi pi-file-pdf"></i></span>
                        <div>
                          <div class="strong">{{ c.title }}</div>
                          <div class="ctp-muted tiny">{{ c.code }}</div>
                        </div>
                      </div>
                    </td>
                    <td>{{ c.createdAt | date: 'MMM d, y' }}</td>
                    <td><app-status-badge [status]="c.status" /></td>
                    <td>
                      <a [routerLink]="['/app/courses', c.id]" class="link">Open</a>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="ctp-muted">No courses yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <div class="side-col">
          <section class="ctp-card panel">
            <h2 class="ctp-section-title">Enrollment overview</h2>
            <div class="legend">
              <div class="legend-row">
                <span class="dot success"></span> Completed
                <strong>{{ kpi().completionRate }}%</strong>
              </div>
              <div class="legend-row">
                <span class="dot warn"></span> Overdue
                <strong>{{ kpi().overdue }}</strong>
              </div>
              <div class="legend-row">
                <span class="dot info"></span> Assignments
                <strong>{{ kpi().assignments }}</strong>
              </div>
              <div class="legend-row">
                <span class="dot neutral"></span> Quiz attempts
                <strong>{{ kpi().quizAttempts }}</strong>
              </div>
            </div>
            <div class="ring" [style.--pct]="kpi().completionRate">
              <span>{{ kpi().completionRate }}%</span>
            </div>
          </section>

          <section class="ctp-card panel">
            <h2 class="ctp-section-title">Quick links</h2>
            <div class="links">
              <a routerLink="/app/courses" class="ql">Courses</a>
              <a routerLink="/app/users" class="ql">Employees</a>
              <a routerLink="/app/reports" class="ql">Reports</a>
              <a routerLink="/app/my-learning" class="ql">Assignments</a>
            </div>
          </section>
        </div>
      </div>
    }

    @if (isManagerOnly()) {
      <div class="ctp-kpi-grid mb">
        <app-stat-card label="Team size" [value]="asNum(managerMetrics()?.['teamSize'])" icon="pi pi-users" />
        <app-stat-card
          label="Open"
          [value]="asNum(managerMetrics()?.['openAssignments'])"
          icon="pi pi-clock"
          tone="warning"
        />
        <app-stat-card
          label="Completed"
          [value]="asNum(managerMetrics()?.['completedAssignments'])"
          icon="pi pi-check-circle"
          tone="success"
        />
        <app-stat-card
          label="Overdue"
          [value]="asNum(managerMetrics()?.['overdue'])"
          icon="pi pi-exclamation-triangle"
          tone="danger"
        />
      </div>
      <section class="ctp-card panel">
        <div class="panel-head">
          <h2 class="ctp-section-title">Team reports</h2>
          <a routerLink="/app/reports" class="link">Open reports</a>
        </div>
        <p class="ctp-muted">Track employee progress and overdue mandatory training.</p>
      </section>
    }

    @if (isEmployee()) {
      <div class="ctp-kpi-grid mb">
        <app-stat-card label="Assigned" [value]="employeeStats().assigned" icon="pi pi-bookmark" />
        <app-stat-card
          label="In progress"
          [value]="employeeStats().inProgress"
          icon="pi pi-clock"
          tone="warning"
        />
        <app-stat-card
          label="Completed"
          [value]="employeeStats().completed"
          icon="pi pi-check-circle"
          tone="success"
        />
        <app-stat-card
          label="Overdue"
          [value]="employeeStats().overdue"
          icon="pi pi-exclamation-triangle"
          tone="danger"
        />
      </div>
      <section class="ctp-card panel cta">
        <div>
          <h2 class="ctp-section-title">Continue learning</h2>
          <p class="ctp-muted">Open your assigned courses and resume where you left off.</p>
        </div>
        <a routerLink="/app/my-learning" class="no-underline">
          <p-button label="Go to assignments" icon="pi pi-arrow-right" iconPos="right" />
        </a>
      </section>
    }
  `,
  styles: [
    `
      .mb {
        margin-bottom: var(--ctp-section-gap);
      }
      .dash-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr);
        gap: var(--ctp-section-gap);
      }
      .panel {
        padding: var(--ctp-card-pad);
      }
      .panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s2);
        margin-bottom: var(--s2);
      }
      .panel-head .ctp-section-title {
        margin: 0;
      }
      .table-pad {
        margin: 0;
        overflow: auto;
      }
      .course-cell {
        display: flex;
        gap: var(--s2);
        align-items: center;
      }
      .file-icon {
        width: 28px;
        height: 28px;
        border-radius: var(--ctp-radius);
        background: #fee2e2;
        color: #dc2626;
        display: grid;
        place-items: center;
        font-size: 12px;
        flex-shrink: 0;
      }
      .strong {
        font-weight: 600;
        font-size: var(--ctp-fs-body);
      }
      .tiny {
        font-size: var(--ctp-fs-small);
      }
      .link {
        font-size: var(--ctp-fs-body);
        font-weight: 500;
        text-decoration: none;
        color: var(--ctp-primary);
      }
      .side-col {
        display: grid;
        gap: var(--ctp-section-gap);
        align-content: start;
      }
      .legend {
        display: grid;
        gap: 6px;
        margin-bottom: var(--s3);
      }
      .legend-row {
        display: flex;
        align-items: center;
        gap: var(--s2);
        font-size: var(--ctp-fs-body);
        color: var(--ctp-muted);
      }
      .legend-row strong {
        margin-left: auto;
        color: var(--ctp-ink);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
      }
      .dot.success {
        background: var(--ctp-success);
      }
      .dot.warn {
        background: var(--ctp-warning);
      }
      .dot.info {
        background: var(--ctp-primary);
      }
      .dot.neutral {
        background: #9ca3af;
      }
      .ring {
        width: 96px;
        height: 96px;
        margin: var(--s2) auto 0;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: conic-gradient(
          var(--ctp-success) calc(var(--pct) * 1%),
          var(--ctp-border) 0
        );
        position: relative;
      }
      .ring::before {
        content: '';
        position: absolute;
        inset: 10px;
        border-radius: 999px;
        background: var(--ctp-surface);
      }
      .ring span {
        position: relative;
        font-weight: 700;
        font-size: var(--ctp-fs-card);
      }
      .links {
        display: grid;
        gap: 4px;
      }
      .ql {
        display: block;
        padding: 8px 10px;
        border-radius: var(--ctp-radius);
        text-decoration: none;
        color: var(--ctp-ink);
        border: 1px solid var(--ctp-border);
        font-weight: 500;
        font-size: var(--ctp-fs-body);
      }
      .ql:hover {
        border-color: var(--ctp-primary);
        color: var(--ctp-primary);
        background: var(--ctp-primary-soft);
      }
      .cta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s3);
        flex-wrap: wrap;
      }
      @media (max-width: 960px) {
        .dash-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class OverviewPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly coursesApi = inject(CoursesApiService);
  private readonly reportsApi = inject(ReportsApiService);
  private readonly learningApi = inject(LearningApiService);

  readonly kpi = signal({
    users: 0,
    courses: 0,
    assignments: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    completionRate: 0,
    quizAttempts: 0,
  });
  readonly managerMetrics = signal<Record<string, unknown> | null>(null);
  readonly recentCourses = signal<CourseDto[]>([]);
  readonly employeeStats = signal({
    assigned: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });

  readonly isCourseAdmin = computed(() => {
    const r = this.auth.currentUser()?.role;
    return r === 'SUPER_ADMIN' || r === 'ADMIN';
  });

  readonly canManagePeople = computed(() => {
    const r = this.auth.currentUser()?.role;
    return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'MANAGER';
  });

  readonly isManagerOnly = computed(() => this.auth.currentUser()?.role === 'MANAGER');

  readonly isEmployee = computed(() => {
    const r = this.auth.currentUser()?.role;
    return r === 'EMPLOYEE' || !this.canManagePeople();
  });

  readonly dashboardTitle = computed(() => {
    if (this.isCourseAdmin()) return 'Dashboard';
    if (this.isManagerOnly()) return 'Manager dashboard';
    return 'My dashboard';
  });

  readonly dashboardSubtitle = computed(() => {
    if (this.isCourseAdmin()) {
      return 'Training operations overview — courses, people, and completion.';
    }
    if (this.isManagerOnly()) {
      return 'Team progress against mandatory onboarding and compliance courses.';
    }
    return 'Your assigned training, progress, and deadlines.';
  });

  ngOnInit(): void {
    if (this.isCourseAdmin()) {
      this.reportsApi.adminDashboard().subscribe({
        next: (d) => {
          const assignments = d['assignments'] ?? 0;
          const completed = d['completedAssignments'] ?? 0;
          this.kpi.set({
            users: d['users'] ?? 0,
            courses: d['courses'] ?? 0,
            assignments,
            completed,
            inProgress: Math.max(0, assignments - completed),
            overdue: d['overdueAssignments'] ?? 0,
            completionRate: d['completionRate'] ?? 0,
            quizAttempts: d['quizAttempts'] ?? 0,
          });
        },
      });
      this.coursesApi.list({ page: 1, pageSize: 6 }).subscribe({
        next: (res) => this.recentCourses.set(res.items),
      });
    }

    if (this.isManagerOnly()) {
      this.reportsApi.managerDashboard().subscribe({
        next: (d) => this.managerMetrics.set(d),
      });
    }

    if (this.isEmployee()) {
      this.learningApi.myAssignments().subscribe({
        next: (list) => {
          let assigned = list.length;
          let inProgress = 0;
          let completed = 0;
          let overdue = 0;
          for (const a of list) {
            if (a.status === 'COMPLETED') completed += 1;
            else if (a.status === 'IN_PROGRESS') inProgress += 1;
            if (
              a.isOverdue ||
              (a.dueAt && a.status !== 'COMPLETED' && new Date(a.dueAt) < new Date())
            ) {
              overdue += 1;
            }
          }
          this.employeeStats.set({ assigned, inProgress, completed, overdue });
        },
      });
    }
  }

  asNum(v: unknown): number {
    return typeof v === 'number' ? v : Number(v) || 0;
  }
}
