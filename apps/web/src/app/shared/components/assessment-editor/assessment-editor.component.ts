import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { Textarea } from 'primeng/textarea';
import { QuizApiService, type QuizQuestionAdmin } from '../../../core/http/quiz-api.service';

@Component({
  selector: 'app-assessment-editor',
  standalone: true,
  imports: [FormsModule, Button, Checkbox, Dialog, InputText, Textarea, Message, RadioButton],
  template: `
    <p-dialog
      header="{{ readOnly ? 'Assessment preview' : editingId ? 'Edit assessment' : 'Add assessment' }}"
      [(visible)]="visible"
      [modal]="true"
      [focusTrap]="false"
      appendTo="body"
      [style]="{ width: 'min(720px, 96vw)' }"
      (onHide)="onHide()"
    >
      @if (loadError()) {
        <p-message severity="error" [text]="loadError()!" styleClass="mb-2" />
      }
      @if (saveError()) {
        <p-message severity="error" [text]="saveError()!" styleClass="mb-2" />
      }

      <div class="settings">
        <label class="full">
          <span>Assessment title</span>
          <input pInputText [(ngModel)]="title" [readonly]="readOnly" />
        </label>
        <label>
          <span>Passing score (%)</span>
          <input pInputText type="number" min="1" max="100" [(ngModel)]="passingScore" [readonly]="readOnly" />
        </label>
        <label>
          <span>Maximum attempts</span>
          <input pInputText type="number" min="1" [(ngModel)]="maxAttempts" [readonly]="readOnly" />
        </label>
        <label class="check full">
          <p-checkbox
            [(ngModel)]="showCorrectAnswers"
            [binary]="true"
            inputId="show-answers"
            [disabled]="readOnly"
          />
          <span>Show correct answers after submit</span>
        </label>
      </div>

      <div class="bank">
        @for (q of questions; track $index; let qi = $index) {
          <article class="q-card">
            <div class="q-head">
              <strong>Question {{ qi + 1 }}</strong>
              @if (!readOnly) {
                <p-button icon="pi pi-arrow-up" [text]="true" size="small" [disabled]="qi === 0" (onClick)="move(qi, -1)" />
                <p-button icon="pi pi-arrow-down" [text]="true" size="small" [disabled]="qi === questions.length - 1" (onClick)="move(qi, 1)" />
                <p-button icon="pi pi-trash" severity="danger" [text]="true" size="small" (onClick)="removeQuestion(qi)" />
              }
            </div>
            <textarea pTextarea rows="2" [(ngModel)]="q.prompt" placeholder="Question text" [readonly]="readOnly"></textarea>
            <div class="opts">
              @for (opt of q.options; track $index; let oi = $index) {
                <label class="opt-row">
                  <p-radioButton
                    [name]="'correct-' + qi"
                    [value]="oi"
                    [ngModel]="correctIndex(q)"
                    (ngModelChange)="setCorrect(q, $event)"
                    [disabled]="readOnly"
                  />
                  <input pInputText [(ngModel)]="opt.label" [placeholder]="'Option ' + letter(oi)" [readonly]="readOnly" />
                  @if (!readOnly) {
                    <p-button
                      icon="pi pi-times"
                      [text]="true"
                      severity="secondary"
                      [disabled]="q.options.length <= 2"
                      (onClick)="removeOption(qi, oi)"
                    />
                  }
                </label>
              }
              @if (!readOnly && q.options.length < 6) {
                <p-button label="Add option" [text]="true" size="small" (onClick)="addOption(qi)" />
              }
            </div>
            <label class="explain">
              <span>Explanation (optional)</span>
              <textarea pTextarea rows="2" [(ngModel)]="q.explanation" [readonly]="readOnly"></textarea>
            </label>
          </article>
        }
      </div>

      <div class="footer">
        @if (!readOnly) {
          <p-button label="Add question" severity="secondary" [outlined]="true" size="small" (onClick)="addQuestion()" />
        }
        <div class="spacer"></div>
        <p-button label="Close" [text]="true" size="small" (onClick)="visible = false" />
        @if (!readOnly) {
          <p-button label="Save draft" severity="secondary" [outlined]="true" size="small" [loading]="saving()" (onClick)="save('DRAFT')" />
          <p-button label="Publish assessment" size="small" [loading]="saving()" (onClick)="save('PUBLISHED')" />
        }
      </div>
    </p-dialog>
  `,
  styles: [
    `
      .settings {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
      }
      .full { grid-column: 1 / -1; }
      label, .explain {
        display: grid;
        gap: 0.3rem;
        font-size: 0.85rem;
        color: var(--ctp-muted);
      }
      .check {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .bank {
        display: grid;
        gap: 0.75rem;
        max-height: 52vh;
        overflow: auto;
      }
      .q-card {
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: 0.8rem;
        background: var(--ctp-panel);
      }
      .q-head, .opt-row, .footer {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .opts { display: grid; gap: 0.4rem; margin: 0.55rem 0; }
      .opt-row input { flex: 1; min-width: 0; }
      .opt-row { min-height: 44px; }
      .explain { margin-top: 0.4rem; }
      .footer { margin-top: 0.85rem; }
      .spacer { flex: 1; }
      @media (max-width: 640px) {
        .settings { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class AssessmentEditorComponent {
  private readonly api = inject(QuizApiService);
  readonly saved = output<void>();

  lessonId = '';
  editingId: string | null = null;
  visible = false;
  readOnly = false;
  title = 'Assessment';
  passingScore = 80;
  maxAttempts = 3;
  showCorrectAnswers = false;
  questions: QuizQuestionAdmin[] = [];

  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  open(lessonId: string, opts?: { preview?: boolean }): void {
    this.lessonId = lessonId;
    this.readOnly = !!opts?.preview;
    this.visible = true;
    this.editingId = null;
    this.loadError.set(null);
    this.saveError.set(null);
    this.api.getAdminQuiz(lessonId).subscribe({
      next: (bank) => {
        this.editingId = bank.id;
        this.title = bank.title || 'Assessment';
        this.passingScore = bank.passingScore;
        this.maxAttempts = bank.maxAttempts;
        this.showCorrectAnswers = bank.showCorrectAnswers;
        this.questions = bank.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          explanation: q.explanation ?? '',
          points: q.points,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
          })),
        }));
        if (!this.questions.length) this.questions = [this.emptyQuestion()];
      },
      error: () => {
        if (this.readOnly) {
          this.loadError.set('No assessment to preview.');
          return;
        }
        this.questions = [this.emptyQuestion()];
      },
    });
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  correctIndex(question: QuizQuestionAdmin): number {
    return Math.max(0, question.options.findIndex((o) => o.isCorrect));
  }

  setCorrect(question: QuizQuestionAdmin, index: number): void {
    question.options.forEach((opt, i) => (opt.isCorrect = i === index));
  }

  addQuestion(): void {
    this.questions.push(this.emptyQuestion());
  }

  removeQuestion(index: number): void {
    this.questions.splice(index, 1);
  }

  move(index: number, delta: number): void {
    const next = index + delta;
    if (next < 0 || next >= this.questions.length) return;
    const copy = [...this.questions];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    this.questions = copy;
  }

  addOption(qi: number): void {
    if (this.questions[qi].options.length >= 6) return;
    this.questions[qi].options.push({ label: '', isCorrect: false });
  }

  removeOption(qi: number, oi: number): void {
    const question = this.questions[qi];
    if (question.options.length <= 2) return;
    const wasCorrect = question.options[oi].isCorrect;
    question.options.splice(oi, 1);
    if (wasCorrect) question.options[0].isCorrect = true;
  }

  save(status: 'DRAFT' | 'PUBLISHED'): void {
    this.saveError.set(null);
    const error = this.validate(status === 'PUBLISHED');
    if (error) {
      this.saveError.set(error);
      return;
    }
    this.saving.set(true);
    const payload = {
      title: this.title.trim(),
      passingScore: Number(this.passingScore),
      maxAttempts: Number(this.maxAttempts),
      showCorrectAnswers: this.showCorrectAnswers,
      shuffleQuestions: false,
      status,
      questions: this.questions.map((q) => ({
        prompt: q.prompt.trim(),
        explanation: q.explanation?.trim() || null,
        points: 1,
        options: q.options
          .filter((o) => o.label.trim())
          .map((o) => ({ label: o.label.trim(), isCorrect: o.isCorrect })),
      })),
    };
    this.api.upsertQuiz(this.lessonId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible = false;
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not save assessment');
      },
    });
  }

  onHide(): void {
    this.visible = false;
  }

  private validate(strict: boolean): string | null {
    if (!this.title.trim()) return 'Assessment title is required.';
    const passing = Number(this.passingScore);
    const attempts = Number(this.maxAttempts);
    if (!Number.isFinite(passing) || passing < 1 || passing > 100) {
      return 'Passing score must be between 1 and 100.';
    }
    if (!Number.isFinite(attempts) || attempts < 1) {
      return 'Maximum attempts must be at least 1.';
    }
    if (!this.questions.length) return 'Add at least one question.';
    for (const [index, question] of this.questions.entries()) {
      if (!question.prompt.trim()) return `Question ${index + 1} needs text.`;
      const options = question.options.filter((o) => o.label.trim());
      if (options.length < 2) return `Question ${index + 1} needs at least 2 options.`;
      if (options.length > 6) return `Question ${index + 1} can have at most 6 options.`;
      if (options.filter((o) => o.isCorrect).length !== 1) {
        return `Question ${index + 1} must have exactly one correct answer.`;
      }
    }
    if (!strict && !this.questions.some((q) => q.prompt.trim())) {
      return 'Add at least one question.';
    }
    return null;
  }

  private emptyQuestion(): QuizQuestionAdmin {
    return {
      prompt: '',
      explanation: '',
      points: 1,
      options: [
        { label: '', isCorrect: true },
        { label: '', isCorrect: false },
        { label: '', isCorrect: false },
        { label: '', isCorrect: false },
      ],
    };
  }
}
