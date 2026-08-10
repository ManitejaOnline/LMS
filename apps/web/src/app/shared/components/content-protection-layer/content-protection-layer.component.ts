import {
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
} from '@angular/core';
import { ContentProtectionService } from '../../../core/content-protection/content-protection.service';

/**
 * Reusable protection shell: watermark + blur + toast.
 * Enable via [lessonId]; attaches to host element.
 */
@Component({
  selector: 'app-content-protection-layer',
  standalone: true,
  template: `
    <div
      class="cp-root"
      [class.is-blurred]="protection.blurred()"
      [class.is-active]="protection.active()"
    >
      <div class="cp-content">
        <ng-content />
      </div>

      @if (protection.active()) {
        <!-- PDF watermark is page-scoped inside the viewer; video keeps its overlay. -->
      }

      @if (protection.toastMessage(); as msg) {
        <div class="cp-toast" role="status">{{ msg }}</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        position: relative;
      }
      .cp-root {
        position: relative;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .cp-content {
        flex: 1;
        min-height: 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        transition: filter 180ms ease;
        position: relative;
      }
      .cp-root.is-blurred .cp-content {
        filter: blur(14px);
        pointer-events: none;
      }
      .cp-toast {
        position: absolute;
        left: 50%;
        bottom: max(16px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 50;
        max-width: min(92vw, 420px);
        padding: 10px 14px;
        border-radius: 10px;
        background: color-mix(in srgb, #0f172a 88%, transparent);
        color: #f8fafc;
        font-size: 13px;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
        pointer-events: none;
      }
      @media (max-width: 720px) {
        .cp-toast {
          font-size: 12px;
          padding: 10px 12px;
        }
      }
    `,
  ],
})
export class ContentProtectionLayerComponent implements OnDestroy {
  readonly protection = inject(ContentProtectionService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly lessonId = input<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.lessonId();
      if (id) {
        this.protection.enable({
          lessonId: id,
          host: this.host.nativeElement,
        });
      } else {
        this.protection.disable();
      }
    });
  }

  ngOnDestroy(): void {
    this.protection.disable();
  }
}
