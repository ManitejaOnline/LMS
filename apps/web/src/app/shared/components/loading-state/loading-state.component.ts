import { Component, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [ProgressSpinner],
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-12" role="status">
      <p-progressSpinner strokeWidth="4" [style]="{ width: '42px', height: '42px' }" />
      <p class="m-0 text-sm text-[var(--ctp-muted)]">{{ message() }}</p>
    </div>
  `,
})
export class LoadingStateComponent {
  readonly message = input('Loading…');
}
