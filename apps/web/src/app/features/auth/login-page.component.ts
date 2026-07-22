import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Message } from 'primeng/message';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, InputText, Password, Message],
  template: `
    <div class="auth-shell">
      <section class="auth-card">
        <div class="brand-block">
          <img src="brand/logo.png" alt="Zebl" class="auth-logo" />
          <p class="eyebrow">Zebl</p>
          <h1>Zebl Training Portal</h1>
          <p class="lede">Sign in to manage mandatory learning and people operations.</p>
        </div>

        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
        }

        <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span>Email</span>
            <input pInputText type="email" formControlName="email" autocomplete="username" />
          </label>

          <label class="field">
            <span>Password</span>
            <p-password
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="current-password"
            />
          </label>

          <div class="row-between">
            <a routerLink="/forgot-password" class="link">Forgot password?</a>
          </div>

          <p-button
            type="submit"
            label="Sign in"
            styleClass="w-full"
            [loading]="loading()"
            [disabled]="form.invalid || loading()"
          />
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: var(--ctp-page-pad);
        background: var(--ctp-bg);
      }
      .auth-card {
        width: min(400px, 100%);
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--s5);
        box-shadow: var(--ctp-shadow);
      }
      .brand-block h1 {
        margin: 4px 0 6px;
        font-size: var(--ctp-fs-title);
        font-weight: 600;
        color: var(--ctp-ink);
        line-height: 1.25;
      }
      .auth-logo {
        display: block;
        height: 40px;
        width: auto;
        max-width: 160px;
        object-fit: contain;
        object-position: left center;
        margin-bottom: 10px;
        border-radius: 6px;
        background: #000;
      }
      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 11px;
        font-weight: 600;
        color: var(--ctp-primary);
      }
      .lede {
        margin: 0 0 var(--s4);
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-body);
      }
      .form-stack {
        display: grid;
        gap: var(--s3);
      }
      .field {
        display: grid;
        gap: 4px;
        font-size: var(--ctp-fs-label);
        font-weight: 500;
      }
      .row-between {
        display: flex;
        justify-content: flex-end;
      }
      .link {
        font-size: var(--ctp-fs-body);
        color: var(--ctp-primary);
        text-decoration: none;
        font-weight: 500;
      }
      .link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/app');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.error?.message ?? 'Unable to sign in. Check your credentials.',
        );
      },
    });
  }
}
