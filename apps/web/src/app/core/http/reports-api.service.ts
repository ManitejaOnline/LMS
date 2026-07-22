import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/reports`;

  private get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiSuccessResponse<T>>(`${this.base}${path}`)
      .pipe(map((r) => r.data));
  }

  adminDashboard() {
    return this.get<Record<string, number>>('/admin-dashboard');
  }

  managerDashboard() {
    return this.get<Record<string, unknown>>('/manager-dashboard');
  }

  courseCompletion() {
    return this.get<
      Array<{
        courseId: string;
        title: string;
        code: string;
        assigned: number;
        completed: number;
        completionRate: number;
      }>
    >('/course-completion');
  }

  employeeProgress() {
    return this.get<unknown[]>('/employee-progress');
  }

  readingTime() {
    return this.get<unknown[]>('/reading-time');
  }

  videoAnalytics() {
    return this.get<unknown[]>('/video-analytics');
  }

  quizAnalytics() {
    return this.get<unknown[]>('/quiz-analytics');
  }

  auditLogs(page = 1, pageSize = 20) {
    return this.get<{ items: unknown[]; meta: Record<string, number> }>(
      `/audit-logs?page=${page}&pageSize=${pageSize}`,
    );
  }
}
