import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ApiErrorResponse } from '../models/api-response.model';

/** Normalizes API error payloads for feature layers. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const apiError = error.error as ApiErrorResponse | undefined;
        const message =
          apiError?.error?.message ??
          error.message ??
          'Unexpected network or server error';

        return throwError(
          () =>
            new HttpErrorResponse({
              error: apiError ?? {
                success: false,
                error: { code: 'HTTP_ERROR', message },
                timestamp: new Date().toISOString(),
              },
              headers: error.headers,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined,
            }),
        );
      }

      return throwError(() => error);
    }),
  );
};
