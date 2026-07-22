import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [PageHeaderComponent, Button, RouterLink],
  template: `
    <app-page-header
      eyebrow="Zebl"
      title="Zebl Training Portal"
      subtitle="Enterprise internal onboarding platform foundation is ready for the next implementation phases."
    />

    <p class="mb-6 max-w-2xl text-[var(--ctp-muted)]">
      This build intentionally excludes business modules (users, courses, quizzes, reports).
      Use the foundation screen to validate API connectivity and the shared UI kit.
    </p>

    <a routerLink="/foundation" class="inline-block no-underline">
      <p-button label="Open foundation status" />
    </a>
  `,
})
export class HomePageComponent {}
