import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client.service';

export interface QuizOptionAdmin {
  id?: string;
  label: string;
  isCorrect: boolean;
  sortOrder?: number;
}

export interface QuizQuestionAdmin {
  id?: string;
  prompt: string;
  points?: number;
  options: QuizOptionAdmin[];
}

export interface QuizBank {
  id: string;
  lessonId: string;
  title: string;
  passingScore: number;
  questionCount: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  questions: Array<{
    id: string;
    prompt: string;
    points: number;
    options: Array<{ id: string; label: string; isCorrect: boolean; sortOrder: number }>;
  }>;
}

export interface UpsertQuizPayload {
  title?: string;
  passingScore?: number;
  questionCount?: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  questions: QuizQuestionAdmin[];
}

export interface LearnerQuizAttempt {
  attemptId: string;
  attemptNumber: number;
  maxAttempts: number;
  passingScore: number;
  title: string;
  questions: Array<{
    id: string;
    prompt: string;
    points: number;
    options: Array<{ id: string; label: string; sortOrder: number }>;
  }>;
}

export interface QuizSubmitResult {
  id: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: string;
  passingScore: number;
}

export interface QuizAttemptSummary {
  id: string;
  attemptNumber: number;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class QuizApiService {
  private readonly api = inject(ApiClient);

  getAdminQuiz(lessonId: string): Observable<QuizBank> {
    return this.api.get<QuizBank>(`/lessons/${lessonId}/quiz`);
  }

  upsertQuiz(lessonId: string, payload: UpsertQuizPayload): Observable<QuizBank> {
    return this.api.put<QuizBank, UpsertQuizPayload>(`/lessons/${lessonId}/quiz`, payload);
  }

  startAttempt(assignmentId: string, lessonId: string): Observable<LearnerQuizAttempt> {
    return this.api.post<LearnerQuizAttempt>(
      `/learning/assignments/${assignmentId}/lessons/${lessonId}/quiz/start`,
      {},
    );
  }

  submitAttempt(
    attemptId: string,
    answers: Array<{ questionId: string; optionId: string }>,
  ): Observable<QuizSubmitResult> {
    return this.api.post<QuizSubmitResult, { answers: typeof answers }>(
      `/learning/quiz-attempts/${attemptId}/submit`,
      { answers },
    );
  }

  listAttempts(assignmentId: string, lessonId: string): Observable<QuizAttemptSummary[]> {
    return this.api.get<QuizAttemptSummary[]>(
      `/learning/assignments/${assignmentId}/lessons/${lessonId}/quiz/attempts`,
    );
  }
}
