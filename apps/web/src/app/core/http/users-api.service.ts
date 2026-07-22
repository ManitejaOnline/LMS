import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';
import type {
  AppRole,
  PaginatedResult,
  UserDto,
  UserStatus,
} from '../models/domain.models';

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: AppRole | '';
  status?: UserStatus | '';
  departmentId?: string;
  managerId?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  list(params: ListUsersParams): Observable<PaginatedResult<UserDto>> {
    return this.http
      .get<ApiSuccessResponse<PaginatedResult<UserDto>>>(this.baseUrl, {
        params: this.cleanParams(params),
      })
      .pipe(map((res) => res.data));
  }

  get(id: string): Observable<UserDto> {
    return this.http
      .get<ApiSuccessResponse<UserDto>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(body: Record<string, unknown>): Observable<UserDto> {
    return this.http
      .post<ApiSuccessResponse<UserDto>>(this.baseUrl, body)
      .pipe(map((res) => res.data));
  }

  update(id: string, body: Record<string, unknown>): Observable<UserDto> {
    return this.http
      .patch<ApiSuccessResponse<UserDto>>(`${this.baseUrl}/${id}`, body)
      .pipe(map((res) => res.data));
  }

  remove(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.baseUrl}/${id}`,
      )
      .pipe(map((res) => res.data));
  }

  private cleanParams(params: ListUsersParams): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result[key] = value as string | number;
      }
    });
    return result;
  }
}
