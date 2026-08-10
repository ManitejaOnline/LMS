import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { QuizApiService, type LearnerQuizAttempt, type QuizSubmitResult } from '../../core/http/quiz-api.service';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-final-assessment-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    RouterLink,
    FormsModule,
    Button,
    Message,
    RadioButton,
  ],
  template: `
    <app-page-header title="Final assessment" subtitle="Server-scored. Correct answers stay hidden until allowed." />
    <a [routerLink]="['/app/learning/programs', programId]" class="back">← Back to Program</a>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-3" />
    }
    @if (loading()) {
      <app-loading-state message="Loading assessment…" />
    } @else if (result(); as res) {
      <section class="ctp-card panel">
        <h2>{{ res.passed ? 'Passed' : 'Not passed' }}</h2>
        <p>{{ res.score }}% · Passing score {{ res.passingScore }}%</p>
        @if (res.passed) {
          <a routerLink="/app/my-learning" class="no-underline"><p-button label="Return to My Learning" /></a>
        } @else if (res.remainingAttempts > 0) {
          <p-button label="Try again" (onClick)="start()" />
        }
      </section>
    } @else if (attempt(); as att) {
      <form class="ctp-card panel" (ngSubmit)="submit()">
        <h2>{{ att.title || 'Final assessment' }}</h2>
        <p class="muted">Attempt {{ att.attemptNumber }} of {{ att.maxAttempts }}</p>
        @for (q of att.questions; track q.id) {
          <fieldset>
            <legend>{{ q.prompt }}</legend>
            @for (opt of q.options; track opt.id) {
              <label class="opt">
                <p-radiobutton [name]="q.id" [value]="opt.id" [(ngModel)]="answers[q.id]" [inputId]="opt.id" />
                <span>{{ opt.label }}</span>
              </label>
            }
          </fieldset>
        }
        <p-button type="submit" label="Submit assessment" [loading]="submitting()" [disabled]="!allAnswered()" />
      </form>
    } @else {
      <section class="ctp-card panel">
        <p>Complete the final assessment to finish the program.</p>
        <p-button label="Start assessment" (onClick)="start()" />
      </section>
    }
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: var(--s3); color: var(--ctp-primary); min-height: 44px; }
      .panel { padding: var(--ctp-card-pad); display: grid; gap: var(--s3); }
      fieldset { border: 0; padding: 0; display: grid; gap: 8px; }
      .opt { display: flex; align-items: center; gap: 8px; min-height: 44px; }
      .muted { color: var(--ctp-muted); }
    `,
  ],
})
export class FinalAssessmentPageComponent implements OnInit {
  private readonly quizApi = inject(QuizApiService);
  private readonly programsApi = inject(ProgramsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly attempt = signal<LearnerQuizAttempt | null>(null);
  readonly result = signal<QuizSubmitResult | null>(null);
  answers: Record<string, string> = {};
  programId = '';

  ngOnInit(): void {
    this.programId = this.route.snapshot.paramMap.get('programId') ?? '';
    this.programsApi.myProgram(this.programId).subscribe({
      next: (view) => {
        const finalLevel = view.levels.find((level) => level.isFinal);
        if (!finalLevel?.finalAssessment?.available && !finalLevel?.finalAssessment?.passed) {
          this.error.set('Final assessment is not available yet.');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Could not open final assessment');
      },
    });
  }

  start(): void {
    this.error.set(null);
    this.result.set(null);
    this.quizApi.startFinalAttempt(this.programId).subscribe({
      next: (attempt) => {
        this.attempt.set(attempt);
        this.answers = {};
      },
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Could not start assessment'),
    });
  }

  allAnswered(): boolean {
    const att = this.attempt();
    return !!att && att.questions.every((q) => !!this.answers[q.id]);
  }

  submit(): void {
    const att = this.attempt();
    if (!att) return;
    this.submitting.set(true);
    const payload = att.questions.map((q) => ({ questionId: q.id, optionId: this.answers[q.id] }));
    this.quizApi.submitAttempt(att.attemptId, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.result.set(res);
        this.attempt.set(null);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error?.message ?? 'Submit failed');
      },
    });
  }
}
