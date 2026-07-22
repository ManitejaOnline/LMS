import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="hdr">
      @if (eyebrow()) {
        <p class="eyebrow">{{ eyebrow() }}</p>
      }
      <div class="row">
        <div>
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p class="sub">{{ subtitle() }}</p>
          }
        </div>
        <div class="actions">
          <ng-content />
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .hdr {
        margin-bottom: var(--ctp-section-gap);
      }
      .eyebrow {
        margin: 0 0 var(--s1);
        font-size: 11px;
        font-weight: 600;
        color: var(--ctp-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--s3);
        flex-wrap: wrap;
      }
      h1 {
        margin: 0;
        font-size: var(--ctp-fs-title);
        font-weight: 600;
        line-height: 1.25;
      }
      .sub {
        margin: var(--s1) 0 0;
        font-size: var(--ctp-fs-label);
        color: var(--ctp-muted);
        max-width: 42rem;
        line-height: 1.4;
      }
      .actions {
        display: flex;
        gap: var(--s2);
        align-items: center;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input('');
}
