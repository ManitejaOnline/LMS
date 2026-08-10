import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Checkbox } from 'primeng/checkbox';
import { RadioButton } from 'primeng/radiobutton';
import { MultiSelect } from 'primeng/multiselect';
import { Message } from 'primeng/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UploadDialogComponent } from '../../shared/components/upload-dialog/upload-dialog.component';
import { AssessmentEditorComponent } from '../../shared/components/assessment-editor/assessment-editor.component';
import { QuizApiService } from '../../core/http/quiz-api.service';
import { CoursesApiService } from '../../core/http/courses-api.service';
import { LearningApiService } from '../../core/http/learning-api.service';
import { DepartmentsApiService } from '../../core/http/departments-api.service';
import { UsersApiService } from '../../core/http/users-api.service';
import { ProtectedMediaService } from '../../core/content-protection/protected-media.service';
import type {
  CourseDto,
  CourseModuleDto,
  CourseStatus,
  DepartmentDto,
  LessonDto,
  MediaAssetDto,
  UserDto,
} from '../../core/models/domain.models';

type AssignScope = 'ALL_EMPLOYEES' | 'DEPARTMENT' | 'ROLE' | 'EMPLOYEES';

type AssignmentSummary = {
  assigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
};
import { environment } from '../../../environments/environment';
import { chapterConfig, detectPdfPageCount, readChapterBounds } from '../../shared/utils/pdf-meta.util';
import { requireMediaAssetId } from '../../shared/utils/media-id.util';
import { detectVideoDuration, formatBytes, formatDuration } from '../../shared/utils/video-meta.util';
import { firstValueFrom } from 'rxjs';

type AuthorStep = 'details' | 'content' | 'publish' | 'assign';
type UploadTarget = 'thumbnail' | 'pdf' | 'video';

