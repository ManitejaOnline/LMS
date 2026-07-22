import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';
import type {
  CourseAssignmentDto,
  LearningDashboardDto,
  LearningEventInput,
  LessonProgressDto,
  PageProgressDto,
  PageProgressListResponse,
  PlayerPayload,
  ResumePdfLessonResponse,
  SavePageProgressBody,
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class LearningApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/learning`;

  dashboard(): Observable<LearningDashboardDto> {
    return this.http
      .get<ApiSuccessResponse<LearningDashboardDto>>(`${this.baseUrl}/dashboard`)
      .pipe(map((r) => r.data));
  }

  myAssignments(): Observable<CourseAssignmentDto[]> {
    return this.http
      .get<ApiSuccessResponse<CourseAssignmentDto[]>>(`${this.baseUrl}/assignments`)
      .pipe(map((r) => r.data));
  }

  player(assignmentId: string): Observable<PlayerPayload> {
    return this.http
      .get<ApiSuccessResponse<PlayerPayload>>(
        `${this.baseUrl}/assignments/${assignmentId}/player`,
      )
      .pipe(map((r) => r.data));
  }

  ingestEvents(assignmentId: string, events: LearningEventInput[]) {
    return this.http
      .post<
        ApiSuccessResponse<{
          assignment: CourseAssignmentDto;
          progress: LessonProgressDto[];
        }>
      >(`${this.baseUrl}/assignments/${assignmentId}/events`, { events })
      .pipe(map((r) => r.data));
  }

  timeline(assignmentId: string) {
    return this.http
      .get<ApiSuccessResponse<unknown[]>>(
        `${this.baseUrl}/assignments/${assignmentId}/timeline`,
      )
      .pipe(map((r) => r.data));
  }

  completeLesson(assignmentId: string, lessonId: string) {
    return this.http
      .post<
        ApiSuccessResponse<{
          progress: LessonProgressDto;
          assignment: CourseAssignmentDto;
        }>
      >(
        `${this.baseUrl}/assignments/${assignmentId}/lessons/${lessonId}/complete`,
        {},
      )
      .pipe(map((r) => r.data));
  }

  getPageProgress(assignmentId: string, lessonId: string) {
    return this.http
      .get<ApiSuccessResponse<PageProgressListResponse>>(
        `${this.baseUrl}/assignments/${assignmentId}/lessons/${lessonId}/page-progress`,
      )
      .pipe(map((r) => r.data));
  }

  resumePdfLesson(assignmentId: string, lessonId: string) {
    return this.http
      .get<ApiSuccessResponse<ResumePdfLessonResponse>>(
        `${this.baseUrl}/assignments/${assignmentId}/lessons/${lessonId}/resume`,
      )
      .pipe(map((r) => r.data));
  }

  savePageProgress(
    assignmentId: string,
    lessonId: string,
    body: SavePageProgressBody,
  ) {
    return this.http
      .post<ApiSuccessResponse<PageProgressDto>>(
        `${this.baseUrl}/assignments/${assignmentId}/lessons/${lessonId}/page-progress`,
        body,
      )
      .pipe(map((r) => r.data));
  }

  completePage(assignmentId: string, lessonId: string, pageNumber: number) {
    return this.http
      .post<ApiSuccessResponse<PageProgressDto>>(
        `${this.baseUrl}/assignments/${assignmentId}/lessons/${lessonId}/pages/${pageNumber}/complete`,
        { pageNumber },
      )
      .pipe(map((r) => r.data));
  }

  applyRules(courseId: string) {
    return this.http
      .post<ApiSuccessResponse<{ created: number; rulesApplied: number }>>(
        `${environment.apiBaseUrl}/courses/${courseId}/assignments/apply-rules`,
        {},
      )
      .pipe(map((r) => r.data));
  }

  assignCourse(
    courseId: string,
    body: {
      scope: 'ALL_EMPLOYEES' | 'DEPARTMENT' | 'ROLE' | 'EMPLOYEES';
      departmentIds?: string[];
      roles?: string[];
      userIds?: string[];
      dueAt?: string | null;
      dueInDays?: number | null;
      isMandatory?: boolean;
      sendNotification?: boolean;
      notifyNewEmployees?: boolean;
    },
  ) {
    return this.http
      .post<
        ApiSuccessResponse<{
          created: number;
          assigned: number;
          completed: number;
          inProgress: number;
          notStarted: number;
        }>
      >(`${environment.apiBaseUrl}/courses/${courseId}/assignments`, body)
      .pipe(map((r) => r.data));
  }

  assignmentStats(courseId: string) {
    return this.http
      .get<
        ApiSuccessResponse<{
          assigned: number;
          completed: number;
          inProgress: number;
          notStarted: number;
        }>
      >(`${environment.apiBaseUrl}/courses/${courseId}/assignments/stats`)
      .pipe(map((r) => r.data));
  }
}
