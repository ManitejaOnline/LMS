import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { Tag } from 'primeng/tag';
import {
  QuizApiService,
  type LearnerQuizAttempt,
  type QuizAttemptSummary,
  type QuizSubmitResult,
} from '../../../core/http/quiz-api.service';
import { LoadingStateComponent } from '../loading-state/loading-state.component';

@Component({
  selector: 'app-quiz-runner',
  standalone: true,
  imports: [FormsModule, Button, Message, RadioButton, Tag, LoadingStateComponent],
  template: `
    <div class="quiz">
      @if (loading()) {
        <app-loading-state message="Loading quiz…" />
      } @else if (error()) {
        <p-message severity="error" [text]="error()!" />
        <p-button label="Retry" class="mt" (onClick)="bootstrap()" />
      } @else if (result(); as res) {
        <div class="result">
          <h3>{{ res.passed ? 'Passed' : 'Not passed' }}</h3>
          <p class="muted">
            Score {{ res.score }}% · Passing score {{ res.passingScore }}% · Attempt
            {{ res.attemptNumber }}
          </p>
          <p-tag
            [value]="res.passed ? 'Lesson marked complete' : 'Try again if attempts remain'"
            [severity]="res.passed ? 'success' : 'warn'"
          />
          <div class="actions">
            @if (!res.passed && canRetry()) {
              <p-button label="Retry quiz" (onClick)="startFresh()" />
            }
          </div>
        </div>
      } @else if (attempt(); as att) {
        <div class="meta">
          <div>
            <h3>{{ att.title }}</h3>
            <p class="muted">
              Attempt {{ att.attemptNumber }} of {{ att.maxAttempts }} · Pass {{ att.passingScore }}%
            </p>
          </div>
          <p-tag value="Randomized" severity="info" />
        </div>

        <form class="questions" (ngSubmit)="submit()">
          @for (q of att.questions; track q.id; let i = $index) {
            <fieldset class="q">
              <legend>{{ i + 1 }}. {{ q.prompt }}</legend>
              <div class="opts">
                @for (opt of q.options; track opt.id) {
                  <label class="opt">
                    <p-radiobutton
                      [name]="q.id"
                      [value]="opt.id"
                      [(ngModel)]="answers[q.id]"
                      [inputId]="opt.id"
                    />
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </fieldset>
          }
          <div class="actions">
            <p-button
              type="submit"
              label="Submit answers"
              [loading]="submitting()"
              [disabled]="!allAnswered()"
            />
          </div>
        </form>
      } @else {
        <div class="intro">
          <h3>Knowledge check</h3>
          <p class="muted">
            Questions are drawn randomly from the bank. Passing the quiz completes this lesson.
          </p>
          @if (prior().length) {
            <div class="history">
              <div class="panel-title">Previous attempts</div>
              @for (a of prior(); track a.id) {
                <div class="hist-row">
                  <span>Attempt {{ a.attemptNumber }}</span>
                  <span>
                    @if (a.submittedAt) {
                      {{ a.score }}%
                      {{ a.passed ? '· Pass' : '· Fail' }}
                    } @else {
                      In progress
                    }
                  </span>
                </div>
              }
            </div>
          }
          <p-button label="Start quiz" (onClick)="startFresh()" [loading]="starting()" />
        </div>
      }
    </div>
  `,
  styles: [
    `
      .quiz {
        padding: var(--ctp-card-pad);
        overflow: auto;
        height: 100%;
        background: var(--ctp-panel);
        font-size: var(--ctp-fs-body);
      }
      h3 {
        margin: 0 0 4px;
        color: var(--ctp-brand);
        font-size: var(--ctp-fs-section);
      }
      .muted {
        color: var(--ctp-muted);
        margin: 0;
        font-size: var(--ctp-fs-small);
      }
      .meta,
      .actions,
      .hist-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s3);
      }
      .questions {
        display: grid;
        gap: var(--s3);
        margin-top: var(--s3);
      }
      .q {
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--s3);
        margin: 0;
      }
      legend {
        font-weight: 600;
        padding: 0 4px;
        font-size: var(--ctp-fs-body);
      }
      .opts {
        display: grid;
        gap: 6px;
        margin-top: var(--s2);
      }
      .opt {
        display: flex;
        align-items: center;
        gap: var(--s2);
        cursor: pointer;
        font-size: var(--ctp-fs-body);
      }
      .intro,
      .result {
        max-width: 32rem;
      }
      .history {
        margin: var(--s3) 0;
        border: 1px solid var(--ctp-border);
        border-radius: var(--ctp-radius);
        padding: var(--s3);
      }
      .panel-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ctp-muted);
        margin-bottom: var(--s2);
      }
      .hist-row {
        font-size: 0.9rem;
        padding: 0.35rem 0;
      }
      .mt {
        margin-top: 0.75rem;
        display: inline-block;
      }
      .actions {
        margin-top: 1rem;
      }
    `,
  ],
})
export class QuizRunnerComponent implements OnChanges {
  private readonly api = inject(QuizApiService);

