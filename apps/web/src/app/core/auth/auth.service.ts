import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';
import type { AuthTokensResponse, UserDto } from '../models/domain.models';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly currentUserSignal = signal<UserDto | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokens.isAuthenticated());

  login(email: string, password: string): Observable<AuthTokensResponse> {
    return this.http
      .post<ApiSuccessResponse<AuthTokensResponse>>(`${this.baseUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.tokens.setTokens(data.accessToken, data.refreshToken);
          if (data.user) {
            this.currentUserSignal.set(data.user);
          }
        }),
      );
  }

  logout(): Observable<unknown> {
    const refreshToken = this.tokens.refreshToken();
    return this.http
      .post(`${this.baseUrl}/auth/logout`, { refreshToken })
      .pipe(
        catchError(() => of(null)),
        tap(() => this.clearSession()),
      );
  }

  refresh(): Observable<AuthTokensResponse> {
    const refreshToken = this.tokens.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    return this.http
      .post<ApiSuccessResponse<AuthTokensResponse>>(`${this.baseUrl}/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        map((res) => res.data),
        tap((data) => this.tokens.setTokens(data.accessToken, data.refreshToken)),
      );
  }

  forgotPassword(email: string) {
    return this.http
      .post<ApiSuccessResponse<{ message: string; resetToken?: string }>>(
        `${this.baseUrl}/auth/forgot-password`,
        { email },
      )
      .pipe(map((res) => res.data));
  }

  resetPassword(token: string, newPassword: string) {
    return this.http
      .post<ApiSuccessResponse<{ message: string }>>(`${this.baseUrl}/auth/reset-password`, {
        token,
        newPassword,
      })
      .pipe(map((res) => res.data));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http
      .post<ApiSuccessResponse<{ message: string }>>(`${this.baseUrl}/auth/change-password`, {
        currentPassword,
        newPassword,
      })
      .pipe(map((res) => res.data));
  }

  loadProfile(): Observable<UserDto> {
    return this.http
      .get<ApiSuccessResponse<UserDto>>(`${this.baseUrl}/users/me`)
      .pipe(
        map((res) => res.data),
        tap((user) => this.currentUserSignal.set(user)),
      );
  }

  updateProfile(payload: Partial<Pick<UserDto, 'firstName' | 'lastName' | 'phone'>>) {
    return this.http
      .patch<ApiSuccessResponse<UserDto>>(`${this.baseUrl}/users/me`, payload)
      .pipe(
        map((res) => res.data),
        tap((user) => this.currentUserSignal.set(user)),
      );
  }

  clearSession(): void {
    this.tokens.clear();
    this.currentUserSignal.set(null);
    void this.router.navigateByUrl('/login');
  }

  displayName(): string {
    const user = this.currentUserSignal();
    if (!user) {
      return 'User';
    }
    return `${user.firstName} ${user.lastName}`;
  }
}
