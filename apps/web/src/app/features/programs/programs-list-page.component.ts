import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type { ProgramListItem } from '../../core/models/program.models';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-programs-list-page',
  standalone: true,
  imports: [PageHeaderComponent, LoadingStateComponent, StatusBadgeComponent, RouterLink, Button, Message],
  template: `
    <div class="header-row">
      <app-page-header
        title="Learning Programs"
        subtitle="Group published courses into levels. Employees progress sequentially."
      />
      <a routerLink="/app/programs/new" class="no-underline">
        <p-button label="Create Program" icon="pi pi-plus" />
      </a>
    </div>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
    }

    @if (loading()) {
      <app-loading-state message="Loading programs…" />
    } @else {
      <div class="grid">
        @for (item of programs(); track item.id) {
          <article class="ctp-card card">
            <div class="top">
              <div>
                <h3>{{ item.name }}</h3>
                <p class="muted">{{ item.courseCount }} Courses · {{ item.levelCount }} Levels</p>
              </div>
              <app-status-badge [status]="item.status" />
            </div>
            <div class="actions">
              <a [routerLink]="['/app/programs', item.id]" class="no-underline">
                <p-button label="Edit" icon="pi pi-pencil" [outlined]="true" size="small" />
              </a>
              <a [routerLink]="['/app/programs', item.id]" [queryParams]="{ tab: 'levels' }" class="no-underline">
                <p-button label="Manage Levels" [text]="true" size="small" />
              </a>
            </div>
          </article>
        } @empty {
          <p class="muted">No learning programs yet.</p>
        }
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
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--ctp-section-gap);
      }
      .card {
        padding: var(--ctp-card-pad);
        display: grid;
        gap: var(--s3);
      }
      .top {
        display: flex;
        justify-content: space-between;
        gap: var(--s3);
      }
      h3 {
        margin: 0;
        font-size: var(--ctp-fs-card);
      }
      .muted {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
        margin: 4px 0 0;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      @media (max-width: 720px) {
        .header-row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ProgramsListPageComponent implements OnInit {
  private readonly api = inject(ProgramsApiService);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly programs = signal<ProgramListItem[]>([]);

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (items) => {
        this.programs.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Failed to load programs');
      },
    });
  }
}
