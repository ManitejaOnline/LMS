import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { RadioButton } from 'primeng/radiobutton';
import { Textarea } from 'primeng/textarea';
import { CoursesApiService } from '../../core/http/courses-api.service';
import { DepartmentsApiService } from '../../core/http/departments-api.service';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import { UsersApiService } from '../../core/http/users-api.service';
import type { CourseDto, DepartmentDto, UserDto } from '../../core/models/domain.models';
import type { ProgramDetail, ProgramLevel } from '../../core/models/program.models';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { QuizBankEditorComponent } from '../../shared/components/quiz-bank-editor/quiz-bank-editor.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

type AssignScope = 'ALL_EMPLOYEES' | 'DEPARTMENT' | 'ROLE' | 'EMPLOYEES';

@Component({
  selector: 'app-program-editor-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
    QuizBankEditorComponent,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DragDropModule,
    Button,
    InputText,
    Textarea,
    Message,
    Dialog,
    Checkbox,
    RadioButton,
    MultiSelect,
  ],
  template: `
    <div class="header-row">
      <app-page-header
        [title]="isNew() ? 'Create Program' : program()?.name || 'Program'"
        subtitle="Program → Levels → existing courses. Level numbers come from order."
      />
      <a routerLink="/app/programs" class="no-underline">
        <p-button label="Back" [text]="true" icon="pi pi-arrow-left" />
      </a>
    </div>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-3" />
    }
    @if (info()) {
      <p-message severity="success" [text]="info()!" styleClass="w-full mb-3" />
    }

    @if (loading()) {
      <app-loading-state message="Loading program…" />
    } @else {
      <section class="ctp-card panel">
        <h2>Program details</h2>
        <form [formGroup]="form" (ngSubmit)="saveDetails()" class="form">
          <label>
            <span>Program name</span>
            <input pInputText formControlName="name" />
          </label>
          <label>
            <span>Description</span>
            <textarea pTextarea formControlName="description" rows="3"></textarea>
          </label>
          <div class="row">
            <p-button type="submit" [label]="isNew() ? 'Create Program' : 'Save'" [loading]="saving()" />
            @if (program()) {
              <app-status-badge [status]="program()!.status" />
            }
          </div>
        </form>
      </section>

      @if (program(); as prog) {
        <section class="ctp-card panel">
          <h2>Publish readiness</h2>
          @if (prog.publishReadiness.ready) {
            <p class="ok">Ready to publish.</p>
          } @else {
            <ul class="issues">
              @for (issue of prog.publishReadiness.issues; track issue) {
                <li>{{ issue }}</li>
              }
            </ul>
          }
          <div class="row">
            @if (prog.status !== 'PUBLISHED') {
              <p-button
                label="Publish Program"
                [disabled]="!prog.publishReadiness.ready"
                (onClick)="setStatus('PUBLISHED')"
              />
            }
            @if (prog.status === 'PUBLISHED') {
              <p-button label="Archive" severity="secondary" [outlined]="true" (onClick)="setStatus('ARCHIVED')" />
            }
            @if (prog.status === 'ARCHIVED') {
              <p-button label="Return to draft" [outlined]="true" (onClick)="setStatus('DRAFT')" />
            }
            <p-button label="Delete" severity="danger" [text]="true" (onClick)="remove()" />
          </div>
        </section>

        <section class="ctp-card panel">
          <div class="section-head">
            <h2>Levels</h2>
            <p-button label="Add Level" icon="pi pi-plus" size="small" (onClick)="openLevelDialog()" />
          </div>
          <div cdkDropList (cdkDropListDropped)="onLevelDrop($event)" [cdkDropListDisabled]="prog.levels.length < 2">
            @for (level of prog.levels; track level.id; let i = $index) {
              <article class="level" cdkDrag>
                <div class="level-head">
                  <button type="button" class="drag" cdkDragHandle aria-label="Reorder level">
                    <i class="pi pi-bars"></i>
                  </button>
                  <div>
                    <p class="eyebrow">{{ level.isFinal ? 'FINAL LEVEL' : 'LEVEL ' + (i + 1) }}</p>
                    <h3>{{ level.title }}</h3>
                    <p class="muted">
                      {{ level.courses.length }} Courses
                      @if (level.isFinal) {
                        · Final Assessment
                      }
                    </p>
                  </div>
                  <div class="level-actions">
                    <p-button label="Edit" [text]="true" size="small" (onClick)="openLevelDialog(level)" />
                    <p-button label="Manage Courses" [text]="true" size="small" (onClick)="openCourses(level)" />
                    @if (level.isFinal) {
                      <p-button label="Configure" [text]="true" size="small" (onClick)="openAssessment(level)" />
                    }
                    <p-button label="Delete" severity="danger" [text]="true" size="small" (onClick)="deleteLevel(level)" />
                  </div>
                </div>
                <ul class="course-list">
                  @for (row of level.courses; track row.id) {
                    <li>
                      <span>{{ row.course.title }}</span>
                      <span class="muted">{{ row.isRequired ? 'Required' : 'Optional' }}</span>
                    </li>
                  }
                </ul>
              </article>
            } @empty {
              <p class="muted">Add Level 1 to start the program path.</p>
            }
          </div>
        </section>

        @if (prog.status === 'PUBLISHED') {
          <section class="ctp-card panel">
            <h2>Assign program</h2>
            <p class="muted">Assign the entire program. Employees start at Level 1.</p>
            <form [formGroup]="assignForm" (ngSubmit)="assign()" class="form">
              <fieldset class="scopes">
                <label><p-radioButton name="scope" value="ALL_EMPLOYEES" formControlName="scope" /> All Employees</label>
                <label><p-radioButton name="scope" value="DEPARTMENT" formControlName="scope" /> Department</label>
                <label><p-radioButton name="scope" value="ROLE" formControlName="scope" /> Role</label>
                <label><p-radioButton name="scope" value="EMPLOYEES" formControlName="scope" /> Specific Employees</label>
              </fieldset>
              @if (assignForm.value.scope === 'DEPARTMENT') {
                <p-multiSelect
                  formControlName="departmentIds"
                  [options]="departmentOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Departments"
                  display="chip"
                  styleClass="w-full"
                />
              }
              @if (assignForm.value.scope === 'ROLE') {
                <p-multiSelect
                  formControlName="roles"
                  [options]="roleOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Roles"
                  display="chip"
                  styleClass="w-full"
                />
              }
              @if (assignForm.value.scope === 'EMPLOYEES') {
                <p-multiSelect
                  formControlName="userIds"
                  [options]="employeeOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Employees"
                  [filter]="true"
                  display="chip"
                  styleClass="w-full"
                />
              }
              <label class="check">
                <p-checkbox formControlName="sendNotification" [binary]="true" inputId="notify" />
                Notify employees
              </label>
              <p-button type="submit" label="Assign Program" [loading]="assigning()" />
            </form>
          </section>
        }
      }
    }

    <p-dialog
      header="Level"
      [(visible)]="levelDialog"
      [modal]="true"
      [style]="{ width: 'min(480px, 96vw)' }"
    >
      <form [formGroup]="levelForm" class="form">
        <label>
          <span>Title</span>
          <input pInputText formControlName="title" />
        </label>
        <label>
          <span>Description</span>
          <textarea pTextarea formControlName="description" rows="3"></textarea>
        </label>
        <label class="check">
          <p-checkbox formControlName="isFinal" [binary]="true" inputId="final" />
          Mark as Final Level
        </label>
        <p class="muted">Only one final level is allowed. Completion rule: all required courses.</p>
        <p-button label="Save Level" (onClick)="saveLevel()" />
      </form>
    </p-dialog>

    <p-dialog
      header="Add published courses"
      [(visible)]="coursesDialog"
      [modal]="true"
      [style]="{ width: 'min(640px, 96vw)' }"
    >
      <input pInputText [(ngModel)]="courseSearch" (ngModelChange)="searchCourses()" placeholder="Search name or code" class="w-full mb" />
      <div class="pick-list">
        @for (course of publishedCourses(); track course.id) {
          <label class="pick">
            <p-checkbox
              [binary]="true"
              [ngModel]="selectedCourseIds().includes(course.id)"
              (ngModelChange)="toggleCourse(course.id, $event)"
              [inputId]="'c-' + course.id"
            />
            <span>{{ course.title }} <span class="muted">{{ course.code }}</span></span>
          </label>
        }
      </div>
      <div class="row mt">
        <p-button label="Add Selected Courses" (onClick)="addSelectedCourses()" [disabled]="!selectedCourseIds().length" />
      </div>
      @if (activeLevel(); as level) {
        <h3 class="sub">In this level</h3>
        <div cdkDropList (cdkDropListDropped)="onCourseDrop($event)" [cdkDropListDisabled]="level.courses.length < 2">
          @for (row of level.courses; track row.id) {
            <div class="in-level" cdkDrag>
              <span>{{ row.course.title }}</span>
              <label class="check">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="row.isRequired"
                  (ngModelChange)="toggleRequired(row.id, $event)"
                />
                Required
              </label>
              <p-button icon="pi pi-trash" [text]="true" severity="danger" (onClick)="removeCourse(row.id)" />
            </div>
          }
        </div>
      }
    </p-dialog>

    <app-quiz-bank-editor #quizEditor (saved)="reloadAfterAssessment()" />
  `,
  styles: [
    `
      .header-row,
      .section-head,
      .row,
      .level-head,
      .in-level {
        display: flex;
        justify-content: space-between;
        gap: var(--s3);
        align-items: flex-start;
      }
      .panel {
        padding: var(--ctp-card-pad);
        margin-bottom: var(--ctp-section-gap);
      }
      h2 {
        margin: 0 0 var(--s3);
        font-size: var(--ctp-fs-card);
      }
      .form,
      .pick-list {
        display: grid;
        gap: var(--s3);
      }
      label {
        display: grid;
        gap: 6px;
        font-size: var(--ctp-fs-small);
      }
      .level {
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--s3);
        margin-bottom: var(--s3);
        background: var(--ctp-panel);
      }
      .eyebrow {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.08em;
        color: var(--ctp-muted);
      }
      h3 {
        margin: 2px 0;
        font-size: var(--ctp-fs-body);
      }
      .muted {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .ok {
        color: var(--ctp-success, #157347);
      }
      .issues {
        margin: 0 0 var(--s3);
        padding-left: 1.1rem;
      }
      .course-list {
        margin: var(--s2) 0 0;
        padding: 0;
        list-style: none;
      }
      .course-list li,
      .in-level,
      .pick {
        display: flex;
        justify-content: space-between;
        gap: var(--s2);
        align-items: center;
        min-height: 44px;
      }
      .drag {
        border: 0;
        background: transparent;
        min-width: 44px;
        min-height: 44px;
        cursor: grab;
      }
      .scopes {
        display: grid;
        gap: 8px;
        border: 0;
        padding: 0;
      }
      .scopes label,
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
      }
      .level-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .mb {
        margin-bottom: var(--s3);
      }
      .mt {
        margin-top: var(--s3);
      }
      .w-full {
        width: 100%;
      }
      .sub {
        margin: var(--s4) 0 var(--s2);
        font-size: var(--ctp-fs-body);
      }
      @media (max-width: 800px) {
        .header-row,
        .level-head,
        .section-head {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ProgramEditorPageComponent implements OnInit {
  private readonly api = inject(ProgramsApiService);
  private readonly coursesApi = inject(CoursesApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly assigning = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly program = signal<ProgramDetail | null>(null);
  readonly publishedCourses = signal<CourseDto[]>([]);
  readonly selectedCourseIds = signal<string[]>([]);
  readonly activeLevel = signal<ProgramLevel | null>(null);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly employees = signal<UserDto[]>([]);
  readonly quizEditor = viewChild(QuizBankEditorComponent);

  levelDialog = false;
  coursesDialog = false;
  courseSearch = '';
  editingLevelId: string | null = null;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
  });

  readonly levelForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    isFinal: [false],
  });

  readonly assignForm = this.fb.group({
    scope: ['ALL_EMPLOYEES' as AssignScope, Validators.required],
    departmentIds: [[] as string[]],
    roles: [[] as string[]],
    userIds: [[] as string[]],
    sendNotification: [true],
  });

  readonly roleOptions = [
    { label: 'Employee', value: 'EMPLOYEE' },
    { label: 'Manager', value: 'MANAGER' },
  ];

  ngOnInit(): void {
    this.departmentsApi.list({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => this.departments.set(res.items),
    });
    this.usersApi.list({ page: 1, pageSize: 200, status: 'ACTIVE', role: 'EMPLOYEE' }).subscribe({
      next: (res) => this.employees.set(res.items),
    });
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id || id === 'new') {
        this.program.set(null);
        this.form.reset({ name: '', description: '' });
        return;
      }
      this.load(id);
    });
  }

  isNew(): boolean {
    return this.route.snapshot.paramMap.get('id') === 'new';
  }

  departmentOptions() {
    return this.departments().map((d) => ({ label: d.name, value: d.id }));
  }

  employeeOptions() {
    return this.employees().map((u) => ({
      label: `${u.firstName} ${u.lastName} (${u.email})`,
      value: u.id,
    }));
  }

  saveDetails(): void {
    if (this.form.invalid) {
      this.error.set('Program name is required.');
      return;
    }
    const body = {
      name: this.form.value.name!.trim(),
      description: this.form.value.description?.trim() || undefined,
    };
    this.saving.set(true);
    this.error.set(null);
    if (this.isNew()) {
      this.api.create(body).subscribe({
        next: (program) => {
          this.saving.set(false);
          void this.router.navigate(['/app/programs', program.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.error?.message ?? 'Create failed');
        },
      });
      return;
    }
    this.api.update(this.program()!.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.load(this.program()!.id);
        this.info.set('Program saved.');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error?.message ?? 'Save failed');
      },
    });
  }

  setStatus(status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'): void {
    const id = this.program()?.id;
    if (!id) return;
    this.api.updateStatus(id, status).subscribe({
      next: (program) => {
        this.program.set(program);
        this.info.set(`Program ${status.toLowerCase()}.`);
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Status update failed'),
    });
  }

  remove(): void {
    const id = this.program()?.id;
    if (!id) return;
    this.api.remove(id).subscribe({
      next: () => void this.router.navigate(['/app/programs']),
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Delete failed'),
    });
  }

  openLevelDialog(level?: ProgramLevel): void {
    this.editingLevelId = level?.id ?? null;
    this.levelForm.reset({
      title: level?.title ?? '',
      description: level?.description ?? '',
      isFinal: !!level?.isFinal,
    });
    this.levelDialog = true;
  }

  saveLevel(): void {
    if (this.levelForm.invalid) return;
    const body = {
      title: this.levelForm.value.title!.trim(),
      description: this.levelForm.value.description?.trim() || undefined,
      isFinal: !!this.levelForm.value.isFinal,
    };
    const programId = this.program()!.id;
    const req = this.editingLevelId
      ? this.api.updateLevel(this.editingLevelId, body)
      : this.api.createLevel(programId, body);
    req.subscribe({
      next: (program) => {
        this.program.set(program);
        this.levelDialog = false;
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Could not save level'),
    });
  }

  deleteLevel(level: ProgramLevel): void {
    this.api.deleteLevel(level.id).subscribe({
      next: (program) => this.program.set(program),
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Could not delete level'),
    });
  }

  onLevelDrop(event: CdkDragDrop<ProgramLevel[]>): void {
    const levels = [...(this.program()?.levels ?? [])];
    moveItemInArray(levels, event.previousIndex, event.currentIndex);
    this.api.reorderLevels(this.program()!.id, levels.map((level) => ({ id: level.id }))).subscribe({
      next: (program) => this.program.set(program),
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Reorder failed'),
    });
  }

  openCourses(level: ProgramLevel): void {
    this.activeLevel.set(level);
    this.selectedCourseIds.set([]);
    this.courseSearch = '';
    this.coursesDialog = true;
    this.searchCourses();
  }

  searchCourses(): void {
    this.coursesApi.list({ page: 1, pageSize: 50, status: 'PUBLISHED', search: this.courseSearch }).subscribe({
      next: (res) => {
        const existing = new Set((this.activeLevel()?.courses ?? []).map((row) => row.courseId));
        this.publishedCourses.set(res.items.filter((course) => !existing.has(course.id)));
      },
    });
  }

  toggleCourse(id: string, checked: boolean): void {
    const next = new Set(this.selectedCourseIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedCourseIds.set([...next]);
  }

  addSelectedCourses(): void {
    const level = this.activeLevel();
    if (!level) return;
    this.api.addCourses(level.id, this.selectedCourseIds()).subscribe({
      next: (program) => {
        this.program.set(program);
        this.activeLevel.set(program.levels.find((item) => item.id === level.id) ?? null);
        this.selectedCourseIds.set([]);
        this.searchCourses();
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Could not add courses'),
    });
  }

  toggleRequired(levelCourseId: string, isRequired: boolean): void {
    this.api.updateLevelCourse(levelCourseId, isRequired).subscribe({
      next: (program) => {
        this.program.set(program);
        const id = this.activeLevel()?.id;
        this.activeLevel.set(program.levels.find((item) => item.id === id) ?? null);
      },
    });
  }

  removeCourse(levelCourseId: string): void {
    this.api.removeLevelCourse(levelCourseId).subscribe({
      next: (program) => {
        this.program.set(program);
        const id = this.activeLevel()?.id;
        this.activeLevel.set(program.levels.find((item) => item.id === id) ?? null);
        this.searchCourses();
      },
    });
  }

  onCourseDrop(event: CdkDragDrop<unknown>): void {
    const level = this.activeLevel();
    if (!level) return;
    const rows = [...level.courses];
    moveItemInArray(rows, event.previousIndex, event.currentIndex);
    this.api.reorderLevelCourses(level.id, rows.map((row) => ({ id: row.id }))).subscribe({
      next: (program) => {
        this.program.set(program);
        this.activeLevel.set(program.levels.find((item) => item.id === level.id) ?? null);
      },
    });
  }

  openAssessment(level: ProgramLevel): void {
    this.quizEditor()?.openForLevel(level.id);
  }

  reloadAfterAssessment(): void {
    const id = this.program()?.id;
    if (id) this.load(id);
  }

  assign(): void {
    const raw = this.assignForm.getRawValue();
    this.assigning.set(true);
    this.api
      .assign(this.program()!.id, {
        scope: raw.scope as AssignScope,
        departmentIds: raw.departmentIds ?? [],
        roles: raw.roles ?? [],
        userIds: raw.userIds ?? [],
        sendNotification: !!raw.sendNotification,
      })
      .subscribe({
        next: (res) => {
          this.assigning.set(false);
          this.info.set(`Assigned to ${res.assigned} employees.`);
        },
        error: (err) => {
          this.assigning.set(false);
          this.error.set(err?.error?.error?.message ?? 'Assignment failed');
        },
      });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (program) => {
        this.program.set(program);
        this.form.patchValue({ name: program.name, description: program.description ?? '' });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Failed to load program');
      },
    });
  }
}