@Component({
  selector: 'app-course-editor-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
    UploadDialogComponent,
    AssessmentEditorComponent,
    Dialog,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    DragDropModule,
    Button,
    InputText,
    Textarea,
    Checkbox,
    RadioButton,
    MultiSelect,
    Message,
  ],
  template: `
    @if (loading()) {
      <app-loading-state message="Loading course authoring…" />
    } @else {
      <div class="page">
        <div class="header-row">
          <app-page-header
            [eyebrow]="isNew() ? 'New course' : 'Course authoring'"
            [title]="course()?.title || 'Create course'"
            subtitle="Author details and content, publish when ready, then assign learners."
          />
          <div class="header-actions">
            @if (course()) {
              <app-status-badge [status]="course()!.status" />
            }
            <a routerLink="/app/courses" class="no-underline">
              <p-button label="Back" severity="secondary" [outlined]="true" size="small" />
            </a>
          </div>
        </div>

        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="w-full mb-2" />
        }
        @if (info()) {
          <p-message severity="success" [text]="info()!" styleClass="w-full mb-2" />
        }

        <nav class="steps" aria-label="Authoring steps">
          @for (s of stepMeta; track s.id) {
            <button
              type="button"
              class="step"
              [class.active]="step() === s.id"
              [class.done]="isStepDone(s.id)"
              [disabled]="!canOpenStep(s.id)"
              (click)="goStep(s.id)"
            >
              <span class="step-num">{{ $index + 1 }}</span>
              <span class="step-label">
                <strong>{{ s.label }}</strong>
                <small>{{ s.hint }}</small>
              </span>
            </button>
          }
        </nav>

        @if (step() === 'details') {
          <section class="panel">
            <h2 class="panel-title">Course details</h2>
            <form class="form-grid" [formGroup]="courseForm" (ngSubmit)="saveCourse()">
              <label class="field full">
                <span>Title</span>
                <input pInputText formControlName="title" />
              </label>
              <label class="field">
                <span>Code</span>
                <input pInputText formControlName="code" />
              </label>
              <label class="field">
                <span>Est. minutes</span>
                <input pInputText type="number" formControlName="estimatedMinutes" />
              </label>
              <label class="field full">
                <span>Description</span>
                <textarea pTextarea rows="3" formControlName="description"></textarea>
              </label>
              <label class="check full">
                <p-checkbox formControlName="isMandatory" [binary]="true" inputId="mandatory" />
                <label for="mandatory">Mandatory course</label>
              </label>

              <div class="thumb full">
                @if (thumbnailPreview()) {
                  <img [src]="thumbnailPreview()!" alt="Thumbnail" />
                } @else {
                  <div class="thumb-empty">No thumbnail</div>
                }
                <p-button
                  type="button"
                  label="Upload thumbnail"
                  severity="secondary"
                  [outlined]="true"
                  size="small"
                  (onClick)="openUpload('THUMBNAIL')"
                />
              </div>

              <div class="full actions">
                <p-button type="submit" label="Save" [loading]="saving()" size="small" />
                @if (course()) {
                  <p-button
                    type="button"
                    label="Continue to content"
                    [text]="true"
                    size="small"
                    (onClick)="goStep('content')"
                  />
                }
              </div>
            </form>
          </section>
        }

        @if (step() === 'content' && course()) {
          <section class="panel content-panel">
            <div class="section-head">
              <div>
                <h2 class="panel-title">Course content</h2>
                <p class="section-sub">Add ordered PDF and video lessons. Drag to reorder.</p>
              </div>
              <div class="actions">
                <p-button
                  label="Add Lesson"
                  icon="pi pi-plus"
                  size="small"
                  (onClick)="openLessonDialog()"
                />
                <p-button
                  label="Continue to Publish"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  severity="secondary"
                  [outlined]="true"
                  size="small"
                  (onClick)="goStep('publish')"
                />
              </div>
            </div>

            @if (outlineLessons().length === 0) {
              <p class="muted empty-hint">No lessons yet. Click + Add Lesson to start the sequence.</p>
            }

            <div
              class="lesson-cards"
              cdkDropList
              [cdkDropListData]="outlineLessons()"
              [cdkDropListDisabled]="outlineLessons().length < 2"
              (cdkDropListDropped)="onOutlineDrop($event)"
            >
              @for (lesson of outlineLessons(); track lesson.id; let i = $index) {
                <article class="lesson-card" cdkDrag [cdkDragDisabled]="outlineLessons().length < 2">
                  <i class="pi pi-bars drag-handle" cdkDragHandle></i>
                  <div class="lesson-card-body">
                    <div class="lesson-card-title">
                      <span class="lesson-index">{{ i + 1 }}</span>
                      <strong>{{ lesson.title }}</strong>
                    </div>
                    <div class="lesson-meta">
                      {{ lessonSummary(lesson) }}
                    </div>
                    <div class="lesson-card-actions">
                      <p-button label="Edit" [text]="true" size="small" (onClick)="openLessonDialog(lesson)" />
                      <p-button label="Preview" [text]="true" size="small" (onClick)="previewLesson(lesson)" />
                      <p-button
                        label="Delete"
                        severity="danger"
                        [text]="true"
                        size="small"
                        (onClick)="removeLesson(lesson)"
                      />
                    </div>
                    <div class="assessment-block">
                      @if (lesson.quiz) {
                        <div class="assessment-meta">
                          <strong>Assessment</strong>
                          <span>{{ lesson.quiz._count?.questions ?? 0 }} questions · Pass {{ lesson.quiz.passingScore }}%</span>
                        </div>
                        <div class="lesson-card-actions">
                          <p-button label="Edit assessment" [text]="true" size="small" (onClick)="openAssessmentEditor(lesson)" />
                          <p-button label="Preview" [text]="true" size="small" (onClick)="previewAssessment(lesson)" />
                          <p-button label="Delete" severity="danger" [text]="true" size="small" (onClick)="deleteAssessment(lesson)" />
                        </div>
                      } @else {
                        <p-button
                          label="Add Assessment"
                          icon="pi pi-plus"
                          [text]="true"
                          size="small"
                          (onClick)="openAssessmentEditor(lesson)"
                        />
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        @if (step() === 'publish' && course()) {
          <section class="panel">
            <div class="section-head">
              <div>
                <h2 class="panel-title">Publish</h2>
                <p class="section-sub">
                  Review readiness, then publish. Assignment is available only after a successful publish.
                </p>
              </div>
              <app-status-badge [status]="course()!.status" />
            </div>

            <div class="readiness-panel" [class.ready]="canPublish()" [class.blocked]="!canPublish()">
              <div class="readiness-head">
                <h3>Publish Readiness</h3>
                @if (canPublish()) {
                  <span class="ready-badge">Ready to publish</span>
                } @else {
                  <span class="blocked-badge">Fix the items below before publishing</span>
                }
              </div>
              <ul class="checklist">
                @for (item of readiness(); track item.label) {
                  <li [class.ok]="item.ok" [class.bad]="!item.ok">
                    <i
                      class="pi"
                      [class.pi-check-circle]="item.ok"
                      [class.pi-times-circle]="!item.ok"
                    ></i>
                    <span>
                      <strong>{{ item.label }}</strong>
                      @if (!item.ok && item.hint) {
                        <small>{{ item.hint }}</small>
                      }
                    </span>
                  </li>
                }
              </ul>
            </div>

            <div class="actions wrap">
              <p-button
                label="Publish"
                severity="success"
                size="small"
                [disabled]="!canPublish() || course()!.status === 'PUBLISHED' || publishing()"
                [loading]="publishing()"
                (onClick)="publishCourse()"
              />
              <p-button
                label="Unpublish"
                severity="secondary"
                [outlined]="true"
                size="small"
                [disabled]="course()!.status !== 'PUBLISHED' || publishing()"
                (onClick)="changeStatus('DRAFT')"
              />
              <p-button
                label="Archive"
                severity="secondary"
                [outlined]="true"
                size="small"
                [disabled]="course()!.status === 'ARCHIVED' || publishing()"
                (onClick)="changeStatus('ARCHIVED')"
              />
              @if (course()!.status === 'PUBLISHED') {
                <p-button
                  label="Continue to Assign"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  [text]="true"
                  size="small"
                  (onClick)="goStep('assign')"
                />
              }
            </div>
          </section>
        }

        @if (step() === 'assign' && course()) {
          <section class="panel">
            @if (course()!.status !== 'PUBLISHED') {
              <p-message
                severity="warn"
                text="This course is not published. Publish successfully before assigning learners."
                styleClass="w-full mb-2"
              />
              <p-button
                label="Go to Publish"
                size="small"
                (onClick)="goStep('publish')"
              />
            } @else {
              <div class="section-head">
                <div>
                  <h2 class="panel-title">Assign course</h2>
                  <p class="section-sub">
                    Choose who should receive this published course. Assignment updates My Learning
                    immediately.
                  </p>
                </div>
              </div>

              @if (assignStats(); as stats) {
                <div class="assign-summary" aria-live="polite">
                  <div class="assign-summary-primary">
                    Assigned to <strong>{{ stats.assigned }}</strong> employees
                  </div>
                  <div class="assign-summary-grid">
                    <div>
                      <span class="muted">Completed</span>
                      <strong>{{ stats.completed }}</strong>
                    </div>
                    <div>
                      <span class="muted">In Progress</span>
                      <strong>{{ stats.inProgress }}</strong>
                    </div>
                    <div>
                      <span class="muted">Not Started</span>
                      <strong>{{ stats.notStarted }}</strong>
                    </div>
                  </div>
                </div>
              }

              <form class="assign-wizard" [formGroup]="assignForm" (ngSubmit)="assignCourse()">
                <fieldset class="assign-scope">
                  <legend>Assignment options</legend>
                  <label class="scope-option">
                    <p-radioButton
                      name="scope"
                      value="ALL_EMPLOYEES"
                      formControlName="scope"
                    />
                    <span>All Employees</span>
                  </label>
                  <label class="scope-option">
                    <p-radioButton
                      name="scope"
                      value="DEPARTMENT"
                      formControlName="scope"
                    />
                    <span>By Department</span>
                  </label>
                  <label class="scope-option">
                    <p-radioButton name="scope" value="ROLE" formControlName="scope" />
                    <span>By Role</span>
                  </label>
                  <label class="scope-option">
                    <p-radioButton
                      name="scope"
                      value="EMPLOYEES"
                      formControlName="scope"
                    />
                    <span>Specific Employees</span>
                  </label>
                </fieldset>

                @if (assignForm.value.scope === 'DEPARTMENT') {
                  <label class="field">
                    <span>Departments</span>
                    <p-multiSelect
                      formControlName="departmentIds"
                      [options]="departmentOptions()"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select departments"
                      [filter]="true"
                      display="chip"
                      styleClass="w-full"
                    />
                  </label>
                }

                @if (assignForm.value.scope === 'ROLE') {
                  <label class="field">
                    <span>Roles</span>
                    <p-multiSelect
                      formControlName="roles"
                      [options]="roleOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select roles"
                      [filter]="true"
                      display="chip"
                      styleClass="w-full"
                    />
                  </label>
                }

                @if (assignForm.value.scope === 'EMPLOYEES') {
                  <label class="field">
                    <span>Employees</span>
                    <p-multiSelect
                      formControlName="userIds"
                      [options]="employeeOptions()"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Search employees"
                      [filter]="true"
                      filterPlaceHolder="Search by name or email"
                      display="chip"
                      styleClass="w-full"
                    />
                  </label>
                }

                <div class="assign-options">
                  <label class="field">
                    <span>Due date</span>
                    <input pInputText type="date" formControlName="dueAt" />
                  </label>
                  <fieldset class="assign-mandatory">
                    <legend>Requirement</legend>
                    <label class="scope-option">
                      <p-radioButton
                        name="isMandatory"
                        [value]="true"
                        formControlName="isMandatory"
                      />
                      <span>Mandatory</span>
                    </label>
                    <label class="scope-option">
                      <p-radioButton
                        name="isMandatory"
                        [value]="false"
                        formControlName="isMandatory"
                      />
                      <span>Optional</span>
                    </label>
                  </fieldset>
                  <label class="check-row">
                    <p-checkbox
                      formControlName="sendNotification"
                      [binary]="true"
                      inputId="assign-notify"
                    />
                    <span>Send notification</span>
                  </label>
                  @if (
                    assignForm.value.scope === 'ALL_EMPLOYEES' ||
                    assignForm.value.scope === 'DEPARTMENT'
                  ) {
                    <label class="check-row">
                      <p-checkbox
                        formControlName="notifyNewEmployees"
                        [binary]="true"
                        inputId="assign-auto"
                      />
                      <span>Notify new employees automatically</span>
                    </label>
                  }
                </div>

                <div class="assign-actions">
                  <p-button
                    type="submit"
                    label="Assign Course"
                    icon="pi pi-send"
                    [loading]="assigning()"
                    [disabled]="!canSubmitAssign() || assigning()"
                  />
                </div>
              </form>
            }
          </section>
        }
      </div>
    }

    <app-upload-dialog
      [visible]="uploadVisible()"
      [fixedKind]="uploadKind()"
      title="Upload file"
      (visibleChange)="uploadVisible.set($event)"
      (uploaded)="onUploaded($event)"
    />

    <app-assessment-editor #assessmentEditor (saved)="onAssessmentSaved()" />

    <p-dialog
      header="{{ editingLessonId ? 'Edit lesson' : 'Add lesson' }}"
      [(visible)]="lessonDialogVisible"
      [modal]="true"
      [focusTrap]="false"
      appendTo="body"
      [style]="{ width: 'min(520px, 94vw)' }"
    >
      <form class="lesson-form" [formGroup]="lessonForm" (ngSubmit)="saveLesson()">
        <label class="field">
          <span>Lesson title</span>
          <input pInputText formControlName="title" />
        </label>
        <label class="field">
          <span>Lesson description</span>
          <textarea pTextarea rows="3" formControlName="description"></textarea>
        </label>
        <fieldset class="lesson-type">
          <legend>Lesson type</legend>
          <label>
            <p-radioButton name="lessonType" value="PDF" formControlName="type" [disabled]="!!editingLessonId" />
            PDF
          </label>
          <label>
            <p-radioButton name="lessonType" value="VIDEO" formControlName="type" [disabled]="!!editingLessonId" />
            Video
          </label>
        </fieldset>
        <div class="field">
          <span>{{ lessonForm.value.type === 'VIDEO' ? 'Video file' : 'PDF file' }}</span>
          <p-button
            type="button"
            [label]="lessonForm.value.type === 'VIDEO' ? 'Upload video' : 'Upload PDF'"
            severity="secondary"
            [outlined]="true"
            size="small"
            (onClick)="openUpload(lessonForm.value.type === 'VIDEO' ? 'VIDEO' : 'DOCUMENT')"
          />
          @if (lessonMedia()) {
            <small class="muted">{{ lessonMedia()!.originalName }} · {{ formatBytes(lessonMedia()!.sizeBytes) }}</small>
          }
          @if (lessonPageCount()) {
            <small>{{ lessonPageCount() }} pages detected</small>
          }
          @if (lessonDuration()) {
            <small>{{ formatDuration(lessonDuration()) }}</small>
          }
        </div>
        @if (lessonPreviewUrl()) {
          @if (lessonForm.value.type === 'VIDEO') {
            <video class="lesson-preview" [src]="lessonPreviewUrl()!" controls></video>
          } @else {
            <a class="preview-link" [href]="lessonPreviewUrl()!" target="_blank" rel="noopener">Open PDF preview</a>
          }
        }
        <div class="actions">
          <p-button type="button" label="Cancel" severity="secondary" [text]="true" (onClick)="lessonDialogVisible = false" />
          <p-button type="submit" label="Save lesson" [loading]="savingLesson()" [disabled]="lessonForm.invalid || !lessonMedia() || savingLesson()" />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: var(--s3);
        font-size: var(--ctp-fs-body);
      }
      .header-row,
      .section-head,
      .header-actions,
      .actions,
      .rule-row,
      .subhead {
        display: flex;
        justify-content: space-between;
        gap: var(--s2);
        align-items: center;
        flex-wrap: wrap;
      }
      .section-sub {
        margin: 4px 0 0;
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
        font-weight: 400;
      }
      .actions.wrap {
        justify-content: flex-start;
      }
      .steps {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--s1);
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 6px;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid transparent;
        background: transparent;
        border-radius: var(--ctp-radius);
        padding: 6px 8px;
        min-height: 40px;
        cursor: pointer;
        text-align: left;
        color: var(--ctp-ink);
      }
      .step:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .step.active {
        background: var(--ctp-primary-soft);
        border-color: color-mix(in srgb, var(--ctp-primary) 35%, transparent);
      }
      .step.done:not(.active) .step-num {
        background: var(--ctp-success);
      }
      .step-num {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--ctp-muted);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        flex-shrink: 0;
      }
      .step.active .step-num {
        background: var(--ctp-primary);
      }
      .step-label {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
      }
      .step-label strong {
        font-size: var(--ctp-fs-label);
        font-weight: 600;
      }
      .step-label small {
        color: var(--ctp-muted);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .panel {
        background: var(--ctp-surface);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--ctp-card-pad);
        box-shadow: var(--ctp-shadow);
      }
      .panel-title {
        margin: 0 0 var(--s3);
        font-size: var(--ctp-fs-section);
        font-weight: 600;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s3);
        margin-top: var(--s3);
      }
      .field {
        display: grid;
        gap: 4px;
      }
      .field span,
      .check label {
        font-size: var(--ctp-fs-label);
        color: var(--ctp-muted);
      }
      .field.inline {
        grid-template-columns: auto 72px;
        align-items: center;
        gap: var(--s2);
      }
      .full {
        grid-column: 1 / -1;
      }
      .check {
        display: flex;
        align-items: center;
        gap: var(--s2);
      }
      .thumb {
        display: flex;
        gap: var(--s3);
        align-items: center;
      }
      .thumb img,
      .thumb-empty {
        width: 72px;
        height: 48px;
        border-radius: var(--ctp-radius);
        object-fit: cover;
        border: 1px solid var(--ctp-border);
      }
      .thumb-empty {
        display: grid;
        place-items: center;
        background: var(--ctp-bg);
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .content-grid {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: var(--s4);
        margin-top: var(--s3);
      }
      .pdf-col,
      .lessons-col {
        display: grid;
        gap: var(--s2);
        align-content: start;
      }
      .subhead h3 {
        margin: 0;
        font-size: var(--ctp-fs-label);
        font-weight: 600;
      }
      .meta {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .sync-hint {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .outline-list {
        display: grid;
        gap: 6px;
      }
      .outline-item {
        display: grid;
        gap: 4px;
      }
      .lesson-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
      }
      .insert-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        padding: 2px 0 6px;
      }
      .insert-row.nested {
        padding: 0 0 4px 28px;
      }
      .insert-label {
        font-size: 11px;
        color: var(--ctp-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-right: 4px;
      }
      .insert-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px dashed var(--ctp-border);
        background: transparent;
        color: var(--ctp-muted);
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11px;
        cursor: pointer;
      }
      .insert-btn:hover:not(:disabled) {
        border-color: var(--ctp-primary);
        color: var(--ctp-primary);
        background: var(--ctp-primary-soft);
      }
      .insert-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .drag-handle {
        cursor: grab;
        color: var(--ctp-muted);
        font-size: 12px;
      }
      .drag-handle.disabled {
        cursor: default;
        opacity: 0.35;
      }
      .reorder-hint {
        margin: 0;
        font-size: var(--ctp-fs-small);
      }
      .lesson-main {
        flex: 1;
        min-width: 0;
      }
      .lesson-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lesson-index {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        background: var(--ctp-border);
        color: var(--ctp-ink);
        font-size: 11px;
        font-weight: 600;
        display: grid;
        place-items: center;
      }
      .lesson-title-input {
        width: 100%;
        border: none;
        background: transparent;
        font-size: 13px;
        font-weight: 560;
        color: var(--ctp-ink);
        padding: 0;
      }
      .lesson-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 4px;
        font-size: var(--ctp-fs-small);
        color: var(--ctp-muted);
      }
      .assign-wizard {
        display: grid;
        gap: var(--s3);
        margin-top: var(--s3);
      }
      .assign-scope,
      .assign-mandatory {
        margin: 0;
        padding: var(--s3);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        display: grid;
        gap: 10px;
      }
      .assign-scope legend,
      .assign-mandatory legend {
        padding: 0 6px;
        font-size: var(--ctp-fs-label);
        font-weight: 600;
      }
      .scope-option {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: var(--ctp-fs-label);
        cursor: pointer;
      }
      .assign-options {
        display: grid;
        gap: 12px;
      }
      .assign-options .field,
      .assign-wizard > .field {
        display: grid;
        gap: 6px;
        font-size: var(--ctp-fs-label);
      }
      .check-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: var(--ctp-fs-label);
      }
      .assign-actions {
        display: flex;
        justify-content: flex-start;
      }
      .assign-summary {
        margin: var(--s3) 0 0;
        padding: var(--s3);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
        display: grid;
        gap: 12px;
      }
      .assign-summary-primary {
        font-size: var(--ctp-fs-label);
      }
      .assign-summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--s2);
      }
      .assign-summary-grid > div {
        display: grid;
        gap: 2px;
      }
      .checklist {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .checklist li {
        display: flex;
        align-items: flex-start;
        gap: var(--s2);
        font-size: var(--ctp-fs-label);
      }
      .checklist li span {
        display: grid;
        gap: 2px;
      }
      .checklist li small {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .checklist li.ok {
        color: var(--ctp-success);
      }
      .checklist li.bad {
        color: var(--ctp-danger);
      }
      .readiness-panel {
        margin: var(--s3) 0;
        padding: var(--s3);
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
      }
      .readiness-panel.ready {
        border-color: color-mix(in srgb, var(--ctp-success) 40%, var(--ctp-border));
        background: var(--ctp-success-soft);
      }
      .readiness-panel.blocked {
        border-color: color-mix(in srgb, var(--ctp-warning) 45%, var(--ctp-border));
        background: var(--ctp-warning-soft);
      }
      .readiness-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s2);
        margin-bottom: var(--s3);
        flex-wrap: wrap;
      }
      .readiness-head h3 {
        margin: 0;
        font-size: var(--ctp-fs-label);
        font-weight: 600;
      }
      .ready-badge {
        font-size: var(--ctp-fs-small);
        font-weight: 600;
        color: var(--ctp-success);
      }
      .blocked-badge {
        font-size: var(--ctp-fs-small);
        font-weight: 600;
        color: #b45309;
      }
      .muted {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .warn {
        color: #b45309;
        font-size: var(--ctp-fs-small);
      }
      .assign-hint {
        margin: 0 0 var(--s3);
      }
      .empty-hint {
        margin: 0;
        padding: var(--s3);
        border: 1px dashed var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
      }
      .cdk-drag-preview {
        box-shadow: var(--ctp-shadow);
      }
      .lesson-cards {
        display: grid;
        gap: 0.75rem;
      }
      .lesson-card {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.75rem;
        align-items: start;
        padding: 0.9rem 1rem;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        background: var(--ctp-bg);
      }
      .lesson-card-title {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
      }
      .lesson-card-actions {
        display: flex;
        gap: 0.25rem;
        margin-top: 0.4rem;
        flex-wrap: wrap;
      }
      .assessment-block {
        margin-top: 0.7rem;
        padding-top: 0.65rem;
        border-top: 1px solid var(--ctp-border);
      }
      .assessment-meta {
        display: grid;
        gap: 0.15rem;
        font-size: 0.86rem;
      }
      .assessment-meta span { color: var(--ctp-muted); }
      .lesson-form,
      .lesson-type {
        display: grid;
        gap: 0.75rem;
      }
      .lesson-type {
        border: 0;
        padding: 0;
      }
      .lesson-type label {
        display: inline-flex;
        gap: 0.4rem;
        align-items: center;
        margin-right: 1rem;
      }
      .lesson-preview {
        width: 100%;
        max-height: 220px;
        border-radius: 8px;
        background: #111;
      }
      .preview-link {
        font-size: 0.9rem;
      }
      @media (max-width: 960px) {
        .steps,
        .content-grid,
        .form-grid,
        .assign-summary-grid {
          grid-template-columns: 1fr;
        }
        .header-row {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class CourseEditorPageComponent implements OnInit {
  private readonly api = inject(CoursesApiService);
  private readonly learningApi = inject(LearningApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly protectedMedia = inject(ProtectedMediaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly quizApi = inject(QuizApiService);
  private readonly assessmentEditor = viewChild(AssessmentEditorComponent);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingLesson = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly course = signal<CourseDto | null>(null);
  readonly modules = signal<CourseModuleDto[]>([]);
  readonly assignStats = signal<AssignmentSummary | null>(null);
  readonly thumbnailPreview = signal<string | null>(null);
  readonly uploadVisible = signal(false);
  readonly uploadKind = signal<'THUMBNAIL' | 'DOCUMENT' | 'VIDEO'>('THUMBNAIL');
  readonly departments = signal<DepartmentDto[]>([]);
  readonly employees = signal<UserDto[]>([]);
  readonly step = signal<AuthorStep>('details');
  readonly assigning = signal(false);
  readonly publishing = signal(false);
  lessonDialogVisible = false;
  editingLessonId: string | null = null;
  readonly lessonMedia = signal<MediaAssetDto | null>(null);
  readonly lessonPageCount = signal<number | null>(null);
  readonly lessonDuration = signal<number | null>(null);
  readonly lessonPreviewUrl = signal<string | null>(null);

  private uploadTarget: UploadTarget = 'thumbnail';

  readonly stepMeta: { id: AuthorStep; label: string; hint: string }[] = [
    { id: 'details', label: 'Details', hint: 'Title, code, thumbnail' },
    { id: 'content', label: 'Content', hint: 'PDF and video lessons' },
    { id: 'publish', label: 'Publish', hint: 'Readiness and release' },
    { id: 'assign', label: 'Assign', hint: 'Learners and due date' },
  ];

  readonly lessonForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    type: ['PDF' as 'PDF' | 'VIDEO'],
  });

  readonly formatBytes = formatBytes;
  readonly formatDuration = formatDuration;

  readonly roleOptions = [
    { label: 'Employee', value: 'EMPLOYEE' },
    { label: 'Manager', value: 'MANAGER' },
    { label: 'Admin', value: 'ADMIN' },
  ];

  readonly courseForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    code: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    isMandatory: [true],
    estimatedMinutes: [null as number | null],
    thumbnailMediaId: [null as string | null],
  });

  readonly assignForm = this.fb.group({
    scope: ['ALL_EMPLOYEES' as AssignScope, Validators.required],
    departmentIds: [[] as string[]],
    roles: [[] as string[]],
    userIds: [[] as string[]],
    dueAt: ['' as string],
    isMandatory: [true],
    sendNotification: [true],
    notifyNewEmployees: [false],
  });

  isNew(): boolean {
    return this.route.snapshot.paramMap.get('id') === 'new';
  }

  ngOnInit(): void {
    this.departmentsApi.list({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => this.departments.set(res.items),
    });
    this.usersApi.list({ page: 1, pageSize: 200, status: 'ACTIVE' }).subscribe({
      next: (res) => this.employees.set(res.items),
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id || id === 'new') {
        this.course.set(null);
        this.modules.set([]);
        this.assignStats.set(null);
        this.step.set('details');
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      this.api.get(id).subscribe({
        next: (course) => {
          this.applyCourse(course);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.error?.message ?? 'Failed to load course');
        },
      });
    });
  }

  canOpenStep(id: AuthorStep): boolean {
    if (id === 'details') return true;
    if (!this.course()) return false;
    if (id === 'content' || id === 'publish') return true;
    if (id === 'assign') return this.course()!.status === 'PUBLISHED';
    return false;
  }

  isStepDone(id: AuthorStep): boolean {
    const c = this.course();
    if (!c) return false;
    if (id === 'details') return true;
    if (id === 'content') return this.flatLessons().length > 0;
    if (id === 'publish') return c.status === 'PUBLISHED';
    if (id === 'assign') return c.status === 'PUBLISHED' && (this.assignStats()?.assigned ?? 0) > 0;
    return false;
  }

  goStep(id: AuthorStep): void {
    if (!this.canOpenStep(id)) {
      if (id === 'assign' && this.course()?.status !== 'PUBLISHED') {
        this.info.set('Publish the course successfully before assigning learners.');
        this.step.set('publish');
      }
      return;
    }
    this.step.set(id);
    if (id === 'assign' && this.course()?.status === 'PUBLISHED') {
      this.loadAssignStats();
    }
  }

  departmentOptions() {
    return this.departments().map((d) => ({ label: d.name, value: d.id }));
  }

  employeeOptions() {
    return this.employees().map((e) => ({
      label: `${e.firstName} ${e.lastName} (${e.email})`,
      value: e.id,
    }));
  }

  canSubmitAssign(): boolean {
    if (!this.course() || this.course()!.status !== 'PUBLISHED') return false;
    const raw = this.assignForm.getRawValue();
    if (raw.scope === 'DEPARTMENT') return (raw.departmentIds?.length ?? 0) > 0;
    if (raw.scope === 'ROLE') return (raw.roles?.length ?? 0) > 0;
    if (raw.scope === 'EMPLOYEES') return (raw.userIds?.length ?? 0) > 0;
    return true;
  }

  loadAssignStats(): void {
    const course = this.course();
    if (!course || course.status !== 'PUBLISHED') {
      this.assignStats.set(null);
      return;
    }
    this.learningApi.assignmentStats(course.id).subscribe({
      next: (stats) => this.assignStats.set(stats),
      error: () => this.assignStats.set(null),
    });
  }

  assignCourse(): void {
    if (!this.course() || !this.canSubmitAssign()) return;
    if (this.course()!.status !== 'PUBLISHED') {
      this.error.set('Only published courses can be assigned.');
      this.step.set('publish');
      return;
    }

    const raw = this.assignForm.getRawValue();
    const scope = raw.scope as AssignScope;
    const body: Parameters<LearningApiService['assignCourse']>[1] = {
      scope,
      isMandatory: !!raw.isMandatory,
      sendNotification: !!raw.sendNotification,
      notifyNewEmployees:
        scope === 'ALL_EMPLOYEES' || scope === 'DEPARTMENT'
          ? !!raw.notifyNewEmployees
          : false,
    };

    if (raw.dueAt) {
      body.dueAt = new Date(`${raw.dueAt}T23:59:59`).toISOString();
    }
    if (scope === 'DEPARTMENT') body.departmentIds = raw.departmentIds ?? [];
    if (scope === 'ROLE') body.roles = raw.roles ?? [];
    if (scope === 'EMPLOYEES') body.userIds = raw.userIds ?? [];

    this.assigning.set(true);
    this.error.set(null);
    this.learningApi.assignCourse(this.course()!.id, body).subscribe({
      next: (res) => {
        this.assigning.set(false);
        this.assignStats.set({
          assigned: res.assigned,
          completed: res.completed,
          inProgress: res.inProgress,
          notStarted: res.notStarted,
        });
        this.assignForm.patchValue({
          isMandatory: !!raw.isMandatory,
        });
        this.courseForm.patchValue({ isMandatory: !!raw.isMandatory });
        this.info.set(
          `Assigned to ${res.assigned} employees — Completed: ${res.completed}, In Progress: ${res.inProgress}, Not Started: ${res.notStarted}`,
        );
        this.reloadCourse();
      },
      error: (err) => {
        this.assigning.set(false);
        this.error.set(err?.error?.error?.message ?? 'Assignment failed');
      },
    });
  }

  flatLessons(): LessonDto[] {
    return this.modules().flatMap((m) => m.lessons ?? []);
  }

  outlineLessons(): LessonDto[] {
    return this.flatLessons();
  }

  applyCourse(course: CourseDto): void {
    this.course.set(course);
    this.modules.set(course.modules ?? []);
    this.courseForm.reset({
      title: course.title,
      code: course.code,
      description: course.description ?? '',
      isMandatory: course.isMandatory,
      estimatedMinutes: course.estimatedMinutes,
      thumbnailMediaId: course.thumbnailMediaId,
    });
    this.assignForm.patchValue({ isMandatory: course.isMandatory });
    this.thumbnailPreview.set(
      course.thumbnailMedia?.publicUrl
        ? this.mediaUrl(course.thumbnailMedia.publicUrl)
        : null,
    );
    if (course.status === 'PUBLISHED') {
      this.loadAssignStats();
    } else {
      this.assignStats.set(null);
    }
  }

  mediaUrl(path: string): string {
    if (path.startsWith('http')) return path;
    return `${environment.mediaBaseUrl}${path}`;
  }

  saveCourse(): void {
    if (this.courseForm.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const raw = this.courseForm.getRawValue();
    const body = {
      title: raw.title,
      code: (raw.code || '').toUpperCase(),
      description: raw.description || null,
      isMandatory: raw.isMandatory,
      estimatedMinutes: raw.estimatedMinutes ? Number(raw.estimatedMinutes) : null,
      thumbnailMediaId: raw.thumbnailMediaId,
    };

    const request = this.isNew()
      ? this.api.create(body)
      : this.api.update(this.course()!.id, body);

    request.subscribe({
      next: (course) => {
        this.saving.set(false);
        this.info.set('Course details saved');
        if (this.isNew()) {
          void this.router.navigate(['/app/courses', course.id]).then(() => {
            this.step.set('content');
          });
        } else {
          this.applyCourse(course);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error?.message ?? 'Save failed');
      },
    });
  }

  changeStatus(status: CourseStatus): void {
    if (!this.course()) return;
    this.publishing.set(true);
    this.error.set(null);
    this.api.updateStatus(this.course()!.id, status).subscribe({
      next: (course) => {
        this.publishing.set(false);
        this.applyCourse(course);
        this.info.set(`Course marked as ${status}`);
        if (status === 'PUBLISHED') {
          this.step.set('assign');
        } else if (this.step() === 'assign') {
          this.step.set('publish');
        }
      },
      error: (err) => {
        this.publishing.set(false);
        this.error.set(err?.error?.error?.message ?? 'Status change failed');
        if (status === 'PUBLISHED') {
          this.step.set('publish');
        }
      },
    });
  }

  publishCourse(): void {
    if (!this.canPublish()) {
      this.error.set('Resolve all Publish Readiness items before publishing.');
      this.step.set('publish');
      return;
    }
    this.changeStatus('PUBLISHED');
  }

  canPublish(): boolean {
    return this.readiness().every((item) => item.ok);
  }

  readiness(): { label: string; ok: boolean; hint?: string }[] {
    const course = this.course();
    const lessons = this.flatLessons().filter((l) => l.type === 'PDF' || l.type === 'VIDEO');
    const title = (course?.title ?? this.courseForm.value.title ?? '').trim();
    const code = (course?.code ?? this.courseForm.value.code ?? '').trim();
    const mediaOk = lessons.every((l) => !!l.contentMediaId && !!l.contentMedia);
    const formOk = this.courseForm.valid || !!course;

    return [
      {
        label: 'Course title',
        ok: title.length >= 3,
        hint: 'Enter and save a title with at least 3 characters.',
      },
      {
        label: 'Course code',
        ok: code.length >= 2,
        hint: 'Enter and save a unique course code.',
      },
      {
        label: 'Details form valid',
        ok: formOk,
        hint: 'Fix validation errors on the Details step and save.',
      },
      {
        label: 'At least one PDF or video lesson',
        ok: lessons.length > 0,
        hint: 'Add a PDF or video lesson on the Content step.',
      },
      {
        label: 'Lesson media attached',
        ok: lessons.length > 0 && mediaOk,
        hint: 'Every PDF and video lesson must have uploaded content.',
      },
      {
        label: 'Assessments published',
        ok: lessons.every((l) => !l.quiz || l.quiz.status === 'PUBLISHED'),
        hint: 'Publish each lesson assessment, or delete draft assessments.',
      },
    ];
  }

  openUpload(kind: 'THUMBNAIL' | 'DOCUMENT' | 'VIDEO'): void {
    this.uploadKind.set(kind);
    if (kind === 'THUMBNAIL') this.uploadTarget = 'thumbnail';
    else if (kind === 'DOCUMENT') this.uploadTarget = 'pdf';
    else this.uploadTarget = 'video';
    this.uploadVisible.set(true);
  }

  onUploaded(media: MediaAssetDto): void {
    if (this.uploadTarget === 'thumbnail') {
      this.courseForm.patchValue({ thumbnailMediaId: media.id });
      this.thumbnailPreview.set(this.mediaUrl(media.publicUrl));
      this.info.set('Thumbnail uploaded — save course details to persist');
      return;
    }
    void this.attachLessonMedia(media);
  }

  openLessonDialog(lesson?: LessonDto): void {
    this.editingLessonId = lesson?.id ?? null;
    this.lessonForm.reset({
      title: lesson?.title ?? '',
      description: lesson?.description ?? '',
      type: lesson?.type === 'VIDEO' ? 'VIDEO' : 'PDF',
    });
    this.lessonMedia.set(lesson?.contentMedia ?? null);
    const bounds = lesson ? readChapterBounds(lesson.quizConfig) : { pageStart: null, pageEnd: null };
    this.lessonPageCount.set(
      bounds.pageStart && bounds.pageEnd ? bounds.pageEnd - bounds.pageStart + 1 : null,
    );
    this.lessonDuration.set(lesson?.durationSeconds ?? null);
    this.lessonPreviewUrl.set(
      lesson?.contentMedia ? this.protectedMedia.resolveMediaUrl(lesson.contentMedia) : null,
    );
    this.lessonDialogVisible = true;
  }

  lessonSummary(lesson: LessonDto): string {
    if (lesson.type === 'PDF') {
      const bounds = readChapterBounds(lesson.quizConfig);
      const pages =
        bounds.pageStart && bounds.pageEnd
          ? bounds.pageEnd - bounds.pageStart + 1
          : null;
      return pages ? `PDF · ${pages} pages` : 'PDF';
    }
    if (lesson.type === 'VIDEO') {
      return `Video · ${formatDuration(lesson.durationSeconds)}`;
    }
    return lesson.type;
  }

  previewLesson(lesson: LessonDto): void {
    const url = this.protectedMedia.resolveMediaUrl(lesson.contentMedia);
    if (!url) {
      this.error.set('No media attached to preview');
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  private async attachLessonMedia(media: MediaAssetDto): Promise<void> {
    try {
      requireMediaAssetId(media);
      this.lessonMedia.set(media);
      const url = this.protectedMedia.resolveMediaUrl(media);
      this.lessonPreviewUrl.set(url);
      if (this.lessonForm.value.type === 'PDF' && url) {
        const pages = await detectPdfPageCount(url);
        this.lessonPageCount.set(pages);
        if (!this.lessonForm.value.title) {
          this.lessonForm.patchValue({
            title: (media.originalName || 'Lesson').replace(/\.pdf$/i, ''),
          });
        }
      }
      if (this.lessonForm.value.type === 'VIDEO' && url) {
        const duration = await detectVideoDuration(url);
        this.lessonDuration.set(duration);
        if (!this.lessonForm.value.title) {
          this.lessonForm.patchValue({
            title: (media.originalName || 'Lesson').replace(/\.(mp4|webm|mov)$/i, ''),
          });
        }
      }
    } catch (err) {
      this.error.set((err as Error)?.message ?? 'Could not read uploaded media');
    }
  }

  async saveLesson(): Promise<void> {
    const course = this.course();
    const media = this.lessonMedia();
    if (!course || this.lessonForm.invalid || !media) return;
    this.savingLesson.set(true);
    this.error.set(null);
    try {
      const raw = this.lessonForm.getRawValue();
      const mediaId = requireMediaAssetId(media);
      const body: Record<string, unknown> = {
        title: raw.title.trim(),
        description: raw.description.trim() || null,
        type: raw.type,
        contentMediaId: mediaId,
        durationSeconds: raw.type === 'VIDEO' ? this.lessonDuration() : null,
        quizConfig:
          raw.type === 'PDF' && this.lessonPageCount()
            ? chapterConfig(1, this.lessonPageCount()!)
            : null,
        status: 'PUBLISHED',
      };
      if (this.editingLessonId) {
        await firstValueFrom(this.api.updateLesson(this.editingLessonId, body));
      } else {
        await firstValueFrom(this.api.createCourseLesson(course.id, body));
      }
      this.lessonDialogVisible = false;
      await this.reloadCourseAsync();
      this.info.set(this.editingLessonId ? 'Lesson updated' : 'Lesson added');
    } catch (err: unknown) {
      this.error.set(
        (err as { error?: { error?: { message?: string } }; message?: string })?.error?.error
          ?.message ??
          (err as { message?: string })?.message ??
          'Failed to save lesson',
      );
    } finally {
      this.savingLesson.set(false);
    }
  }

  onOutlineDrop(event: CdkDragDrop<LessonDto[]>): void {
    const lessons = [...this.outlineLessons()];
    if (lessons.length < 2 || event.previousIndex === event.currentIndex) {
      return;
    }
    moveItemInArray(lessons, event.previousIndex, event.currentIndex);
    void this.reorderAllOutline(lessons);
  }

  onAssessmentSaved(): void {
    this.reloadCourse();
  }

  openAssessmentEditor(lesson: LessonDto): void {
    this.assessmentEditor()?.open(lesson.id);
  }

  previewAssessment(lesson: LessonDto): void {
    this.assessmentEditor()?.open(lesson.id, { preview: true });
  }

  deleteAssessment(lesson: LessonDto): void {
    if (!lesson.quiz || !confirm(`Delete assessment for "${lesson.title}"?`)) return;
    this.quizApi.deleteAssessment(lesson.quiz.id).subscribe({
      next: () => this.reloadCourse(),
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Could not delete assessment'),
    });
  }

  removeLesson(lesson: LessonDto): void {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    this.api.deleteLesson(lesson.id).subscribe({
      next: () => this.reloadCourse(),
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Delete failed'),
    });
  }

  private async reorderAllOutline(ordered: LessonDto[]): Promise<void> {
    const course = this.course();
    if (!course || ordered.length < 2) return;
    try {
      await firstValueFrom(
        this.api.reorderCourseLessons(
          course.id,
          ordered.map((l) => ({ id: l.id })),
        ),
      );
      await this.reloadCourseAsync();
    } catch (err: unknown) {
      this.error.set(
        (err as { error?: { error?: { message?: string } } })?.error?.error?.message ??
          'Lesson reorder failed',
      );
      await this.reloadCourseAsync();
    }
  }

  private reloadCourse(): void {
    void this.reloadCourseAsync();
  }

  private async reloadCourseAsync(): Promise<void> {
    if (!this.course()) return;
    const course = await firstValueFrom(this.api.get(this.course()!.id));
    this.applyCourse(course);
  }
}
