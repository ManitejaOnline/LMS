import { Component, inject, input } from '@angular/core';
import { ContentProtectionService } from '../../../core/content-protection/content-protection.service';

/** Diagonal watermark overlay — place inside fullscreen shells so it stays visible. */
@Component({
  selector: 'app-content-watermark',
  standalone: true,
  template: `
    @if (protection.active()) {
      <div class="wm" [class.tone-light]="tone() === 'light'" aria-hidden="true">
        @for (tile of tiles; track $index) {
          <div class="wm-tile">
            <div>{{ wm.employeeName }}</div>
            <div>{{ wm.employeeId }}</div>
            <div>{{ wm.companyName }}</div>
            <div>{{ wm.timestampLabel }}</div>
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
        inset: -25%;
        z-index: 28;
        pointer-events: none;
        display: grid;
        grid-template-columns: repeat(4, minmax(140px, 1fr));
        grid-auto-rows: minmax(160px, auto);
        gap: 40px 28px;
        transform: rotate(-28deg);
        opacity: 0.15;
        color: #0f172a;
        font-size: clamp(11px, 1.5vw, 14px);
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
          grid-template-columns: repeat(3, minmax(120px, 1fr));
          font-size: 11px;
        }
      }
    `,
  ],
})
export class ContentWatermarkComponent {
  readonly protection = inject(ContentProtectionService);
  readonly tone = input<'dark' | 'light'>('dark');
  readonly tiles = Array.from({ length: 48 });

  get wm() {
    return this.protection.watermark();
  }
}
