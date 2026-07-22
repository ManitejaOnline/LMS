import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`)
      .pipe(map((response) => response.data));
  }

  post<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .post<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((response) => response.data));
  }

  put<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .put<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((response) => response.data));
  }

  patch<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .patch<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((response) => response.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiSuccessResponse<T>>(`${this.baseUrl}${path}`)
      .pipe(map((response) => response.data));
  }
}
