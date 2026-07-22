import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LearningApiService } from '../../core/http/learning-api.service';
import type {
  CourseAssignmentDto,
  LearningDashboardDto,
} from '../../core/models/domain.models';
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
    DatePipe,
  ],
  template: `
    <app-page-header
      title="My Learning"
      subtitle="Complete mandatory training. Progress resumes where you left off."
    />

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
        } @empty {
          <p class="muted empty">No courses assigned yet. Contact your training administrator.</p>
        }
      </div>
    }
  `,
  styles: [
    `
      .mb {
        margin-bottom: var(--ctp-section-gap);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--ctp-section-gap);
      }
      .card {
        padding: var(--ctp-card-pad);
        display: grid;
        gap: var(--s3);
      }
      .card-top {
        display: flex;
        gap: var(--s3);
      }
      .card-top img,
      .fallback {
        width: 40px;
        height: 40px;
        border-radius: var(--ctp-radius);
        object-fit: cover;
        flex-shrink: 0;
      }
      .fallback {
        display: grid;
        place-items: center;
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        font-weight: 700;
        font-size: var(--ctp-fs-label);
      }
      h3 {
        margin: 0;
        font-size: var(--ctp-fs-card);
        font-weight: 600;
        line-height: 1.3;
      }
      .muted {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
        margin: 2px 0 0;
      }
      .tags {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        flex-wrap: wrap;
      }
      .progress {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--s2);
        align-items: center;
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
      .pct {
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .card-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .empty {
        grid-column: 1 / -1;
      }
    `,
  ],
})
export class MyLearningPageComponent implements OnInit {
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

  ngOnInit(): void {
    this.api.dashboard().subscribe({
      next: (d) => this.dash.set(d),
    });
    this.api.myAssignments().subscribe({
      next: (items) => {
        this.assignments.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Failed to load assignments');
      },
    });
  }

  mediaUrl(path: string): string {
    return path.startsWith('http') ? path : `${environment.mediaBaseUrl}${path}`;
  }
}
