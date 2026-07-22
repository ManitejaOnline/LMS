import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, InputText, Message],
  template: `
    <div class="auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Account recovery</p>
        <h1>Forgot password</h1>
        <p class="lede">Enter your work email and we’ll send reset instructions.</p>

        @if (message()) {
          <p-message severity="success" [text]="message()!" styleClass="w-full mb-4" />
        }
        @if (devToken()) {
          <p-message
            severity="info"
            [text]="'Dev reset token: ' + devToken()"
            styleClass="w-full mb-4"
          />
        }
        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
        }

        <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span>Email</span>
            <input pInputText type="email" formControlName="email" />
          </label>
          <p-button
            type="submit"
            label="Send reset link"
            styleClass="w-full"
            [loading]="loading()"
            [disabled]="form.invalid || loading()"
          />
          <a routerLink="/login" class="link">Back to sign in</a>
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
      h1 {
        margin: 4px 0 6px;
        color: var(--ctp-ink);
        font-size: var(--ctp-fs-title);
        font-weight: 600;
        line-height: 1.25;
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
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-body);
        margin: 0 0 var(--s4);
      }
      .form-stack {
        display: grid;
        gap: var(--s3);
      }
      .field {
        display: grid;
        gap: 4px;
        font-size: var(--ctp-fs-label);
      }
      .field input {
        width: 100%;
      }
      .link {
        color: var(--ctp-primary);
        text-decoration: none;
        font-size: var(--ctp-fs-body);
      }
    `,
  ],
})
export class ForgotPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly devToken = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.devToken.set(null);

    this.auth.forgotPassword(this.form.controls.email.value).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.message.set(res.message);
        this.devToken.set(res.resetToken ?? null);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Request failed');
      },
    });
  }
}
