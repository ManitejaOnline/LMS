import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Password } from 'primeng/password';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [PageHeaderComponent, ReactiveFormsModule, Button, Password, Message],
  template: `
    <app-page-header title="Settings" subtitle="Preferences and account security." />

    <div class="grid">
      <section class="ctp-card panel">
        <h2 class="ctp-section-title">Appearance</h2>
        <div class="row">
          <div>
            <div class="label">Theme</div>
            <div class="ctp-muted">Switch between light and dark mode.</div>
          </div>
          <p-button
            [label]="theme.darkMode() ? 'Use light mode' : 'Use dark mode'"
            [outlined]="true"
            size="small"
            (onClick)="theme.toggle()"
          />
        </div>
      </section>

      <section class="ctp-card panel">
        <h2 class="ctp-section-title">Change password</h2>
        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="w-full mb-2" />
        }
        @if (info()) {
          <p-message severity="success" [text]="info()!" styleClass="w-full mb-2" />
        }
        <form class="form" [formGroup]="form" (ngSubmit)="submit()">
          <label class="ctp-field">
            <span>Current password</span>
            <p-password formControlName="currentPassword" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
          </label>
          <label class="ctp-field">
            <span>New password</span>
            <p-password formControlName="newPassword" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
          </label>
          <p-button type="submit" label="Update password" size="small" [loading]="saving()" [disabled]="form.invalid" />
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        gap: var(--ctp-section-gap);
        max-width: 560px;
      }
      .panel {
        padding: var(--ctp-card-pad);
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s3);
      }
      .label {
        font-weight: 600;
        font-size: var(--ctp-fs-body);
      }
      .form {
        display: grid;
        gap: var(--s3);
      }
    `,
  ],
})
export class SettingsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    /* no-op */
  }

  submit(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    const v = this.form.getRawValue();
    this.auth.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.info.set('Password updated.');
        this.form.reset();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error?.message ?? 'Unable to update password');
      },
    });
  }
}
