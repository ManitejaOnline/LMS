import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  QuizApiService,
  type LearnerQuizAttempt,
  type QuizSubmitResult,
} from '../../../core/http/quiz-api.service';
import type { PlayerAssessmentDto } from '../../../core/models/domain.models';
import { LoadingStateComponent } from '../loading-state/loading-state.component';

@Component({
  selector: 'app-assessment-runner',
  standalone: true,
  imports: [FormsModule, Button, Message, LoadingStateComponent],
  template: `
    <div class="wrap">
      @if (loading()) {
        <app-loading-state message="Loading assessment…" />
      } @else if (error()) {
        <p-message severity="error" [text]="error()!" />
      } @else if (result(); as res) {
        <section class="result">
          <p class="eyebrow">{{ res.passed ? 'PASSED' : 'NOT PASSED' }}</p>
          <h2>{{ res.title || 'Assessment' }}</h2>
          <p class="score">{{ res.correctCount }} / {{ res.totalQuestions }}</p>
          <p class="pct">{{ res.score }}%</p>
          <p class="muted">Passing score: {{ res.passingScore }}%</p>
          <p class="muted">Attempt {{ res.attemptNumber }}</p>
          @if (res.passed) {
            <p class="ok">Assessment passed</p>
            <p-button label="Continue to next lesson" size="small" (onClick)="continueNext.emit()" />
          } @else if (res.remainingAttempts > 0) {
            <p class="warn">{{ res.remainingAttempts }} attempt(s) remaining</p>
            <p-button label="Try again" size="small" (onClick)="startFresh()" />
          } @else {
            <p class="warn">Attempts exhausted</p>
          }
        </section>
      } @else if (attempt(); as att) {
        <header class="head">
          <div>
            <p class="eyebrow">{{ att.title || 'Assessment' }}</p>
            <h2>Question {{ index() + 1 }} of {{ att.questions.length }}</h2>
          </div>
          <p class="muted">Attempt {{ att.attemptNumber }} of {{ att.maxAttempts }}</p>
        </header>
        <p class="prompt">{{ currentQuestion()?.prompt }}</p>
        <div class="opts" role="radiogroup">
          @for (opt of currentQuestion()?.options ?? []; track opt.id; let oi = $index) {
            <button
              type="button"
              class="opt"
              [class.selected]="answers[currentQuestion()!.id] === opt.id"
              (click)="select(currentQuestion()!.id, opt.id)"
            >
              <span class="letter">{{ letter(oi) }}</span>
              <span>{{ opt.label }}</span>
            </button>
          }
        </div>
        <footer class="nav">
          <p-button label="Previous" severity="secondary" [outlined]="true" size="small" [disabled]="index() === 0" (onClick)="goPrevQuestion()" />
          @if (index() < att.questions.length - 1) {
            <p-button label="Next" size="small" [disabled]="!answers[currentQuestion()!.id]" (onClick)="goNextQuestion()" />
          } @else {
            <p-button label="Submit assessment" size="small" [loading]="submitting()" [disabled]="!allAnswered()" (onClick)="submit()" />
          }
        </footer>
      } @else {
        <section class="intro">
          <h2>{{ assessment()?.title || 'Assessment' }}</h2>
          <p class="muted">{{ assessment()?.questionCount || 0 }} questions · Pass {{ assessment()?.passingScore }}%</p>
          @if (assessment()?.state === 'exhausted') {
            <p class="warn">Attempts exhausted</p>
          } @else if (assessment()?.state === 'locked') {
            <p class="muted">{{ assessment()?.lockReason }}</p>
          } @else {
            <p-button
              [label]="assessment()?.state === 'failed' ? 'Try again' : 'Start assessment'"
              size="small"
              [loading]="starting()"
              (onClick)="startFresh()"
            />
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .wrap { height: 100%; overflow: auto; padding: 1rem; background: var(--ctp-panel); }
      .head, .nav { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
      h2 { margin: 0; font-size: 1.05rem; color: var(--ctp-brand); }
      .eyebrow { margin: 0 0 0.2rem; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ctp-muted); }
      .muted { color: var(--ctp-muted); margin: 0.25rem 0 0; font-size: 0.88rem; }
      .prompt { margin: 1rem 0 0.75rem; font-size: 0.98rem; line-height: 1.45; }
      .opts { display: grid; gap: 0.55rem; }
      .opt {
        min-height: 44px;
        display: flex;
        gap: 0.7rem;
        align-items: center;
        text-align: left;
        border: 1px solid var(--ctp-border);
        border-radius: 10px;
        background: var(--ctp-bg);
        padding: 0.7rem 0.85rem;
        cursor: pointer;
        font: inherit;
        color: inherit;
      }
      .opt.selected { border-color: var(--ctp-primary); background: var(--ctp-primary-soft); }
      .letter {
        width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center;
        background: var(--ctp-surface); font-weight: 700; font-size: 0.8rem; flex-shrink: 0;
      }
      .nav { margin-top: 1rem; }
      .result, .intro { max-width: 28rem; }
      .score { font-size: 1.6rem; font-weight: 700; margin: 0.5rem 0 0; }
      .pct { margin: 0; font-size: 1.1rem; }
      .ok { color: var(--ctp-success); font-weight: 600; }
      .warn { color: #b45309; font-weight: 600; }
    `,
  ],
})
export class AssessmentRunnerComponent implements OnChanges {
  private readonly api = inject(QuizApiService);

