import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { CoursesApiService } from '../../core/http/courses-api.service';
import type { CourseDto, CourseStatus } from '../../core/models/domain.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-courses-list-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
    StatCardComponent,
    FormsModule,
    RouterLink,
    Button,
    InputText,
    Select,
    TableModule,
    Message,
  ],
  template: `
    <div class="header-row">
      <app-page-header
        title="Courses"
        subtitle="Create, organize, and publish mandatory training courses."
      />
      <a routerLink="/app/courses/new" class="no-underline">
        <p-button label="Create Course" icon="pi pi-plus" />
      </a>
    </div>

    <div class="ctp-kpi-grid mb">
      <app-stat-card label="Total" [value]="stats().total" icon="pi pi-folder" />
      <app-stat-card label="Draft" [value]="stats().draft" icon="pi pi-file" tone="neutral" />
      <app-stat-card label="Published" [value]="stats().published" icon="pi pi-check-circle" tone="success" />
      <app-stat-card label="Archived" [value]="stats().archived" icon="pi pi-inbox" tone="warning" />
    </div>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
    }

    <section class="ctp-filter-bar">
      <input
        pInputText
        placeholder="Search title or code"
        [(ngModel)]="search"
        (ngModelChange)="reload()"
      />
      <p-select
        [options]="statusOptions"
        [(ngModel)]="status"
        placeholder="Status"
        [showClear]="true"
        (onChange)="reload()"
      />
    </section>

    @if (loading()) {
      <app-loading-state message="Loading courses…" />
    } @else {
      <div class="ctp-card table-card">
        <p-table
          [value]="courses()"
          [paginator]="true"
          [rows]="pageSize"
          [lazy]="true"
          [totalRecords]="total()"
          (onPage)="onPage($event)"
          [first]="(page - 1) * pageSize"
        >
          <ng-template #header>
            <tr>
              <th>Course</th>
              <th>Code</th>
              <th>Status</th>
              <th>Modules</th>
              <th>Mandatory</th>
              <th></th>
            </tr>
          </ng-template>
          <ng-template #body let-course>
            <tr>
              <td>
                <div class="course-cell">
                  @if (course.thumbnailMedia?.publicUrl) {
                    <img [src]="mediaUrl(course.thumbnailMedia.publicUrl)" alt="" />
                  } @else {
                    <div class="thumb-fallback">{{ course.title[0] }}</div>
                  }
                  <div>
                    <div class="title">{{ course.title }}</div>
                    <div class="muted">{{ course.estimatedMinutes || '—' }} min</div>
                  </div>
                </div>
              </td>
              <td>{{ course.code }}</td>
              <td><app-status-badge [status]="course.status" /></td>
              <td>{{ course._count?.modules ?? 0 }}</td>
              <td>{{ course.isMandatory ? 'Yes' : 'No' }}</td>
              <td class="actions">
                <a [routerLink]="['/app/courses', course.id]" class="no-underline">
                  <p-button icon="pi pi-pencil" [text]="true" />
                </a>
                @if (course.status !== 'PUBLISHED') {
                  <p-button
                    icon="pi pi-check"
                    [text]="true"
                    (onClick)="setStatus(course, 'PUBLISHED')"
                  />
                }
                @if (course.status === 'PUBLISHED') {
                  <p-button
                    icon="pi pi-inbox"
                    [text]="true"
                    (onClick)="setStatus(course, 'ARCHIVED')"
                  />
                }
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  (onClick)="remove(course)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }
  `,
  styles: [
    `
      .header-row {
        display: flex;
        justify-content: space-between;
        gap: var(--ctp-section-gap);
        align-items: flex-start;
      }
      .mb {
        margin-bottom: var(--ctp-section-gap);
      }
      .table-card {
        padding: 0;
        overflow: hidden;
      }
      .course-cell {
        display: flex;
        gap: var(--s2);
        align-items: center;
      }
      .course-cell img,
      .thumb-fallback {
        width: 32px;
        height: 32px;
        border-radius: var(--ctp-radius);
        object-fit: cover;
        flex-shrink: 0;
      }
      .thumb-fallback {
        display: grid;
        place-items: center;
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        font-weight: 700;
        font-size: var(--ctp-fs-label);
      }
      .title {
        font-weight: 600;
        font-size: var(--ctp-fs-body);
      }
      .muted {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 2px;
      }
      @media (max-width: 900px) {
        .header-row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class CoursesListPageComponent implements OnInit {
  private readonly api = inject(CoursesApiService);

  readonly courses = signal<CourseDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly stats = signal({ total: 0, draft: 0, published: 0, archived: 0 });

  page = 1;
  pageSize = 10;
  search = '';
  status: CourseStatus | null = null;
  readonly statusOptions = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

  ngOnInit(): void {
    this.loadStats();
    this.reload();
  }

  mediaUrl(path: string): string {
    if (path.startsWith('http')) return path;
    return `${environment.mediaBaseUrl}${path}`;
  }

  loadStats(): void {
    this.api.dashboardStats().subscribe({
      next: (s) => this.stats.set(s),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search || undefined,
        status: this.status || undefined,
      })
      .subscribe({
        next: (res) => {
          this.courses.set(res.items);
          this.total.set(res.meta.totalItems);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.error?.message ?? 'Failed to load courses');
        },
      });
  }

  onPage(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.pageSize;
    this.pageSize = rows;
    this.page = Math.floor(first / rows) + 1;
    this.reload();
  }

  setStatus(course: CourseDto, status: CourseStatus): void {
    this.api.updateStatus(course.id, status).subscribe({
      next: () => {
        this.reload();
        this.loadStats();
      },
      error: (err) =>
        this.error.set(err?.error?.error?.message ?? 'Status update failed'),
    });
  }

  remove(course: CourseDto): void {
    if (!confirm(`Soft delete course "${course.title}"?`)) return;
    this.api.remove(course.id).subscribe({
      next: () => {
        this.reload();
        this.loadStats();
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Delete failed'),
    });
  }
}
