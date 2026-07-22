import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ReactiveFormsModule,
    Button,
    InputText,
    Password,
    Message,
    Tag,
  ],
  template: `
    <app-page-header
      eyebrow="Account"
      title="Profile"
      subtitle="Update your personal details or change your password."
    />

    @if (info()) {
      <p-message severity="success" [text]="info()!" styleClass="w-full mb-4" />
    }
    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
    }

    <div class="grid gap-5 lg:grid-cols-2">
      <section class="panel">
        <div class="panel-head">
          <h2>Personal details</h2>
          <p-tag [value]="role()" />
        </div>
        <form class="form-stack" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
          <label class="field">
            <span>First name</span>
            <input pInputText formControlName="firstName" />
          </label>
          <label class="field">
            <span>Last name</span>
            <input pInputText formControlName="lastName" />
          </label>
          <label class="field">
            <span>Phone</span>
            <input pInputText formControlName="phone" />
          </label>
          <label class="field">
            <span>Email</span>
            <input pInputText [value]="email()" disabled />
          </label>
          <p-button type="submit" label="Save profile" [loading]="savingProfile()" />
        </form>
      </section>

      <section class="panel">
        <h2>Change password</h2>
        <form class="form-stack" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
          <label class="field">
            <span>Current password</span>
            <p-password
              formControlName="currentPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            />
          </label>
          <label class="field">
            <span>New password</span>
            <p-password
              formControlName="newPassword"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            />
          </label>
          <p-button
            type="submit"
            label="Update password"
            [loading]="savingPassword()"
            [disabled]="passwordForm.invalid || savingPassword()"
          />
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .panel {
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--ctp-card-pad);
      }
      .panel h2 {
        margin: 0 0 var(--s3);
        font-size: var(--ctp-fs-section);
      }
      .panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--s2);
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
    `,
  ],
})
export class ProfilePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly info = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly email = signal('');
  readonly role = signal('—');

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.auth.loadProfile().subscribe({
      next: (user) => {
        this.profileForm.reset({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? '',
        });
        this.email.set(user.email);
        this.role.set(user.role.replaceAll('_', ' '));
      },
      error: (err) =>
        this.error.set(err?.error?.error?.message ?? 'Failed to load profile'),
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      return;
    }
    this.savingProfile.set(true);
    this.info.set(null);
    this.error.set(null);
    const raw = this.profileForm.getRawValue();
    this.auth
      .updateProfile({
        firstName: raw.firstName,
        lastName: raw.lastName,
        phone: raw.phone || null,
      })
      .subscribe({
        next: () => {
          this.savingProfile.set(false);
          this.info.set('Profile updated');
        },
        error: (err) => {
          this.savingProfile.set(false);
          this.error.set(err?.error?.error?.message ?? 'Profile update failed');
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      return;
    }
    this.savingPassword.set(true);
    this.info.set(null);
    this.error.set(null);
    const raw = this.passwordForm.getRawValue();
    this.auth.changePassword(raw.currentPassword, raw.newPassword).subscribe({
      next: (res) => {
        this.savingPassword.set(false);
        this.info.set(res.message);
        this.passwordForm.reset();
        setTimeout(() => this.auth.clearSession(), 1200);
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.error.set(err?.error?.error?.message ?? 'Password change failed');
      },
    });
  }
}