  readonly assignmentId = input.required<string>();
  readonly lessonId = input.required<string>();
  readonly assessment = input<PlayerAssessmentDto | null>(null);
  readonly completed = output<QuizSubmitResult>();
  readonly continueNext = output<void>();

  readonly loading = signal(false);
  readonly starting = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly attempt = signal<LearnerQuizAttempt | null>(null);
  readonly result = signal<QuizSubmitResult | null>(null);
  readonly index = signal(0);
  answers: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lessonId'] || changes['assignmentId']) {
      this.reset();
      this.bootstrap();
    }
  }

  currentQuestion() {
    return this.attempt()?.questions[this.index()] ?? null;
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  select(questionId: string, optionId: string): void {
    this.answers[questionId] = optionId;
  }

  goPrevQuestion(): void {
    this.index.update((value) => Math.max(0, value - 1));
  }

  goNextQuestion(): void {
    this.index.update((value) => value + 1);
  }

  allAnswered(): boolean {
    const att = this.attempt();
    return !!att && att.questions.every((q) => !!this.answers[q.id]);
  }

  startFresh(): void {
    this.starting.set(true);
    this.error.set(null);
    this.result.set(null);
    this.answers = {};
    this.index.set(0);
    this.api.startLearnerAttempt(this.lessonId()).subscribe({
      next: (att) => {
        this.attempt.set(att);
        this.starting.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.starting.set(false);
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Unable to start assessment');
      },
    });
  }

  submit(): void {
    const att = this.attempt();
    if (!att || !this.allAnswered()) return;
    this.submitting.set(true);
    this.api
      .submitAttempt(
        att.attemptId,
        att.questions.map((q) => ({ questionId: q.id, optionId: this.answers[q.id] })),
      )
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.attempt.set(null);
          this.result.set(res);
          this.completed.emit(res);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.error?.message ?? 'Submit failed');
        },
      });
  }

  private bootstrap(): void {
    const summary = this.assessment();
    if (summary?.state === 'passed' && summary.lastAttemptId) {
      this.loading.set(true);
      this.api.getResult(summary.lastAttemptId).subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }
    this.loading.set(false);
  }

  private reset(): void {
    this.attempt.set(null);
    this.result.set(null);
    this.answers = {};
    this.index.set(0);
    this.error.set(null);
  }
}
