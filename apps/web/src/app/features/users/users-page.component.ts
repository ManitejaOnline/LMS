import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { UsersApiService } from '../../core/http/users-api.service';
import { DepartmentsApiService } from '../../core/http/departments-api.service';
import type {
  AppRole,
  DepartmentDto,
  UserDto,
  UserStatus,
} from '../../core/models/domain.models';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    Button,
    Dialog,
    InputText,
    Select,
    Tag,
    Message,
  ],
  template: `
    <div class="header-row">
      <app-page-header
        eyebrow="Administration"
        title="People"
        subtitle="Manage employees, managers, roles, and department membership."
      />
      <p-button label="Add user" icon="pi pi-plus" (onClick)="openCreate()" />
    </div>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
    }

    <section class="filters panel">
      <input
        pInputText
        placeholder="Search name, email, employee code"
        [(ngModel)]="search"
        (ngModelChange)="reload()"
      />
      <p-select
        [options]="roleOptions"
        [(ngModel)]="role"
        placeholder="Role"
        [showClear]="true"
        (onChange)="reload()"
      />
      <p-select
        [options]="statusOptions"
        [(ngModel)]="status"
        placeholder="Status"
        [showClear]="true"
        (onChange)="reload()"
      />
      <p-select
        [options]="departmentOptions()"
        optionLabel="label"
        optionValue="value"
        [(ngModel)]="departmentId"
        placeholder="Department"
        [showClear]="true"
        (onChange)="reload()"
      />
    </section>

    @if (loading()) {
      <app-loading-state message="Loading people…" />
    } @else {
      <div class="panel">
        <p-table [value]="users()" [paginator]="true" [rows]="pageSize" [lazy]="true"
          [totalRecords]="total()" (onPage)="onPage($event)" [first]="(page - 1) * pageSize">
          <ng-template #header>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Department</th>
              <th>Manager</th>
              <th></th>
            </tr>
          </ng-template>
          <ng-template #body let-user>
            <tr>
              <td>{{ user.firstName }} {{ user.lastName }}</td>
              <td>{{ user.email }}</td>
              <td><p-tag [value]="user.role" /></td>
              <td><p-tag [value]="user.status" [severity]="statusSeverity(user.status)" /></td>
              <td>{{ user.department?.name || '—' }}</td>
              <td>
                @if (user.manager) {
                  {{ user.manager.firstName }} {{ user.manager.lastName }}
                } @else {
                  —
                }
              </td>
              <td class="actions">
                <p-button icon="pi pi-pencil" [text]="true" (onClick)="openEdit(user)" />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  (onClick)="remove(user)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <p-dialog
      [(visible)]="dialogVisible"
      [header]="editingId ? 'Edit user' : 'Add user'"
      [modal]="true"
      [focusTrap]="false"
      [style]="{ width: '560px' }"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <label class="field">
          <span>First name</span>
          <input pInputText formControlName="firstName" />
        </label>
        <label class="field">
          <span>Last name</span>
          <input pInputText formControlName="lastName" />
        </label>
        <label class="field full">
          <span>Email</span>
          <input pInputText type="email" formControlName="email" />
        </label>
        @if (!editingId) {
          <label class="field full">
            <span>Temporary password</span>
            <input pInputText type="password" formControlName="password" />
          </label>
        }
        <label class="field">
          <span>Employee code</span>
          <input pInputText formControlName="employeeCode" />
        </label>
        <label class="field">
          <span>Phone</span>
          <input pInputText formControlName="phone" />
        </label>
        <div class="field">
          <span>Role</span>
          <p-select
            [options]="roleOptions"
            formControlName="role"
            appendTo="body"
          />
        </div>
        <div class="field">
          <span>Status</span>
          <p-select
            [options]="statusOptions"
            formControlName="status"
            appendTo="body"
          />
        </div>
        <div class="field">
          <span>Department</span>
          <p-select
            [options]="departmentOptions()"
            optionLabel="label"
            optionValue="value"
            formControlName="departmentId"
            placeholder="Department"
            [showClear]="true"
            appendTo="body"
          />
        </div>
        <div class="field">
          <span>Manager</span>
          <p-select
            [options]="managerOptions()"
            optionLabel="label"
            optionValue="value"
            formControlName="managerId"
            placeholder="Manager"
            [showClear]="true"
            appendTo="body"
          />
        </div>
        <div class="full actions">
          <p-button type="button" label="Cancel" severity="secondary" [text]="true" (onClick)="dialogVisible = false" />
          <p-button type="submit" label="Save" [loading]="saving()" [disabled]="form.invalid || saving()" />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [
    `
      .header-row {
        display: flex;
        justify-content: space-between;
        gap: var(--ctp-section-gap);
        align-items: flex-start;
      }
      .panel {
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--ctp-card-pad);
      }
      .filters {
        display: grid;
        grid-template-columns: 2fr repeat(3, 1fr);
        gap: var(--s2);
        margin-bottom: var(--ctp-section-gap);
      }
      .actions {
        display: flex;
        gap: 2px;
        justify-content: flex-end;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s3);
      }
      .field {
        display: grid;
        gap: 4px;
        font-size: var(--ctp-fs-label);
      }
      .full {
        grid-column: 1 / -1;
      }
      @media (max-width: 900px) {
        .filters {
          grid-template-columns: 1fr;
        }
        .header-row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class UsersPageComponent implements OnInit {
  private readonly usersApi = inject(UsersApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<UserDto[]>([]);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly managers = signal<UserDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);

  page = 1;
  pageSize = 10;
  search = '';
  role: AppRole | null = null;
  status: UserStatus | null = null;
  departmentId: string | null = null;
  dialogVisible = false;
  editingId: string | null = null;

  readonly roleOptions = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'];
  readonly statusOptions = ['ACTIVE', 'INACTIVE', 'LOCKED'];

  readonly form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    employeeCode: [''],
    phone: [''],
    role: ['EMPLOYEE' as AppRole, Validators.required],
    status: ['ACTIVE' as UserStatus, Validators.required],
    departmentId: [null as string | null],
    managerId: [null as string | null],
  });

  ngOnInit(): void {
    this.departmentsApi.list({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => this.departments.set(res.items),
    });
    this.usersApi.list({ page: 1, pageSize: 100 }).subscribe({
      next: (res) =>
        this.managers.set(
          res.items.filter((u) =>
            ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(u.role),
          ),
        ),
    });
    this.reload();
  }

  departmentOptions = computed(() =>
    this.departments().map((d) => ({ label: d.name, value: d.id })),
  );

  managerOptions = computed(() =>
    this.managers().map((m) => ({
      label: `${m.firstName} ${m.lastName}`,
      value: m.id,
    })),
  );

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.usersApi
      .list({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search || undefined,
        role: this.role || undefined,
        status: this.status || undefined,
        departmentId: this.departmentId || undefined,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.items);
          this.total.set(res.meta.totalItems);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.error?.message ?? 'Failed to load users');
        },
      });
  }

  onPage(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.pageSize;
    this.pageSize = rows;
    this.page = Math.floor(first / rows) + 1;
    this.reload();
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      departmentId: null,
      managerId: null,
    });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.dialogVisible = true;
  }

  openEdit(user: UserDto): void {
    this.editingId = user.id;
    this.form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      employeeCode: user.employeeCode ?? '',
      phone: user.phone ?? '',
      role: user.role,
      status: user.status,
      departmentId: user.departmentId,
      managerId: user.managerId,
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.dialogVisible = true;
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const body: Record<string, unknown> = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      employeeCode: raw.employeeCode || null,
      phone: raw.phone || null,
      role: raw.role,
      status: raw.status,
      departmentId: raw.departmentId || null,
      managerId: raw.managerId || null,
    };

    const request = this.editingId
      ? this.usersApi.update(this.editingId, body)
      : this.usersApi.create({ ...body, password: raw.password });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error?.message ?? 'Save failed');
      },
    });
  }

  remove(user: UserDto): void {
    if (!confirm(`Soft delete ${user.firstName} ${user.lastName}?`)) {
      return;
    }
    this.usersApi.remove(user.id).subscribe({
      next: () => this.reload(),
      error: (err) =>
        this.error.set(err?.error?.error?.message ?? 'Delete failed'),
    });
  }

  statusSeverity(status: UserStatus): 'success' | 'warn' | 'danger' {
    if (status === 'ACTIVE') return 'success';
    if (status === 'LOCKED') return 'danger';
    return 'warn';
  }
}
