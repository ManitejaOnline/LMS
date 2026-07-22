import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';
import type { DepartmentDto, PaginatedResult } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class DepartmentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/departments`;

  list(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Observable<PaginatedResult<DepartmentDto>> {
    return this.http
      .get<ApiSuccessResponse<PaginatedResult<DepartmentDto>>>(this.baseUrl, {
        params: Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        ),
      })
      .pipe(map((res) => res.data));
  }

  create(body: {
    name: string;
    code: string;
    description?: string;
  }): Observable<DepartmentDto> {
    return this.http
      .post<ApiSuccessResponse<DepartmentDto>>(this.baseUrl, body)
      .pipe(map((res) => res.data));
  }

  update(
    id: string,
    body: Partial<{ name: string; code: string; description: string | null }>,
  ): Observable<DepartmentDto> {
    return this.http
      .patch<ApiSuccessResponse<DepartmentDto>>(`${this.baseUrl}/${id}`, body)
      .pipe(map((res) => res.data));
  }

  remove(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.baseUrl}/${id}`,
      )
      .pipe(map((res) => res.data));
  }
}