  readonly assignmentId = input.required<string>();
  readonly lessonId = input.required<string>();
  readonly completed = output<QuizSubmitResult>();

  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly attempt = signal<LearnerQuizAttempt | null>(null);
  readonly result = signal<QuizSubmitResult | null>(null);
  readonly prior = signal<QuizAttemptSummary[]>([]);
  answers: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lessonId'] || changes['assignmentId']) {
      this.reset();
      this.bootstrap();
    }
  }

  bootstrap(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listAttempts(this.assignmentId(), this.lessonId()).subscribe({
      next: (list) => {
        this.prior.set(list);
        const open = list.find((a) => !a.submittedAt);
        const passed = list.find((a) => a.passed);
        if (passed) {
          this.result.set({
            id: passed.id,
            score: passed.score ?? 0,
            passed: true,
            attemptNumber: passed.attemptNumber,
            submittedAt: passed.submittedAt ?? '',
            passingScore: 0,
          });
          this.loading.set(false);
          return;
        }
        if (open) {
          this.startFresh();
          return;
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Unable to load quiz attempts');
      },
    });
  }

  startFresh(): void {
    this.starting.set(true);
    this.result.set(null);
    this.error.set(null);
    this.answers = {};
    this.api.startAttempt(this.assignmentId(), this.lessonId()).subscribe({
      next: (att) => {
        this.attempt.set(att);
        this.starting.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.starting.set(false);
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Unable to start quiz');
      },
    });
  }

  allAnswered(): boolean {
    const att = this.attempt();
    if (!att) return false;
    return att.questions.every((q) => !!this.answers[q.id]);
  }

  canRetry(): boolean {
    const last = this.result();
    const att = this.attempt();
    const max = att?.maxAttempts ?? this.prior()[0]?.attemptNumber ?? 3;
    const used = Math.max(
      last?.attemptNumber ?? 0,
      ...this.prior().map((p) => p.attemptNumber),
      0,
    );
    return used < max;
  }

  submit(): void {
    const att = this.attempt();
    if (!att || !this.allAnswered()) return;
    this.submitting.set(true);
    const payload = att.questions.map((q) => ({
      questionId: q.id,
      optionId: this.answers[q.id],
    }));
    this.api.submitAttempt(att.attemptId, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.attempt.set(null);
        this.result.set(res);
        this.completed.emit(res);
        this.api.listAttempts(this.assignmentId(), this.lessonId()).subscribe({
          next: (list) => this.prior.set(list),
        });
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error?.message ?? 'Submit failed');
      },
    });
  }

  private reset(): void {
    this.attempt.set(null);
    this.result.set(null);
    this.prior.set([]);
    this.answers = {};
    this.error.set(null);
  }
}
