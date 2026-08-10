import { Component } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <div class="auth-shell">
      <section class="auth-brand" aria-label="Zebl India">
        <img src="brand/logo.png" alt="Zebl India" class="auth-logo" />
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
        background: #000;
      }
      .auth-brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px 32px;
        background: #000;
      }
      .auth-logo {
        display: block;
        width: min(360px, 86%);
        height: auto;
        object-fit: contain;
      }
      .tagline {
        margin: 0;
        color: #9ca3af;
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
          radial-gradient(1200px 400px at 80% -10%, color-mix(in srgb, #51459e 18%, transparent), transparent),
          #f3f4f6;
      }
      .auth-card {
        width: min(420px, 100%);
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 28px 24px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
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
export class AuthLayoutComponent {}
