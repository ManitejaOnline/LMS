import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';
import type {
  AssignmentRuleDto,
  CourseDashboardStats,
  CourseDto,
  CourseModuleDto,
  CourseStatus,
  LessonDto,
  MediaAssetDto,
  PaginatedResult,
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class CoursesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/courses`;

  dashboardStats(): Observable<CourseDashboardStats> {
    return this.http
      .get<ApiSuccessResponse<CourseDashboardStats>>(`${this.baseUrl}/dashboard/stats`)
      .pipe(map((r) => r.data));
  }

  list(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: CourseStatus | '';
  }): Observable<PaginatedResult<CourseDto>> {
    return this.http
      .get<ApiSuccessResponse<PaginatedResult<CourseDto>>>(this.baseUrl, {
        params: this.clean(params),
      })
      .pipe(map((r) => r.data));
  }

  get(id: string): Observable<CourseDto> {
    return this.http
      .get<ApiSuccessResponse<CourseDto>>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(body: Record<string, unknown>): Observable<CourseDto> {
    return this.http
      .post<ApiSuccessResponse<CourseDto>>(this.baseUrl, body)
      .pipe(map((r) => r.data));
  }

  update(id: string, body: Record<string, unknown>): Observable<CourseDto> {
    return this.http
      .patch<ApiSuccessResponse<CourseDto>>(`${this.baseUrl}/${id}`, body)
      .pipe(map((r) => r.data));
  }

  updateStatus(id: string, status: CourseStatus): Observable<CourseDto> {
    return this.http
      .patch<ApiSuccessResponse<CourseDto>>(`${this.baseUrl}/${id}/status`, { status })
      .pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  createModule(courseId: string, body: Record<string, unknown>): Observable<CourseModuleDto> {
    return this.http
      .post<ApiSuccessResponse<CourseModuleDto>>(`${this.baseUrl}/${courseId}/modules`, body)
      .pipe(map((r) => r.data));
  }

  updateModule(moduleId: string, body: Record<string, unknown>): Observable<CourseModuleDto> {
    return this.http
      .patch<ApiSuccessResponse<CourseModuleDto>>(`${this.baseUrl}/modules/${moduleId}`, body)
      .pipe(map((r) => r.data));
  }

  reorderModules(courseId: string, items: { id: string }[]): Observable<CourseDto> {
    return this.http
      .post<ApiSuccessResponse<CourseDto>>(`${this.baseUrl}/${courseId}/modules/reorder`, {
        items,
      })
      .pipe(map((r) => r.data));
  }

  deleteModule(moduleId: string) {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.baseUrl}/modules/${moduleId}`,
      )
      .pipe(map((r) => r.data));
  }

  createLesson(moduleId: string, body: Record<string, unknown>): Observable<LessonDto> {
    const mediaId = body['contentMediaId'];
    if (mediaId !== undefined && mediaId !== null) {
      if (typeof mediaId !== 'string' || !/^c[a-z0-9]{24,32}$/i.test(mediaId.trim())) {
        throw new Error(
          `Refusing to create lesson: contentMediaId must be a media entity id, got ${JSON.stringify(mediaId)}`,
        );
      }
    }
    return this.http
      .post<ApiSuccessResponse<LessonDto>>(
        `${this.baseUrl}/modules/${moduleId}/lessons`,
        body,
      )
      .pipe(map((r) => r.data));
  }

  updateLesson(lessonId: string, body: Record<string, unknown>): Observable<LessonDto> {
    return this.http
      .patch<ApiSuccessResponse<LessonDto>>(`${this.baseUrl}/lessons/${lessonId}`, body)
      .pipe(map((r) => r.data));
  }

  reorderLessons(moduleId: string, items: { id: string }[]): Observable<LessonDto[]> {
    if (!items.length) {
      return of([]);
    }
    return this.http
      .post<ApiSuccessResponse<LessonDto[]>>(
        `${this.baseUrl}/modules/${moduleId}/lessons/reorder`,
        { items },
      )
      .pipe(map((r) => r.data));
  }

  deleteLesson(lessonId: string) {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.baseUrl}/lessons/${lessonId}`,
      )
      .pipe(map((r) => r.data));
  }

  createRule(courseId: string, body: Record<string, unknown>): Observable<AssignmentRuleDto> {
    return this.http
      .post<ApiSuccessResponse<AssignmentRuleDto>>(
        `${this.baseUrl}/${courseId}/assignment-rules`,
        body,
      )
      .pipe(map((r) => r.data));
  }

  updateRule(ruleId: string, body: Record<string, unknown>): Observable<AssignmentRuleDto> {
    return this.http
      .patch<ApiSuccessResponse<AssignmentRuleDto>>(
        `${this.baseUrl}/assignment-rules/${ruleId}`,
        body,
      )
      .pipe(map((r) => r.data));
  }

  deleteRule(ruleId: string) {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.baseUrl}/assignment-rules/${ruleId}`,
      )
      .pipe(map((r) => r.data));
  }

  uploadMedia(kind: string, file: File): Observable<MediaAssetDto> {
    const form = new FormData();
    // Fastify multipart only exposes fields that appear *before* the file
    // when using request.file(); put kind first so auth'd uploads parse kind.
    form.append('kind', kind);
    form.append('file', file);
    return this.http
      .post<ApiSuccessResponse<MediaAssetDto>>(`${environment.apiBaseUrl}/media/upload`, form)
      .pipe(map((r) => r.data));
  }

  private clean(params: Record<string, unknown>): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result[key] = value as string | number;
      }
    });
    return result;
  }
}
