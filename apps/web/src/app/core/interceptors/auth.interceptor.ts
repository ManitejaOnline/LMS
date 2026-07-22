import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  finalize,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import type { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TokenStorageService } from '../auth/token-storage.service';
import type { AuthTokensResponse } from '../models/domain.models';

let refresh$: Observable<AuthTokensResponse> | null = null;

function isAuthBootstrapRequest(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password')
  );
}

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Attaches Bearer access token. On 401, refreshes once (shared) and retries.
 * Required for media upload after the 15m access token expires mid-authoring.
 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);

  if (isAuthBootstrapRequest(req.url)) {
    return next(req);
  }

  const token = tokenStorage.accessToken();
  const authReq = token ? withBearer(req, token) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!tokenStorage.refreshToken()) {
        auth.clearSession();
        return throwError(() => error);
      }

      if (!refresh$) {
        refresh$ = auth.refresh().pipe(
          shareReplay({ bufferSize: 1, refCount: false }),
          finalize(() => {
            refresh$ = null;
          }),
        );
      }

      return refresh$.pipe(
        switchMap((tokens) => next(withBearer(req, tokens.accessToken))),
        catchError((refreshErr) => {
          auth.clearSession();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
