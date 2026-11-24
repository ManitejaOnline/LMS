import { Component, inject, input } from '@angular/core';
import { ContentProtectionService } from '../../../core/content-protection/content-protection.service';

/** Horizontal watermark overlay — place inside fullscreen shells so it stays visible. */
@Component({
  selector: 'app-content-watermark',
  standalone: true,
  template: `
    @if (protection.active()) {
      <div class="wm" [class.tone-light]="tone() === 'light'" aria-hidden="true">
        @for (tile of tiles; track $index) {
          <div class="wm-tile">
            <div>{{ wm.employeeName }} · {{ wm.employeeId }} · {{ wm.companyName }} · {{ wm.timestampLabel }}</div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .wm {
        position: absolute;
        inset: -10%;
        z-index: 28;
        pointer-events: none;
        display: grid;
        grid-template-columns: repeat(2, minmax(220px, 1fr));
        grid-auto-rows: minmax(120px, auto);
        gap: 48px 32px;
        transform: none;
        opacity: 0.14;
        color: #0f172a;
        font-size: clamp(11px, 1.4vw, 13px);
        font-weight: 600;
        line-height: 1.35;
        user-select: none;
        -webkit-user-select: none;
      }
      .wm.tone-light {
        color: #f8fafc;
      }
      .wm-tile {
        white-space: nowrap;
        text-align: center;
      }
      @media (max-width: 720px) {
        .wm {
          grid-template-columns: 1fr;
          font-size: 11px;
        }
      }
    `,
  ],
})
export class ContentWatermarkComponent {
  readonly protection = inject(ContentProtectionService);
  readonly tone = input<'dark' | 'light'>('dark');
  readonly tiles = Array.from({ length: 24 });

  get wm() {
    return this.protection.watermark();
  }
}
