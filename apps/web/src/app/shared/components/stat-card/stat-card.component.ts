import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <article class="stat">
      <div class="icon-wrap" [attr.data-tone]="tone()" aria-hidden="true">
        <i [class]="icon()"></i>
      </div>
      <div class="body">
        <div class="value">{{ value() }}</div>
        <div class="label">{{ label() }}</div>
        @if (hint()) {
          <div class="hint">{{ hint() }}</div>
        }
      </div>
    </article>
  `,
  styles: [
    `
      .stat {
        display: flex;
        gap: var(--s3);
        align-items: center;
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--ctp-card-pad);
        box-shadow: var(--ctp-shadow);
        min-height: 0;
      }
      .icon-wrap {
        width: 28px;
        height: 28px;
        border-radius: var(--ctp-radius);
        display: grid;
        place-items: center;
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        flex-shrink: 0;
        font-size: 13px;
      }
      .icon-wrap[data-tone='success'] {
        background: var(--ctp-success-soft);
        color: var(--ctp-success);
      }
      .icon-wrap[data-tone='warning'] {
        background: var(--ctp-warning-soft);
        color: var(--ctp-warning);
      }
      .icon-wrap[data-tone='danger'] {
        background: var(--ctp-danger-soft);
        color: var(--ctp-danger);
      }
      .icon-wrap[data-tone='neutral'] {
        background: #f3f4f6;
        color: var(--ctp-muted);
      }
      .value {
        font-size: var(--ctp-fs-kpi);
        font-weight: 650;
        color: var(--ctp-ink);
        line-height: 1.1;
      }
      .label {
        margin-top: 2px;
        font-size: var(--ctp-fs-label);
        color: var(--ctp-muted);
        line-height: 1.2;
      }
      .hint {
        margin-top: 2px;
        font-size: 11px;
        color: var(--ctp-muted);
      }
    `,
  ],
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input('');
  readonly icon = input('pi pi-chart-bar');
  readonly tone = input<'primary' | 'success' | 'warning' | 'danger' | 'neutral'>('primary');
}
