import { Component, OnInit, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { HealthService } from '../../core/health/health.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { formatIsoDate } from '../../shared/utils/date.util';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-foundation-page',
  standalone: true,
  imports: [PageHeaderComponent, LoadingStateComponent, Button, Tag],
  template: `
    <app-page-header
      title="Platform Foundation"
      subtitle="Infrastructure only — authentication flows and business modules ship in later phases."
    />

    @if (checking()) {
      <app-loading-state message="Checking API health…" />
    } @else {
      <section class="grid gap-6 md:grid-cols-2">
        <article class="rounded-xl border border-black/5 bg-white/90 p-6 shadow-sm">
          <h2 class="mt-0 text-lg font-semibold text-[var(--ctp-ink)]">Runtime</h2>
          <ul class="m-0 list-none space-y-3 p-0 text-sm text-[var(--ctp-muted)]">
            <li><span class="text-[var(--ctp-ink)]">App:</span> {{ appName }}</li>
            <li><span class="text-[var(--ctp-ink)]">API:</span> {{ apiBaseUrl }}</li>
            <li>
              <span class="text-[var(--ctp-ink)]">Health:</span>
              <p-tag
                class="ml-2"
                [severity]="healthSeverity()"
                [value]="healthLabel()"
              />
            </li>
            <li>
              <span class="text-[var(--ctp-ink)]">Checked:</span>
              {{ formatIsoDate(lastCheckedAt()) }}
            </li>
          </ul>
          <div class="mt-5">
            <p-button label="Recheck health" (onClick)="refresh()" />
          </div>
        </article>

        <article class="rounded-xl border border-black/5 bg-white/90 p-6 shadow-sm">
          <h2 class="mt-0 text-lg font-semibold text-[var(--ctp-ink)]">In this phase</h2>
          <ul class="m-0 space-y-2 pl-5 text-sm text-[var(--ctp-muted)]">
            <li>Monorepo (apps + shared packages)</li>
            <li>NestJS + Fastify + Prisma + PostgreSQL</li>
            <li>JWT + RBAC infrastructure</li>
            <li>Logging, validation, Swagger, health</li>
            <li>Angular 20 + Tailwind + PrimeNG shell</li>
          </ul>
        </article>
      </section>
    }
  `,
})
export class FoundationPageComponent implements OnInit {
  private readonly healthService = inject(HealthService);

  readonly appName = environment.appName;
  readonly apiBaseUrl = environment.apiBaseUrl;
  readonly checking = signal(true);
  readonly lastCheckedAt = this.healthService.lastCheckedAt;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.checking.set(true);
    this.healthService.checkLive().subscribe({
      next: () => this.checking.set(false),
      error: () => this.checking.set(false),
    });
  }

  healthLabel(): string {
    return this.healthService.status();
  }

  healthSeverity(): 'success' | 'danger' | 'warn' {
    const status = this.healthService.status();
    if (status === 'ok') {
      return 'success';
    }
    if (status === 'down') {
      return 'danger';
    }
    return 'warn';
  }

  readonly formatIsoDate = formatIsoDate;
}
