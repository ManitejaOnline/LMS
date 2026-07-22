import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ReportsApiService } from '../../core/http/reports-api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';

type Tab =
  | 'overview'
  | 'completion'
  | 'progress'
  | 'reading'
  | 'video'
  | 'quiz'
  | 'audit';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    StatCardComponent,
    LoadingStateComponent,
    Button,
    Tag,
  ],
  template: `
    <app-page-header
      title="Reports"
      subtitle="Completion, progress, content engagement, quiz performance, and audit."
    />

    <div class="tabs" role="tablist">
      @for (t of tabs(); track t.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="tab() === t.id"
          [attr.aria-selected]="tab() === t.id"
          (click)="selectTab(t.id)"
        >
          {{ t.label }}
        </button>
      }
    </div>

    @if (loading()) {
      <app-loading-state message="Loading reports…" />
    } @else {
      @if (tab() === 'overview') {
        @if (isAdmin()) {
          <div class="stats">
            <app-stat-card label="Users" [value]="admin()?.['users'] ?? 0" />
            <app-stat-card label="Courses" [value]="admin()?.['courses'] ?? 0" />
            <app-stat-card label="Assignments" [value]="admin()?.['assignments'] ?? 0" />
            <app-stat-card label="Completion %" [value]="admin()?.['completionRate'] ?? 0" />
            <app-stat-card label="Overdue" [value]="admin()?.['overdueAssignments'] ?? 0" />
            <app-stat-card label="Quiz attempts" [value]="admin()?.['quizAttempts'] ?? 0" />
            <app-stat-card label="Avg reading (min)" [value]="admin()?.['avgReadingMinutes'] ?? 0" />
            <app-stat-card label="Unread alerts" [value]="admin()?.['unreadNotifications'] ?? 0" />
          </div>
        }
        @if (manager(); as m) {
          <div class="stats">
            <app-stat-card label="Team size" [value]="asNum(m['teamSize'])" />
            <app-stat-card label="Open" [value]="asNum(m['openAssignments'])" />
            <app-stat-card label="Completed" [value]="asNum(m['completedAssignments'])" />
            <app-stat-card label="Overdue" [value]="asNum(m['overdue'])" />
          </div>
        }
      }

      @if (tab() === 'completion') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Code</th>
                <th>Assigned</th>
                <th>Completed</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              @for (row of completion(); track row.courseId) {
                <tr>
                  <td>{{ row.title }}</td>
                  <td>{{ row.code }}</td>
                  <td>{{ row.assigned }}</td>
                  <td>{{ row.completed }}</td>
                  <td>{{ row.completionRate }}%</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="muted">No completion data yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'progress') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Course</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              @for (row of progress(); track trackProgress($index, row)) {
                <tr>
                  <td>{{ rowLabel(row, 'user') }}</td>
                  <td>{{ rowLabel(row, 'course') }}</td>
                  <td><p-tag [value]="str(row, 'status')" /></td>
                  <td>{{ num(row, 'progressPercent') }}%</td>
                  <td>{{ str(row, 'dueAt') || '—' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="muted">No progress rows.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'reading') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Learners</th>
                <th>Reading (min)</th>
                <th>Idle (min)</th>
                <th>Avg scroll %</th>
              </tr>
            </thead>
            <tbody>
              @for (row of reading(); track $index) {
                <tr>
                  <td>{{ str(row, 'title') }}</td>
                  <td>{{ num(row, 'learners') }}</td>
                  <td>{{ num(row, 'totalReadingMinutes') }}</td>
                  <td>{{ num(row, 'totalIdleMinutes') }}</td>
                  <td>{{ num(row, 'avgScrollPercentage') }}%</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="muted">No reading analytics yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'video') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Learners</th>
                <th>Avg watch %</th>
                <th>Avg speed</th>
              </tr>
            </thead>
            <tbody>
              @for (row of video(); track $index) {
                <tr>
                  <td>{{ str(row, 'title') }}</td>
                  <td>{{ num(row, 'learners') }}</td>
                  <td>{{ num(row, 'avgWatchPercentage') }}%</td>
                  <td>{{ num(row, 'avgPlaybackSpeed') }}x</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted">No video analytics yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'quiz') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Attempts</th>
                <th>Pass rate</th>
                <th>Avg score</th>
              </tr>
            </thead>
            <tbody>
              @for (row of quiz(); track $index) {
                <tr>
                  <td>{{ str(row, 'lessonTitle') }}</td>
                  <td>{{ num(row, 'attempts') }}</td>
                  <td>{{ num(row, 'passRate') }}%</td>
                  <td>{{ num(row, 'avgScore') }}%</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted">No quiz analytics yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'audit' && isAdmin()) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              @for (row of audit(); track $index) {
                <tr>
                  <td>{{ str(row, 'createdAt') }}</td>
                  <td>{{ str(row, 'action') }}</td>
                  <td>{{ rowLabel(row, 'actor') }}</td>
                  <td>{{ str(row, 'entityType') }} · {{ str(row, 'entityId') }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted">No audit entries.</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="pager">
            <p-button
              label="Previous"
              severity="secondary"
              [outlined]="true"
              [disabled]="auditPage() <= 1"
              (onClick)="loadAudit(auditPage() - 1)"
            />
            <span class="muted">Page {{ auditPage() }}</span>
            <p-button
              label="Next"
              severity="secondary"
              [outlined]="true"
              (onClick)="loadAudit(auditPage() + 1)"
            />
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: var(--ctp-section-gap);
      }
      .tab {
        border: 1px solid var(--ctp-border);
        background: var(--ctp-surface);
        color: var(--ctp-ink);
        height: 32px;
        padding: 0 12px;
        border-radius: var(--ctp-radius);
        cursor: pointer;
        font-size: var(--ctp-fs-body);
        font-weight: 500;
      }
      .tab.active {
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        border-color: transparent;
        box-shadow: inset 3px 0 0 var(--ctp-primary);
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--ctp-section-gap);
      }
      .table-wrap {
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        overflow: auto;
        box-shadow: var(--ctp-shadow);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--ctp-fs-table);
      }
      th,
      td {
        text-align: left;
        height: var(--ctp-row-h);
        padding: 0 var(--s3);
        border-bottom: 1px solid var(--ctp-border);
        white-space: nowrap;
        vertical-align: middle;
      }
      th {
        height: var(--ctp-thead-h);
        color: var(--ctp-muted);
        font-weight: 600;
        font-size: var(--ctp-fs-table-head);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        position: sticky;
        top: 0;
        background: #f9fafb;
        z-index: 1;
      }
      .muted {
        color: var(--ctp-muted);
      }
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s2) var(--s3);
        font-size: var(--ctp-fs-small);
      }
      @media (max-width: 900px) {
        .stats {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(ReportsApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly tab = signal<Tab>('overview');
  readonly admin = signal<Record<string, number> | null>(null);
  readonly manager = signal<Record<string, unknown> | null>(null);
  readonly completion = signal<
    Array<{
      courseId: string;
      title: string;
      code: string;
      assigned: number;
      completed: number;
      completionRate: number;
    }>
  >([]);
  readonly progress = signal<unknown[]>([]);
  readonly reading = signal<unknown[]>([]);
  readonly video = signal<unknown[]>([]);
  readonly quiz = signal<unknown[]>([]);
  readonly audit = signal<unknown[]>([]);
  readonly auditPage = signal(1);

  readonly isAdmin = computed(() => {
    const r = this.auth.currentUser()?.role;
    return r === 'SUPER_ADMIN' || r === 'ADMIN';
  });

  readonly tabs = computed(() => {
    const base: Array<{ id: Tab; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'completion', label: 'Course completion' },
      { id: 'progress', label: 'Employee progress' },
      { id: 'reading', label: 'Reading time' },
      { id: 'video', label: 'Video analytics' },
      { id: 'quiz', label: 'Quiz analytics' },
    ];
    if (this.isAdmin()) {
      base.push({ id: 'audit', label: 'Audit logs' });
    }
    return base;
  });

  ngOnInit(): void {
    this.loadOverview();
  }

  selectTab(id: Tab): void {
    this.tab.set(id);
    if (id === 'completion' && !this.completion().length) this.loadCompletion();
    if (id === 'progress' && !this.progress().length) this.loadProgress();
    if (id === 'reading' && !this.reading().length) this.loadReading();
    if (id === 'video' && !this.video().length) this.loadVideo();
    if (id === 'quiz' && !this.quiz().length) this.loadQuiz();
    if (id === 'audit') this.loadAudit(this.auditPage());
  }

  asNum(v: unknown): number {
    return typeof v === 'number' ? v : Number(v) || 0;
  }

  num(row: unknown, key: string): number {
    const v = (row as Record<string, unknown>)?.[key];
    return typeof v === 'number' ? v : Number(v) || 0;
  }

  str(row: unknown, key: string): string {
    const v = (row as Record<string, unknown>)?.[key];
    return v == null ? '' : String(v);
  }

  rowLabel(row: unknown, key: string): string {
    const nested = (row as Record<string, unknown>)?.[key] as
      | Record<string, string>
      | undefined;
    if (!nested) return '—';
    if (nested['title']) return nested['title'];
    if (nested['firstName']) return `${nested['firstName']} ${nested['lastName'] ?? ''}`.trim();
    if (nested['email']) return nested['email'];
    if (nested['name']) return nested['name'];
    return '—';
  }

  trackProgress(i: number, row: unknown): string {
    const r = row as Record<string, unknown>;
    return String(r['id'] ?? i);
  }

  private loadOverview(): void {
    this.loading.set(true);
    const role = this.auth.currentUser()?.role;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      this.api.adminDashboard().subscribe({
        next: (d) => {
          this.admin.set(d);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      this.api.managerDashboard().subscribe({
        next: (d) => this.manager.set(d),
      });
    } else {
      this.api.managerDashboard().subscribe({
        next: (d) => {
          this.manager.set(d);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  private loadCompletion(): void {
    this.api.courseCompletion().subscribe({ next: (d) => this.completion.set(d) });
  }

  private loadProgress(): void {
    this.api.employeeProgress().subscribe({ next: (d) => this.progress.set(d) });
  }

  private loadReading(): void {
    this.api.readingTime().subscribe({ next: (d) => this.reading.set(d) });
  }

  private loadVideo(): void {
    this.api.videoAnalytics().subscribe({ next: (d) => this.video.set(d) });
  }

  private loadQuiz(): void {
    this.api.quizAnalytics().subscribe({ next: (d) => this.quiz.set(d) });
  }

  loadAudit(page: number): void {
    this.auditPage.set(page);
    this.api.auditLogs(page).subscribe({
      next: (d) => this.audit.set(d.items ?? []),
    });
  }
}
