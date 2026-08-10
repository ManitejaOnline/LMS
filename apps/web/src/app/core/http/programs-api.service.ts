import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';
import type {
  LearnerLevelDetail,
  ProgramCertificate,
  ProgramDetail,
  ProgramListItem,
  ProgramProgressView,
} from '../models/program.models';

@Injectable({ providedIn: 'root' })
export class ProgramsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  list(): Observable<ProgramListItem[]> {
    return this.http
      .get<ApiSuccessResponse<ProgramListItem[]>>(`${this.baseUrl}/programs`)
      .pipe(map((r) => r.data));
  }

  get(id: string): Observable<ProgramDetail> {
    return this.http
      .get<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/programs/${id}`)
      .pipe(map((r) => r.data));
  }

  create(body: { name: string; description?: string }): Observable<ProgramDetail> {
    return this.http
      .post<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/programs`, body)
      .pipe(map((r) => r.data));
  }

  update(id: string, body: { name?: string; description?: string | null }): Observable<ProgramDetail> {
    return this.http
      .patch<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/programs/${id}`, body)
      .pipe(map((r) => r.data));
  }

  updateStatus(id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'): Observable<ProgramDetail> {
    return this.http
      .patch<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/programs/${id}/status`, { status })
      .pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(`${this.baseUrl}/programs/${id}`)
      .pipe(map((r) => r.data));
  }

  createLevel(programId: string, body: { title: string; description?: string; isFinal?: boolean }) {
    return this.http
      .post<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/programs/${programId}/levels`, body)
      .pipe(map((r) => r.data));
  }

  updateLevel(levelId: string, body: { title?: string; description?: string | null; isFinal?: boolean }) {
    return this.http
      .patch<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/levels/${levelId}`, body)
      .pipe(map((r) => r.data));
  }

  deleteLevel(levelId: string) {
    return this.http
      .delete<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/levels/${levelId}`)
      .pipe(map((r) => r.data));
  }

  reorderLevels(programId: string, items: { id: string }[]) {
    return this.http
      .post<ApiSuccessResponse<ProgramDetail>>(
        `${this.baseUrl}/programs/${programId}/levels/reorder`,
        { items },
      )
      .pipe(map((r) => r.data));
  }

  addCourses(levelId: string, courseIds: string[]) {
    return this.http
      .post<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/levels/${levelId}/courses`, {
        courseIds,
      })
      .pipe(map((r) => r.data));
  }

  updateLevelCourse(levelCourseId: string, isRequired: boolean) {
    return this.http
      .patch<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/level-courses/${levelCourseId}`, {
        isRequired,
      })
      .pipe(map((r) => r.data));
  }

  removeLevelCourse(levelCourseId: string) {
    return this.http
      .delete<ApiSuccessResponse<ProgramDetail>>(`${this.baseUrl}/level-courses/${levelCourseId}`)
      .pipe(map((r) => r.data));
  }

  reorderLevelCourses(levelId: string, items: { id: string }[]) {
    return this.http
      .post<ApiSuccessResponse<ProgramDetail>>(
        `${this.baseUrl}/levels/${levelId}/courses/reorder`,
        { items },
      )
      .pipe(map((r) => r.data));
  }

  assign(
    programId: string,
    body: {
      scope: 'ALL_EMPLOYEES' | 'DEPARTMENT' | 'ROLE' | 'EMPLOYEES';
      departmentIds?: string[];
      roles?: string[];
      userIds?: string[];
      sendNotification?: boolean;
    },
  ) {
    return this.http
      .post<ApiSuccessResponse<{ created: number; assigned: number }>>(
        `${this.baseUrl}/programs/${programId}/assignments`,
        body,
      )
      .pipe(map((r) => r.data));
  }

  myPrograms(): Observable<ProgramProgressView[]> {
    return this.http
      .get<ApiSuccessResponse<ProgramProgressView[]>>(`${this.baseUrl}/learner/programs`)
      .pipe(map((r) => r.data));
  }

  myProgram(programId: string): Observable<ProgramProgressView> {
    return this.http
      .get<ApiSuccessResponse<ProgramProgressView>>(`${this.baseUrl}/learner/programs/${programId}`)
      .pipe(map((r) => r.data));
  }

  myLevel(programId: string, levelId: string): Observable<LearnerLevelDetail> {
    return this.http
      .get<ApiSuccessResponse<LearnerLevelDetail>>(
        `${this.baseUrl}/learner/programs/${programId}/levels/${levelId}`,
      )
      .pipe(map((r) => r.data));
  }

  certificate(programId: string): Observable<ProgramCertificate> {
    return this.http
      .get<ApiSuccessResponse<ProgramCertificate>>(
        `${this.baseUrl}/learner/programs/${programId}/certificate`,
      )
      .pipe(map((r) => r.data));
  }

  certificateHtml(programId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/learner/programs/${programId}/certificate.html`, {
      responseType: 'blob',
    });
  }
}
