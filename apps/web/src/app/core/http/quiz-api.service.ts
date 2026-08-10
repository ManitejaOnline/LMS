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
  explanation?: string | null;
  points?: number;
  options: QuizOptionAdmin[];
}

export interface QuizBank {
  id: string;
  lessonId?: string | null;
  levelId?: string | null;
  title: string | null;
  passingScore: number;
  questionCount: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  status: 'DRAFT' | 'PUBLISHED';
  showCorrectAnswers: boolean;
  questions: Array<{
    id: string;
    prompt: string;
    explanation?: string | null;
    points: number;
    sortOrder: number;
    options: Array<{ id: string; label: string; isCorrect: boolean; sortOrder: number }>;
  }>;
}

export interface UpsertQuizPayload {
  title?: string;
  passingScore?: number;
  questionCount?: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  showCorrectAnswers?: boolean;
  status?: 'DRAFT' | 'PUBLISHED';
  questions: QuizQuestionAdmin[];
}

export interface LearnerQuizAttempt {
  attemptId: string;
  attemptNumber: number;
  maxAttempts: number;
  passingScore: number;
  title: string | null;
  questions: Array<{
    id: string;
    prompt: string;
    options: Array<{ id: string; label: string; sortOrder: number }>;
  }>;
}

export interface QuizSubmitResult {
  id: string;
  attemptId: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: string | null;
  passingScore: number;
  correctCount: number;
  incorrectCount: number;
  totalQuestions: number;
  remainingAttempts: number;
  showCorrectAnswers: boolean;
  lessonId?: string | null;
  title: string | null;
  programEvent?: {
    newlyCompletedLevelId: string | null;
    newlyCompletedLevelTitle: string | null;
    nextLevelTitle: string | null;
    programJustCompleted: boolean;
  } | null;
  answers?: Array<{
    questionId: string;
    prompt: string;
    explanation: string | null;
    selectedOptionId: string | null;
    correctOptionId: string | null;
    options: Array<{ id: string; label: string; isCorrect: boolean }>;
  }>;
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
    return this.api.get<QuizBank>(`/lessons/${lessonId}/assessment`);
  }

  getAdminLevelQuiz(levelId: string): Observable<QuizBank> {
    return this.api.get<QuizBank>(`/levels/${levelId}/assessment`);
  }

  upsertLevelQuiz(levelId: string, payload: UpsertQuizPayload): Observable<QuizBank> {
    return this.api.put<QuizBank, UpsertQuizPayload>(`/levels/${levelId}/assessment`, payload);
  }

  getLearnerFinalAssessment(programId: string): Observable<{
    enrollmentId: string;
    programId: string;
    levelId: string;
    assessment: {
      id: string;
      title: string | null;
      passingScore: number;
      maxAttempts: number;
      questionCount: number;
      passed: boolean;
      remainingAttempts: number;
    };
  }> {
    return this.api.get(`/learner/programs/${programId}/final-assessment`);
  }

  startFinalAttempt(programId: string): Observable<LearnerQuizAttempt> {
    return this.api.post<LearnerQuizAttempt>(`/learner/programs/${programId}/final-assessment/start`, {});
  }

  listFinalAttempts(programId: string): Observable<{
    enrollmentId: string;
    attempts: QuizAttemptSummary[];
  }> {
    return this.api.get(`/learner/programs/${programId}/final-assessment/attempts`);
  }

  createAssessment(
    lessonId: string,
    payload: { title?: string; passingScore?: number; maxAttempts?: number; showCorrectAnswers?: boolean },
  ): Observable<QuizBank> {
    return this.api.post<QuizBank>(`/lessons/${lessonId}/assessment`, payload);
  }

  upsertQuiz(lessonId: string, payload: UpsertQuizPayload): Observable<QuizBank> {
    return this.api.put<QuizBank, UpsertQuizPayload>(`/lessons/${lessonId}/assessment`, payload);
  }

  updateAssessment(
    assessmentId: string,
    payload: Partial<{
      title: string;
      passingScore: number;
      maxAttempts: number;
      showCorrectAnswers: boolean;
      status: 'DRAFT' | 'PUBLISHED';
    }>,
  ): Observable<QuizBank> {
    return this.api.patch<QuizBank>(`/assessments/${assessmentId}`, payload);
  }

  deleteAssessment(assessmentId: string): Observable<{ id: string; deleted: boolean }> {
    return this.api.delete(`/assessments/${assessmentId}`);
  }

  startAttempt(assignmentId: string, lessonId: string): Observable<LearnerQuizAttempt> {
    return this.api.post<LearnerQuizAttempt>(
      `/learning/assignments/${assignmentId}/lessons/${lessonId}/quiz/start`,
      {},
    );
  }

  startLearnerAttempt(lessonId: string): Observable<LearnerQuizAttempt> {
    return this.api.post<LearnerQuizAttempt>(`/learner/lessons/${lessonId}/assessment/start`, {});
  }

  submitAttempt(
    attemptId: string,
    answers: Array<{ questionId: string; optionId: string }>,
  ): Observable<QuizSubmitResult> {
    return this.api.post<QuizSubmitResult, { answers: typeof answers }>(
      `/learner/assessment-attempts/${attemptId}/submit`,
      { answers },
    );
  }

  getResult(attemptId: string): Observable<QuizSubmitResult> {
    return this.api.get<QuizSubmitResult>(`/learner/assessment-attempts/${attemptId}/result`);
  }

  listAttempts(assignmentId: string, lessonId: string): Observable<QuizAttemptSummary[]> {
    return this.api.get<QuizAttemptSummary[]>(
      `/learning/assignments/${assignmentId}/lessons/${lessonId}/quiz/attempts`,
    );
  }

  listLearnerAttempts(lessonId: string): Observable<{
    assignmentId: string;
    attempts: QuizAttemptSummary[];
  }> {
    return this.api.get(`/learner/lessons/${lessonId}/assessment/attempts`);
  }
}
