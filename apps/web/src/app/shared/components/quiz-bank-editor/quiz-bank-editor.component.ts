import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { QuizApiService, type QuizQuestionAdmin } from '../../../core/http/quiz-api.service';

@Component({
  selector: 'app-quiz-bank-editor',
  standalone: true,
  imports: [FormsModule, Button, Checkbox, Dialog, InputText, Message],
  template: `
    <p-dialog
      header="Question bank"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: 'min(760px, 96vw)' }"
      (onHide)="onHide()"
    >
      @if (loadError()) {
        <p-message severity="info" [text]="loadError()!" styleClass="mb-3" />
      }

      <div class="settings">
        <label>
          <span>Title</span>
          <input pInputText [(ngModel)]="title" />
        </label>
        <label>
          <span>Passing %</span>
          <input pInputText type="number" [(ngModel)]="passingScore" />
        </label>
        <label>
          <span>Questions per attempt</span>
          <input pInputText type="number" [(ngModel)]="questionCount" />
        </label>
        <label>
          <span>Max attempts</span>
          <input pInputText type="number" [(ngModel)]="maxAttempts" />
        </label>
        <label class="check">
          <p-checkbox [(ngModel)]="shuffleQuestions" [binary]="true" inputId="shuffle" />
          <span>Shuffle questions</span>
        </label>
      </div>

      <div class="bank">
        @for (q of questions; track $index; let qi = $index) {
          <article class="q-card">
            <div class="q-head">
              <strong>Question {{ qi + 1 }}</strong>
              <p-button
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                (onClick)="removeQuestion(qi)"
              />
            </div>
            <input pInputText [(ngModel)]="q.prompt" placeholder="Prompt" class="w-full" />
            <div class="opts">
              @for (opt of q.options; track $index; let oi = $index) {
                <div class="opt-row">
                  <p-checkbox
                    [(ngModel)]="opt.isCorrect"
                    [binary]="true"
                    [inputId]="'c-' + qi + '-' + oi"
                  />
                  <input pInputText [(ngModel)]="opt.label" placeholder="Option" class="grow" />
                  <p-button
                    icon="pi pi-times"
                    [text]="true"
                    severity="secondary"
                    (onClick)="removeOption(qi, oi)"
                    [disabled]="q.options.length <= 2"
                  />
                </div>
              }
              <p-button label="Add option" [text]="true" (onClick)="addOption(qi)" />
            </div>
          </article>
        }
      </div>

      <div class="footer">
        <p-button label="Add question" severity="secondary" [outlined]="true" (onClick)="addQuestion()" />
        <div class="spacer"></div>
        <p-button label="Cancel" [text]="true" (onClick)="visible = false" />
        <p-button label="Save bank" [loading]="saving()" (onClick)="save()" />
      </div>

      @if (saveError()) {
        <p-message severity="error" [text]="saveError()!" styleClass="mt-2" />
      }
    </p-dialog>
  `,
  styles: [
    `
      .settings {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: var(--ctp-muted);
      }
      .check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        grid-column: 1 / -1;
      }
      .bank {
        display: grid;
        gap: 0.85rem;
        max-height: 50vh;
        overflow: auto;
      }
      .q-card {
        border: 1px solid var(--ctp-border);
        border-radius: 0.75rem;
        padding: 0.85rem;
        background: var(--ctp-panel);
      }
      .q-head,
      .opt-row,
      .footer {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .opts {
        margin-top: 0.65rem;
        display: grid;
        gap: 0.45rem;
      }
      .grow,
      .w-full {
        flex: 1;
        width: 100%;
      }
      .footer {
        margin-top: 1rem;
      }
      .spacer {
        flex: 1;
      }
      @media (max-width: 640px) {
        .settings {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class QuizBankEditorComponent {
  private readonly api = inject(QuizApiService);
  readonly saved = output<void>();

  lessonId = '';
  levelId = '';
  visible = false;

  title = 'Knowledge check';
  passingScore = 70;
  questionCount = 5;
  maxAttempts = 3;
  shuffleQuestions = true;
  questions: QuizQuestionAdmin[] = [];

  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  open(lessonId: string): void {
    this.lessonId = lessonId;
    this.levelId = '';
    this.visible = true;
    this.loadError.set(null);
    this.saveError.set(null);
    this.api.getAdminQuiz(lessonId).subscribe({
      next: (bank) => {
        this.title = bank.title || 'Assessment';
        this.passingScore = bank.passingScore;
        this.questionCount = bank.questionCount;
        this.maxAttempts = bank.maxAttempts;
        this.shuffleQuestions = bank.shuffleQuestions;
        this.questions = bank.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          points: q.points,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
          })),
        }));
      },
      error: () => {
        this.loadError.set('No bank yet — create questions below.');
        this.questions = [this.emptyQuestion()];
      },
    });
  }

  openForLevel(levelId: string): void {
    this.levelId = levelId;
    this.lessonId = '';
    this.visible = true;
    this.loadError.set(null);
    this.saveError.set(null);
    this.title = 'Final assessment';
    this.api.getAdminLevelQuiz(levelId).subscribe({
      next: (bank) => {
        this.title = bank.title || 'Final assessment';
        this.passingScore = bank.passingScore;
        this.questionCount = bank.questionCount;
        this.maxAttempts = bank.maxAttempts;
        this.shuffleQuestions = bank.shuffleQuestions;
        this.questions = bank.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          points: q.points,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
          })),
        }));
      },
      error: () => {
        this.loadError.set('No final assessment yet — create questions below.');
        this.questions = [this.emptyQuestion()];
      },
    });
  }

  addQuestion(): void {
    this.questions.push(this.emptyQuestion());
  }

  removeQuestion(i: number): void {
    this.questions.splice(i, 1);
  }

  addOption(qi: number): void {
    this.questions[qi].options.push({ label: '', isCorrect: false });
  }

  removeOption(qi: number, oi: number): void {
    this.questions[qi].options.splice(oi, 1);
  }

  save(): void {
    this.saveError.set(null);
    if (!this.questions.length) {
      this.saveError.set('Add at least one question');
      return;
    }
    for (const q of this.questions) {
      if (!q.prompt.trim() || q.options.filter((o) => o.label.trim()).length < 2) {
        this.saveError.set('Each question needs a prompt and at least two options');
        return;
      }
      if (!q.options.some((o) => o.isCorrect)) {
        this.saveError.set('Mark at least one correct option per question');
        return;
      }
    }
    this.saving.set(true);
    const payload = {
      title: this.title,
      passingScore: Number(this.passingScore),
      questionCount: Number(this.questionCount),
      maxAttempts: Number(this.maxAttempts),
      shuffleQuestions: this.shuffleQuestions,
      questions: this.questions.map((q) => ({
        prompt: q.prompt.trim(),
        points: q.points ?? 1,
        options: q.options
          .filter((o) => o.label.trim())
          .map((o) => ({ label: o.label.trim(), isCorrect: o.isCorrect })),
      })),
    };
    const req = this.levelId
      ? this.api.upsertLevelQuiz(this.levelId, { ...payload, status: 'PUBLISHED' })
      : this.api.upsertQuiz(this.lessonId, payload);
    req.subscribe({
        next: () => {
          this.saving.set(false);
          this.visible = false;
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(err?.error?.error?.message ?? 'Save failed');
        },
      });
  }

  onHide(): void {
    this.visible = false;
  }

  private emptyQuestion(): QuizQuestionAdmin {
    return {
      prompt: '',
      points: 1,
      options: [
        { label: '', isCorrect: true },
        { label: '', isCorrect: false },
      ],
    };
  }
}
