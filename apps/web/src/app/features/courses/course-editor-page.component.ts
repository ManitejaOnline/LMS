import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Checkbox } from 'primeng/checkbox';
import { RadioButton } from 'primeng/radiobutton';
import { MultiSelect } from 'primeng/multiselect';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UploadDialogComponent } from '../../shared/components/upload-dialog/upload-dialog.component';
import { QuizBankEditorComponent } from '../../shared/components/quiz-bank-editor/quiz-bank-editor.component';
import { PdfDocumentOrganizerComponent } from '../../shared/components/pdf-document-organizer/pdf-document-organizer.component';
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
import {
  type ChapterDraft,
  chapterConfig,
  detectPdfPageCount,
  estimateReadingMinutes,
  newChapterClientId,
  readChapterBounds,
} from '../../shared/utils/pdf-meta.util';
import { requireMediaAssetId } from '../../shared/utils/media-id.util';
import { firstValueFrom } from 'rxjs';

type AuthorStep = 'details' | 'content' | 'publish' | 'assign';
type UploadTarget = 'thumbnail' | 'pdf' | 'video';

/** Single content module so PDF / video / quiz can be interleaved. */
const CONTENT_MODULE_TITLE = 'Document';

@Component({
  selector: 'app-course-editor-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
    UploadDialogComponent,
    QuizBankEditorComponent,
    PdfDocumentOrganizerComponent,
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
    Tag,
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
                <h2 class="panel-title">Content</h2>
                <p class="section-sub">
                  Organize the PDF into chapters, then insert video or quiz lessons in the outline.
                </p>
              </div>
              <div class="actions">
                <p-button
                  label="Upload PDF"
                  icon="pi pi-file-pdf"
                  size="small"
                  (onClick)="openUpload('DOCUMENT')"
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

            <div class="content-grid">
              <div class="pdf-col">
                <app-pdf-document-organizer
                  [src]="pdfPreviewUrl()"
                  [chapters]="chapters()"
                  (chaptersChange)="onChaptersChange($event)"
                  (pageCountChange)="onPdfPageCount($event)"
                  (busyChange)="organizerBusy.set($event)"
                />
                @if (syncingChapters() || finalizingPdf()) {
                  <p class="sync-hint">
                    <i class="pi pi-spin pi-spinner"></i>
                    {{
                      finalizingPdf()
                        ? 'Finalizing PDF lesson…'
                        : 'Saving chapters as lessons…'
                    }}
                  </p>
                }
              </div>

              <div class="lessons-col">
                <div class="subhead">
                  <h3>Course outline</h3>
                  <span class="meta">{{ outlineLessons().length }} lessons · live</span>
                </div>

                @if (outlineLessons().length === 0) {
                  <p class="muted empty-hint">
                    Upload a PDF and create chapters — they appear here as lessons automatically.
                    Reorder is available after lessons exist.
                  </p>
                } @else if (outlineLessons().length === 1) {
                  <p class="muted reorder-hint">Add another lesson to enable reordering.</p>
                }

                <div class="insert-row">
                  <span class="insert-label">Insert at start</span>
                  <button
                    type="button"
                    class="insert-btn"
                    (click)="setInsertAt(0); openUpload('VIDEO')"
                  >
                    <i class="pi pi-video"></i> Video
                  </button>
                  <button
                    type="button"
                    class="insert-btn"
                    [disabled]="creatingQuiz()"
                    (click)="setInsertAt(0); addQuizLesson()"
                  >
                    <i class="pi pi-list-check"></i> Quiz
                  </button>
                </div>

                <div
                  class="outline-list"
                  cdkDropList
                  [cdkDropListData]="outlineLessons()"
                  [cdkDropListDisabled]="outlineLessons().length < 2"
                  (cdkDropListDropped)="onOutlineDrop($event)"
                >
                  @for (lesson of outlineLessons(); track lesson.id; let i = $index) {
                    <div class="outline-item" cdkDrag [cdkDragDisabled]="outlineLessons().length < 2">
                      <div class="lesson-row">
                        <i
                          class="pi pi-bars drag-handle"
                          cdkDragHandle
                          [class.disabled]="outlineLessons().length < 2"
                        ></i>
                        <div class="lesson-main">
                          <div class="lesson-title-row">
                            <span class="lesson-index">{{ i + 1 }}</span>
                            <input
                              class="lesson-title-input"
                              [(ngModel)]="lesson.title"
                              (change)="renameLesson(lesson)"
                            />
                          </div>
                          <div class="lesson-meta">
                            <p-tag [value]="lessonTypeLabel(lesson)" styleClass="text-xs" />
                            @if (lesson.type === 'PDF') {
                              @let bounds = chapterBounds(lesson);
                              @if (bounds.pageStart != null && bounds.pageEnd != null) {
                                <span>Pages {{ bounds.pageStart }}–{{ bounds.pageEnd }}</span>
                                <span
                                  >{{ bounds.pageEnd - bounds.pageStart + 1 }} pages</span
                                >
                                <span
                                  >~{{
                                    readingMins(bounds.pageStart, bounds.pageEnd)
                                  }}
                                  min</span
                                >
                              }
                            } @else if (lesson.contentMedia) {
                              <span class="muted">{{ lesson.contentMedia.originalName }}</span>
                            } @else if (lesson.type === 'QUIZ') {
                              <span class="muted">Question bank</span>
                            } @else {
                              <span class="warn">Media required</span>
                            }
                          </div>
                        </div>
                        @if (lesson.type === 'QUIZ') {
                          <p-button
                            icon="pi pi-list-check"
                            [text]="true"
                            size="small"
                            aria-label="Edit question bank"
                            (onClick)="openQuizBank(lesson.id)"
                          />
                        }
                        <p-button
                          icon="pi pi-trash"
                          severity="danger"
                          [text]="true"
                          size="small"
                          (onClick)="removeLesson(lesson)"
                        />
                      </div>

                      <div class="insert-row nested">
                        <span class="insert-label">Insert after</span>
                        <button
                          type="button"
                          class="insert-btn"
                          (click)="setInsertAt(i + 1); openUpload('VIDEO')"
                        >
                          <i class="pi pi-video"></i> Video
                        </button>
                        <button
                          type="button"
                          class="insert-btn"
                          [disabled]="creatingQuiz()"
                          (click)="setInsertAt(i + 1); addQuizLesson()"
                        >
                          <i class="pi pi-list-check"></i> Quiz
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
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

    <app-quiz-bank-editor #quizBank />
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
  private readonly quizBank = viewChild.required<QuizBankEditorComponent>('quizBank');

  readonly loading = signal(true);
  readonly saving = signal(false);
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
  readonly pdfMedia = signal<MediaAssetDto | null>(null);
  readonly pdfPageCount = signal<number | null>(null);
  readonly chapters = signal<ChapterDraft[]>([]);
  readonly syncingChapters = signal(false);
  readonly finalizingPdf = signal(false);
  readonly organizerBusy = signal(false);
  readonly assigning = signal(false);
  readonly creatingQuiz = signal(false);
  readonly publishing = signal(false);

  /** Index in outline where the next video/quiz should be inserted. */
  private insertAt: number | null = null;
  private chapterSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private chapterSyncGeneration = 0;
  private suppressChapterSync = false;
  private uploadTarget: UploadTarget = 'thumbnail';

  readonly stepMeta: { id: AuthorStep; label: string; hint: string }[] = [
    { id: 'details', label: 'Details', hint: 'Title, code, thumbnail' },
    { id: 'content', label: 'Content', hint: 'PDF chapters, video, quiz' },
    { id: 'publish', label: 'Publish', hint: 'Readiness and release' },
    { id: 'assign', label: 'Assign', hint: 'Learners and due date' },
  ];

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
        this.pdfMedia.set(null);
        this.pdfPageCount.set(null);
        this.chapters.set([]);
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

  pdfPreviewUrl(): string | null {
    return this.protectedMedia.resolveMediaUrl(this.pdfMedia());
  }

  flatLessons(): LessonDto[] {
    return this.modules().flatMap((m) => m.lessons ?? []);
  }

  /** Flattened outline across content modules, preserving module then lesson order. */
  outlineLessons(): LessonDto[] {
    return this.flatLessons();
  }

  chapterBounds(lesson: LessonDto) {
    return readChapterBounds(lesson.quizConfig);
  }

  readingMins(pageStart: number, pageEnd: number): number {
    return estimateReadingMinutes(pageEnd - pageStart + 1);
  }

  lessonTypeLabel(lesson: LessonDto): string {
    if (lesson.type === 'PDF') return 'PDF chapter';
    if (lesson.type === 'VIDEO') return 'Video';
    if (lesson.type === 'QUIZ') return 'Quiz';
    return lesson.type;
  }

  setInsertAt(index: number): void {
    this.insertAt = index;
  }

  onPdfPageCount(count: number): void {
    this.pdfPageCount.set(count);
  }

  onChaptersChange(next: ChapterDraft[]): void {
    this.chapters.set(next);
    if (this.suppressChapterSync) return;
    this.scheduleChapterSync();
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
    this.hydratePdfFromCourse(course);
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
    const lessons = this.flatLessons();
    const title = (course?.title ?? this.courseForm.value.title ?? '').trim();
    const code = (course?.code ?? this.courseForm.value.code ?? '').trim();
    const pdfLessons = lessons.filter((l) => l.type === 'PDF');
    const mediaLessons = lessons.filter((l) => l.type === 'PDF' || l.type === 'VIDEO');
    const mediaOk = mediaLessons.every((l) => !!l.contentMediaId);
    const brokenMedia = mediaLessons.some(
      (l) => !!l.contentMediaId && !l.contentMedia,
    );
    const pdfValid =
      pdfLessons.length > 0 &&
      pdfLessons.every((l) => !!l.contentMediaId && !!l.contentMedia);
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
        label: 'At least one lesson',
        ok: lessons.length > 0,
        hint: 'Upload a PDF or add video/quiz lessons on the Content step.',
      },
      {
        label: 'Uploaded PDF is valid',
        ok: pdfValid,
        hint: 'Upload a PDF document so at least one PDF lesson has attached media.',
      },
      {
        label: 'Media lessons have content attached',
        ok: mediaLessons.length === 0 ? false : mediaOk,
        hint: 'Every PDF and video lesson must reference uploaded media.',
      },
      {
        label: 'No broken lesson media references',
        ok: !brokenMedia && mediaOk && lessons.length > 0,
        hint: 'Re-upload media for any lesson that shows a broken file reference.',
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

    if (this.uploadTarget === 'pdf') {
      void this.finalizePdfUpload(media);
      return;
    }

    if (this.uploadTarget === 'video') {
      void this.createVideoLesson(media);
    }
  }

  /**
   * Complete PDF pipeline: media already stored → metadata → PDF lesson on module → refresh.
   */
  private async finalizePdfUpload(media: MediaAssetDto): Promise<void> {
    if (!this.course()) {
      this.error.set('Save the course before uploading a PDF');
      return;
    }

    this.finalizingPdf.set(true);
    this.error.set(null);
    this.info.set(null);

    try {
      const mediaId = requireMediaAssetId(media);
      this.pdfMedia.set(media);

      const url = this.protectedMedia.resolveMediaUrl(media);
      if (!url) {
        throw new Error('Upload response missing media URL — aborting lesson creation');
      }

      const pageCount = await detectPdfPageCount(url);
      if (!Number.isFinite(pageCount) || pageCount < 1) {
        throw new Error('PDF metadata extraction failed — no pages found');
      }
      this.pdfPageCount.set(pageCount);

      const mod = await this.ensureContentModule();

      // Replace prior PDF document lessons so re-upload keeps a single media-bound lesson set
      const existingPdf = (mod.lessons ?? []).filter((l) => l.type === 'PDF');
      for (const lesson of existingPdf) {
        await firstValueFrom(this.api.deleteLesson(lesson.id));
      }

      const title =
        (media.originalName || 'Course document').replace(/\.pdf$/i, '').trim() ||
        'Course document';

      const lessonBody = {
        title,
        type: 'PDF' as const,
        contentMediaId: mediaId,
        quizConfig: chapterConfig(1, pageCount),
      };

      const lesson = await firstValueFrom(this.api.createLesson(mod.id, lessonBody));

      if (!lesson?.id) {
        throw new Error('Lesson creation failed — no lesson returned');
      }

      this.suppressChapterSync = true;
      this.chapters.set([
        {
          clientId: newChapterClientId(),
          lessonId: lesson.id,
          title,
          pageStart: 1,
          pageEnd: pageCount,
        },
      ]);
      this.suppressChapterSync = false;

      await this.reloadCourseAsync();

      const refreshed = this.flatLessons().find((l) => l.id === lesson.id);
      if (!refreshed || refreshed.type !== 'PDF' || !refreshed.contentMediaId) {
        throw new Error('Course refresh did not return the new PDF lesson with media');
      }

      this.info.set(
        `PDF ready — ${pageCount} pages · lesson “${title}” created. Split or adjust chapters as needed.`,
      );
    } catch (err: unknown) {
      const message =
        (err as { error?: { error?: { message?: string } }; message?: string })?.error?.error
          ?.message ??
        (err as { message?: string })?.message ??
        'Failed to finalize PDF upload';
      this.error.set(message);
    } finally {
      this.finalizingPdf.set(false);
    }
  }

  async addQuizLesson(): Promise<void> {
    if (!this.course()) return;
    this.creatingQuiz.set(true);
    this.error.set(null);
    try {
      const mod = await this.ensureContentModule();
      const sortOrder = this.resolveInsertSortOrder(mod);
      const lesson = await firstValueFrom(
        this.api.createLesson(mod.id, {
          title: 'Knowledge check',
          type: 'QUIZ',
          sortOrder,
        }),
      );
      await this.placeLessonAtInsert(mod.id, lesson.id);
      await this.reloadCourseAsync();
      this.openQuizBank(lesson.id);
      this.info.set('Quiz lesson created');
    } catch (err: unknown) {
      const message =
        (err as { error?: { error?: { message?: string } } })?.error?.error?.message ??
        'Failed to create quiz lesson';
      this.error.set(message);
    } finally {
      this.creatingQuiz.set(false);
      this.insertAt = null;
    }
  }

  openQuizBank(lessonId: string): void {
    this.quizBank().open(lessonId);
  }

  renameLesson(lesson: LessonDto): void {
    this.api.updateLesson(lesson.id, { title: lesson.title }).subscribe({
      next: () => {
        // Keep chapter draft titles in sync for PDF chapters
        const bounds = readChapterBounds(lesson.quizConfig);
        if (bounds.pageStart != null) {
          this.suppressChapterSync = true;
          this.chapters.set(
            this.chapters().map((c) =>
              c.lessonId === lesson.id ? { ...c, title: lesson.title } : c,
            ),
          );
          this.suppressChapterSync = false;
        }
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Rename failed'),
    });
  }

  onOutlineDrop(event: CdkDragDrop<LessonDto[]>): void {
    const lessons = [...this.outlineLessons()];
    if (lessons.length === 0) {
      this.info.set('No lessons to reorder yet. Create chapters or lessons first.');
      return;
    }
    if (lessons.length < 2 || event.previousIndex === event.currentIndex) {
      return;
    }
    moveItemInArray(lessons, event.previousIndex, event.currentIndex);
    const mod = this.contentModule();
    if (!mod) return;
    mod.lessons = lessons.filter((l) =>
      (mod.lessons ?? []).some((x) => x.id === l.id),
    );
    void this.reorderAllOutline(lessons);
  }

  removeLesson(lesson: LessonDto): void {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    this.api.deleteLesson(lesson.id).subscribe({
      next: () => {
        if (lesson.type === 'PDF') {
          this.suppressChapterSync = true;
          this.chapters.set(this.chapters().filter((c) => c.lessonId !== lesson.id));
          this.suppressChapterSync = false;
        }
        this.reloadCourse();
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Delete failed'),
    });
  }

  private scheduleChapterSync(): void {
    if (this.chapterSyncTimer) clearTimeout(this.chapterSyncTimer);
    this.chapterSyncTimer = setTimeout(() => {
      void this.syncChaptersToLessons();
    }, 450);
  }

  private async syncChaptersToLessons(): Promise<void> {
    const course = this.course();
    const media = this.pdfMedia();
    const drafts = this.chapters();
    if (!course || !media) return;

    const gen = ++this.chapterSyncGeneration;
    this.syncingChapters.set(true);
    this.error.set(null);

    try {
      const mod = await this.ensureContentModule();
      if (gen !== this.chapterSyncGeneration) return;

      const existingPdf = (mod.lessons ?? []).filter((l) => {
        if (l.type !== 'PDF') return false;
        const b = readChapterBounds(l.quizConfig);
        return b.pageStart != null && b.pageEnd != null;
      });

      const draftLessonIds = new Set(
        drafts.map((d) => d.lessonId).filter((id): id is string => !!id),
      );

      for (const lesson of existingPdf) {
        if (!draftLessonIds.has(lesson.id)) {
          await firstValueFrom(this.api.deleteLesson(lesson.id));
        }
      }
      if (gen !== this.chapterSyncGeneration) return;

      const mediaId = requireMediaAssetId(media);
      const updatedDrafts: ChapterDraft[] = [];
      for (const ch of drafts) {
        const title = ch.title.trim() || `Pages ${ch.pageStart}–${ch.pageEnd}`;
        const config = chapterConfig(ch.pageStart, ch.pageEnd);

        if (ch.lessonId) {
          await firstValueFrom(
            this.api.updateLesson(ch.lessonId, {
              title,
              contentMediaId: mediaId,
              quizConfig: config,
            }),
          );
          updatedDrafts.push({ ...ch, title });
        } else {
          const created = await firstValueFrom(
            this.api.createLesson(mod.id, {
              title,
              type: 'PDF',
              contentMediaId: mediaId,
              quizConfig: config,
            }),
          );
          updatedDrafts.push({ ...ch, title, lessonId: created.id });
        }
      }
      if (gen !== this.chapterSyncGeneration) return;

      this.suppressChapterSync = true;
      this.chapters.set(updatedDrafts);
      this.suppressChapterSync = false;

      // Reorder only after lessons exist and chapter order may need applying
      if (updatedDrafts.length > 0) {
        await this.reorderAfterChapterSync(mod.id, updatedDrafts);
      }
      await this.reloadCourseAsync();
      if (gen === this.chapterSyncGeneration) {
        this.info.set(
          updatedDrafts.length
            ? `${updatedDrafts.length} chapter lesson(s) saved`
            : 'Chapters cleared',
        );
      }
    } catch (err: unknown) {
      if (gen !== this.chapterSyncGeneration) return;
      const message =
        (err as { error?: { error?: { message?: string } } })?.error?.error?.message ??
        'Failed to save chapters';
      this.error.set(message);
    } finally {
      if (gen === this.chapterSyncGeneration) {
        this.syncingChapters.set(false);
      }
    }
  }

  /**
   * Keep non-PDF lessons in place while ordering PDF chapter lessons to match drafts.
   */
  private async reorderAfterChapterSync(
    moduleId: string,
    drafts: ChapterDraft[],
  ): Promise<void> {
    if (drafts.length === 0) return;

    await this.reloadCourseAsync();
    const mod = this.modules().find((m) => m.id === moduleId);
    if (!mod) return;

    const lessons = [...(mod.lessons ?? [])];
    if (lessons.length === 0) return;

    const pdfIds = new Set(
      drafts.map((d) => d.lessonId).filter((id): id is string => !!id),
    );
    const pdfOrdered = drafts
      .map((d) => lessons.find((l) => l.id === d.lessonId))
      .filter((l): l is LessonDto => !!l);

    // If creates/updates failed, do not reorder an incomplete set
    if (pdfOrdered.length !== drafts.length) return;

    const pdfQueue = [...pdfOrdered];
    const rebuilt: LessonDto[] = [];
    for (const lesson of lessons) {
      if (pdfIds.has(lesson.id)) {
        const nextPdf = pdfQueue.shift();
        if (nextPdf && !rebuilt.some((x) => x.id === nextPdf.id)) {
          rebuilt.push(nextPdf);
        }
      } else {
        rebuilt.push(lesson);
      }
    }
    for (const leftover of pdfQueue) {
      if (!rebuilt.some((x) => x.id === leftover.id)) rebuilt.push(leftover);
    }

    await this.safeReorderLessons(
      moduleId,
      lessons,
      rebuilt.map((l) => ({ id: l.id })),
    );
  }

  private async createVideoLesson(media: MediaAssetDto): Promise<void> {
    if (!this.course()) return;
    try {
      const mediaId = requireMediaAssetId(media);
      const mod = await this.ensureContentModule();
      const sortOrder = this.resolveInsertSortOrder(mod);
      const lesson = await firstValueFrom(
        this.api.createLesson(mod.id, {
          title: media.originalName || 'Video lesson',
          type: 'VIDEO',
          contentMediaId: mediaId,
          sortOrder,
        }),
      );
      await this.placeLessonAtInsert(mod.id, lesson.id);
      this.info.set('Video lesson created');
      await this.reloadCourseAsync();
    } catch (err: unknown) {
      const message =
        (err as { error?: { error?: { message?: string } } })?.error?.error?.message ??
        'Failed to create video lesson';
      this.error.set(message);
    } finally {
      this.insertAt = null;
    }
  }

  private resolveInsertSortOrder(mod: CourseModuleDto): number {
    if (this.insertAt == null) {
      return mod.lessons?.length ?? 0;
    }
    return this.insertAt;
  }

  private async placeLessonAtInsert(moduleId: string, lessonId: string): Promise<void> {
    if (this.insertAt == null) return;
    await this.reloadCourseAsync();
    const mod = this.modules().find((m) => m.id === moduleId);
    if (!mod?.lessons?.length) return;

    const lessons = [...mod.lessons];
    const from = lessons.findIndex((l) => l.id === lessonId);
    if (from < 0) return;
    const [item] = lessons.splice(from, 1);
    const to = Math.min(Math.max(this.insertAt, 0), lessons.length);
    lessons.splice(to, 0, item);

    await this.safeReorderLessons(
      moduleId,
      mod.lessons,
      lessons.map((l) => ({ id: l.id })),
    );
  }

  private async reorderAllOutline(ordered: LessonDto[]): Promise<void> {
    const mod = await this.ensureContentModule();
    const moduleLessons = mod.lessons ?? [];
    if (moduleLessons.length === 0) {
      this.info.set('No lessons to reorder yet. Create chapters or lessons first.');
      return;
    }

    const ids = new Set(moduleLessons.map((l) => l.id));
    const outline = ordered.filter((l) => ids.has(l.id));
    const payload =
      outline.length === moduleLessons.length && outline.length > 0
        ? outline.map((l) => ({ id: l.id }))
        : moduleLessons.map((l) => ({ id: l.id }));

    try {
      await this.safeReorderLessons(mod.id, moduleLessons, payload);
      await this.reloadCourseAsync();
    } catch (err: unknown) {
      const message =
        (err as { error?: { error?: { message?: string } } })?.error?.error?.message ??
        'Lesson reorder failed';
      this.error.set(message);
      await this.reloadCourseAsync();
    }
  }

  /** Skip no-op / empty reorder requests; only POST when order actually changed. */
  private async safeReorderLessons(
    moduleId: string,
    current: LessonDto[],
    nextItems: { id: string }[],
  ): Promise<void> {
    if (nextItems.length === 0) {
      this.info.set('No lessons to reorder yet. Create chapters or lessons first.');
      return;
    }
    if (current.length === 0) {
      this.info.set('No lessons to reorder yet. Create chapters or lessons first.');
      return;
    }
    if (this.isSameLessonOrder(current, nextItems)) {
      return;
    }
    await firstValueFrom(this.api.reorderLessons(moduleId, nextItems));
  }

  private isSameLessonOrder(
    current: LessonDto[],
    nextItems: { id: string }[],
  ): boolean {
    if (current.length !== nextItems.length) return false;
    return current.every((lesson, index) => lesson.id === nextItems[index]?.id);
  }

  private contentModule(): CourseModuleDto | undefined {
    return this.modules().find(
      (m) => m.title.trim().toLowerCase() === CONTENT_MODULE_TITLE.toLowerCase(),
    );
  }

  private async ensureContentModule(): Promise<CourseModuleDto> {
    return this.ensureModule(CONTENT_MODULE_TITLE);
  }

  private async ensureModule(title: string): Promise<CourseModuleDto> {
    const existing = this.modules().find(
      (m) => m.title.trim().toLowerCase() === title.toLowerCase(),
    );
    if (existing) return existing;

    const created = await firstValueFrom(
      this.api.createModule(this.course()!.id, { title }),
    );
    await this.reloadCourseAsync();
    const refreshed = this.modules().find((m) => m.id === created.id);
    return refreshed ?? created;
  }

  private hydratePdfFromCourse(course: CourseDto): void {
    const allLessons = (course.modules ?? []).flatMap((m) => m.lessons ?? []);
    const pdfLessons = allLessons.filter((l) => l.type === 'PDF');
    const withMedia = pdfLessons.find((l) => l.contentMedia);
    if (withMedia?.contentMedia) {
      this.pdfMedia.set(withMedia.contentMedia);
    }

    const chapterLessons = pdfLessons.filter((l) => {
      const b = readChapterBounds(l.quizConfig);
      return b.pageStart != null && b.pageEnd != null;
    });

    const prevByLesson = new Map(
      this.chapters()
        .filter((c) => c.lessonId)
        .map((c) => [c.lessonId!, c] as const),
    );

    this.suppressChapterSync = true;
    if (chapterLessons.length > 0) {
      this.chapters.set(
        chapterLessons.map((l) => {
          const b = readChapterBounds(l.quizConfig);
          const prev = prevByLesson.get(l.id);
          return {
            clientId: prev?.clientId ?? newChapterClientId(),
            lessonId: l.id,
            title: l.title,
            pageStart: b.pageStart ?? 1,
            pageEnd: b.pageEnd ?? 1,
          };
        }),
      );
      const maxEnd = Math.max(...this.chapters().map((c) => c.pageEnd));
      if (maxEnd > 0 && !this.pdfPageCount()) this.pdfPageCount.set(maxEnd);
    } else if (!this.pdfMedia()) {
      this.chapters.set([]);
    }
    this.suppressChapterSync = false;
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
