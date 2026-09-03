import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, from, map, of } from 'rxjs';
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

  listLessons(courseId: string): Observable<LessonDto[]> {
    return this.http
      .get<ApiSuccessResponse<LessonDto[]>>(`${this.baseUrl}/${courseId}/lessons`)
      .pipe(map((r) => r.data));
  }

  createCourseLesson(courseId: string, body: Record<string, unknown>): Observable<LessonDto> {
    return this.http
      .post<ApiSuccessResponse<LessonDto>>(`${this.baseUrl}/${courseId}/lessons`, body)
      .pipe(map((r) => r.data));
  }

  reorderCourseLessons(courseId: string, items: { id: string }[]): Observable<LessonDto[]> {
    return this.http
      .post<ApiSuccessResponse<LessonDto[]>>(`${this.baseUrl}/${courseId}/lessons/reorder`, {
        items,
      })
      .pipe(map((r) => r.data));
  }

  getLesson(lessonId: string): Observable<LessonDto> {
    return this.http
      .get<ApiSuccessResponse<LessonDto>>(`${this.baseUrl}/lessons/${lessonId}`)
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

  uploadMedia(
    kind: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Observable<MediaAssetDto> {
    return from(this.uploadMediaAsync(kind, file, onProgress));
  }

  private async uploadMediaAsync(
    kind: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<MediaAssetDto> {
    const plan = await firstValueFrom(
      this.http
        .post<
          ApiSuccessResponse<{
            strategy: 'proxy' | 'direct';
            mimeType: string;
            pathname?: string;
            uploadUrl?: string;
          }>
        >(`${environment.apiBaseUrl}/media/upload-plan`, {
          kind,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        })
        .pipe(map((r) => r.data)),
    );

    if (plan.strategy !== 'direct') {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      return firstValueFrom(
        this.http
          .post<ApiSuccessResponse<MediaAssetDto>>(
            `${environment.apiBaseUrl}/media/upload`,
            form,
          )
          .pipe(map((r) => r.data)),
      );
    }

    if (!plan.pathname || !plan.uploadUrl) {
      throw new Error('Direct upload session is incomplete');
    }

    const blob = await putBlobWithProgress(plan.uploadUrl, file, plan.mimeType, onProgress);

    return firstValueFrom(
      this.http
        .post<ApiSuccessResponse<MediaAssetDto>>(
          `${environment.apiBaseUrl}/media/upload-complete`,
          {
            kind,
            originalName: file.name,
            mimeType: plan.mimeType,
            sizeBytes: file.size,
            pathname: plan.pathname,
            url: blob.url,
          },
        )
        .pipe(map((r) => r.data)),
    );
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

function putBlobWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Storage rejected the upload (${xhr.status}).`));
        return;
      }
      try {
        const body = xhr.responseText ? (JSON.parse(xhr.responseText) as { url?: string }) : {};
        if (!body.url || !/^https:\/\//i.test(body.url)) {
          reject(new Error('Storage did not return a public file URL.'));
          return;
        }
        onProgress?.(100);
        resolve({ url: body.url });
      } catch {
        reject(new Error('Storage returned an unexpected response.'));
      }
    };
    xhr.onerror = () => reject(new Error('Direct upload to storage failed.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.send(file);
  });
}
