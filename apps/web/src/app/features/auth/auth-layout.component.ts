import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <div class="auth-shell">
      <section class="auth-brand" aria-label="VEB Healthcare Private">
        <img src="brand/logo.png" alt="VEB Healthcare Private" class="auth-logo" />
        <p class="tagline">Learning Management System</p>
      </section>
      <section class="auth-main">
        <div class="auth-card">
          <ng-content />
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        min-height: 100dvh;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        background: #f8fafc;
        color-scheme: light;
        color: #111827;
      }
      .auth-brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px 32px;
        background:
          radial-gradient(900px 420px at 20% 30%, color-mix(in srgb, #2a4f7d 12%, transparent), transparent),
          radial-gradient(700px 360px at 80% 70%, color-mix(in srgb, #f4811f 10%, transparent), transparent),
          #ffffff;
        border-right: 1px solid #e5e7eb;
      }
      .auth-logo {
        display: block;
        width: min(360px, 86%);
        height: auto;
        object-fit: contain;
        background: transparent;
      }
      .tagline {
        margin: 0;
        color: #64748b;
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .auth-main {
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(1200px 400px at 80% -10%, color-mix(in srgb, #2a4f7d 18%, transparent), transparent),
          #f3f4f6;
      }
      .auth-card {
        width: min(420px, 100%);
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 28px 24px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
        color: #111827;
      }
      /* Keep form controls readable even if a dark preference leaks in */
      :host ::ng-deep .auth-card .p-inputtext,
      :host ::ng-deep .auth-card .p-password-input,
      :host ::ng-deep .auth-card input[type='email'],
      :host ::ng-deep .auth-card input[type='password'],
      :host ::ng-deep .auth-card input[type='text'] {
        background: #ffffff !important;
        color: #111827 !important;
        border: 1px solid #d1d5db !important;
        caret-color: #111827;
      }
      :host ::ng-deep .auth-card .p-inputtext::placeholder,
      :host ::ng-deep .auth-card .p-password-input::placeholder {
        color: #9ca3af !important;
      }
      :host ::ng-deep .auth-card .p-inputtext:enabled:focus,
      :host ::ng-deep .auth-card .p-password-input:enabled:focus {
        border-color: #2a4f7d !important;
        box-shadow: 0 0 0 2px color-mix(in srgb, #2a4f7d 22%, transparent) !important;
      }
      :host ::ng-deep .auth-card .p-password-toggle-button {
        color: #6b7280 !important;
      }
      @media (max-width: 860px) {
        .auth-shell {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
        }
        .auth-brand {
          padding: 28px 20px 20px;
        }
        .auth-logo {
          width: min(240px, 72%);
        }
        .auth-main {
          padding: 16px 16px 32px;
          align-items: start;
        }
      }
    `,
  ],
})
export class AuthLayoutComponent implements OnInit, OnDestroy {
  private readonly theme = inject(ThemeService);

  ngOnInit(): void {
    this.theme.setForceLight(true);
  }

  ngOnDestroy(): void {
    this.theme.setForceLight(false);
  }
}
