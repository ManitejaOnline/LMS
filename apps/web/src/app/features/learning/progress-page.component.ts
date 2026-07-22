import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { LearningApiService } from '../../core/http/learning-api.service';
import type { CourseAssignmentDto, LearningDashboardDto } from '../../core/models/domain.models';

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
                  <a [routerLink]="['/app/learn', item.id]" class="no-underline">
                    <p-button label="Open" size="small" [outlined]="true" />
                  </a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="ctp-muted">No assigned courses yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: [
    `
      .mb {
        margin-bottom: var(--ctp-section-gap);
      }
      .panel {
        padding: var(--ctp-card-pad);
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
    `,
  ],
})
export class ProgressPageComponent implements OnInit {
  private readonly api = inject(LearningApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly assignments = signal<CourseAssignmentDto[]>([]);
  readonly dash = signal<LearningDashboardDto>({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    recent: [],
  });

  overall(): number {
    const items = this.assignments();
    if (!items.length) return 0;
    const sum = items.reduce((s, a) => s + (a.progressPercent || 0), 0);
    return Math.round(sum / items.length);
  }

  ngOnInit(): void {
    this.api.dashboard().subscribe({ next: (d) => this.dash.set(d) });
    this.api.myAssignments().subscribe({
      next: (items) => {
        this.assignments.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Failed to load progress');
      },
    });
  }
}
