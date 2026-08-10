import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Message } from 'primeng/message';
import { AuthService } from '../../core/auth/auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    InputText,
    Password,
    Message,
    AuthLayoutComponent,
  ],
  template: `
    <app-auth-layout>
      <h1>Sign in</h1>
      <p class="lede">Use your work email to continue to Zebl India LMS.</p>

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
          styleClass="w-full auth-submit"
          [loading]="loading()"
          [disabled]="form.invalid || loading()"
        />
      </form>
    </app-auth-layout>
  `,
  styles: [
    `
      h1 {
        margin: 0 0 6px;
        font-size: 22px;
        font-weight: 600;
        color: #111827;
        line-height: 1.25;
      }
      .lede {
        margin: 0 0 20px;
        color: #6b7280;
        font-size: 13px;
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
        color: #374151;
      }
      .field input {
        width: 100%;
        min-height: 44px;
      }
      .row-between {
        display: flex;
        justify-content: flex-end;
      }
      .link {
        font-size: 13px;
        color: #139f8a;
        text-decoration: none;
        font-weight: 600;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      }
      .link:hover {
        text-decoration: underline;
      }
      :host ::ng-deep .p-password,
      :host ::ng-deep .p-password-input {
        width: 100%;
      }
      :host ::ng-deep .p-password-input {
        min-height: 44px;
      }
      :host ::ng-deep .auth-submit.p-button {
        min-height: 44px;
        background: #51459e;
        border-color: #51459e;
      }
      :host ::ng-deep .auth-submit.p-button:not(:disabled):hover {
        background: #433884;
        border-color: #433884;
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
