import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { DepartmentsApiService } from '../../core/http/departments-api.service';
import type { DepartmentDto } from '../../core/models/domain.models';

@Component({
  selector: 'app-departments-page',
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
    Textarea,
    Message,
  ],
  template: `
    <div class="header-row">
      <app-page-header
        eyebrow="Administration"
        title="Departments"
        subtitle="Maintain organizational units used for employee grouping."
      />
      <p-button label="Add department" icon="pi pi-plus" (onClick)="openCreate()" />
    </div>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-4" />
    }

    <section class="filters panel">
      <input
        pInputText
        placeholder="Search by name or code"
        [(ngModel)]="search"
        (ngModelChange)="reload()"
      />
    </section>

    @if (loading()) {
      <app-loading-state message="Loading departments…" />
    } @else {
      <div class="panel">
        <p-table
          [value]="items()"
          [paginator]="true"
          [rows]="pageSize"
          [lazy]="true"
          [totalRecords]="total()"
          (onPage)="onPage($event)"
          [first]="(page - 1) * pageSize"
        >
          <ng-template #header>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Description</th>
              <th></th>
            </tr>
          </ng-template>
          <ng-template #body let-item>
            <tr>
              <td>{{ item.name }}</td>
              <td>{{ item.code }}</td>
              <td>{{ item.description || '—' }}</td>
              <td class="actions">
                <p-button icon="pi pi-pencil" [text]="true" (onClick)="openEdit(item)" />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  (onClick)="remove(item)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <p-dialog
      [(visible)]="dialogVisible"
      [header]="editingId ? 'Edit department' : 'Add department'"
      [modal]="true"
      [style]="{ width: '480px' }"
    >
      <form class="form-stack" [formGroup]="form" (ngSubmit)="save()">
        <label class="field">
          <span>Name</span>
          <input pInputText formControlName="name" />
        </label>
        <label class="field">
          <span>Code</span>
          <input pInputText formControlName="code" />
        </label>
        <label class="field">
          <span>Description</span>
          <textarea pTextarea rows="3" formControlName="description"></textarea>
        </label>
        <div class="actions">
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
        margin-bottom: var(--ctp-section-gap);
      }
      .filters input {
        width: min(360px, 100%);
      }
      .actions {
        display: flex;
        gap: 4px;
        justify-content: flex-end;
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
export class DepartmentsPageComponent implements OnInit {
  private readonly api = inject(DepartmentsApiService);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<DepartmentDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);

  page = 1;
  pageSize = 10;
  search = '';
  dialogVisible = false;
  editingId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    code: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search || undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.meta.totalItems);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.error?.message ?? 'Failed to load departments');
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
    this.form.reset({ name: '', code: '', description: '' });
    this.dialogVisible = true;
  }

  openEdit(item: DepartmentDto): void {
    this.editingId = item.id;
    this.form.reset({
      name: item.name,
      code: item.code,
      description: item.description ?? '',
    });
    this.dialogVisible = true;
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const body = {
      name: raw.name,
      code: raw.code.toUpperCase(),
      description: raw.description || undefined,
    };

    const request = this.editingId
      ? this.api.update(this.editingId, body)
      : this.api.create(body);

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

  remove(item: DepartmentDto): void {
    if (!confirm(`Soft delete department ${item.name}?`)) {
      return;
    }
    this.api.remove(item.id).subscribe({
      next: () => this.reload(),
      error: (err) =>
        this.error.set(err?.error?.error?.message ?? 'Delete failed'),
    });
  }
}
