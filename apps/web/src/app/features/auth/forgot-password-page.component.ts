import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { AuthService } from '../../core/auth/auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Button, InputText, Message, AuthLayoutComponent],
  template: `
    <app-auth-layout>
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
          styleClass="w-full auth-submit"
          [loading]="loading()"
          [disabled]="form.invalid || loading()"
        />
        <a routerLink="/login" class="link">Back to sign in</a>
      </form>
    </app-auth-layout>
  `,
  styles: [
    `
      h1 {
        margin: 0 0 6px;
        color: #111827;
        font-size: 22px;
        font-weight: 600;
        line-height: 1.25;
      }
      .lede {
        color: #6b7280;
        font-size: 13px;
        margin: 0 0 20px;
      }
      .form-stack {
        display: grid;
        gap: 14px;
      }
      .field {
        display: grid;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
      }
      .field input {
        width: 100%;
        min-height: 44px;
      }
      .link {
        color: #139f8a;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      }
      :host ::ng-deep .auth-submit.p-button {
        min-height: 44px;
        background: #51459e;
        border-color: #51459e;
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
