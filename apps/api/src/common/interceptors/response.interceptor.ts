import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '@zebl/shared';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants/metadata.keys';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestIdHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : requestIdHeader;

    return next.handle().pipe(
      map((data) => {
        if (this.isAlreadyEnveloped(data)) {
          return data as ApiSuccessResponse<T>;
        }

        return {
          success: true as const,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId,
        };
      }),
    );
  }

  private isAlreadyEnveloped(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      (data as { success: unknown }).success === true &&
      'data' in data
    );
  }
}
