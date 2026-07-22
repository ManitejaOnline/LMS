import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ApiErrorResponse } from '@zebl/shared';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../constants/metadata.keys';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.resolveStatus(exception);
    const { code, message, details } = this.resolveBody(exception);
    const requestId = this.resolveRequestId(request);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, requestId, path: request.url },
        'Unhandled exception',
      );
    } else {
      this.logger.warn(
        { err: exception, requestId, path: request.url, status },
        'Handled exception',
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    response.status(status).json(body);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveBody(exception: unknown): {
    code: string;
    message: string;
    details?: ApiErrorResponse['error']['details'];
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          code: this.statusToCode(exception.getStatus()),
          message: response,
        };
      }

      const payload = response as Record<string, unknown>;
      const message = this.normalizeMessage(payload.message) ?? exception.message;
      const details = Array.isArray(payload.message)
        ? (payload.message as string[]).map((item) => ({ message: item }))
        : undefined;

      return {
        code:
          typeof payload.error === 'string'
            ? payload.error.toUpperCase().replace(/\s+/g, '_')
            : this.statusToCode(exception.getStatus()),
        message,
        details,
      };
    }

    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private normalizeMessage(message: unknown): string | undefined {
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return 'Validation failed';
    }
    return undefined;
  }

  private statusToCode(status: number): string {
    return HttpStatus[status] ?? `HTTP_${status}`;
  }

  private resolveRequestId(request: Request): string | undefined {
    const header = request.headers[REQUEST_ID_HEADER];
    if (typeof header === 'string') {
      return header;
    }
    if (Array.isArray(header)) {
      return header[0];
    }
    return undefined;
  }
}
