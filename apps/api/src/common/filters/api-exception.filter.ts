import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<{ requestId?: string }>();
    const requestId = request.requestId ?? randomUUID();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'An unexpected error occurred.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      const body =
        typeof response === 'string'
          ? { message: response }
          : (response as { message?: string | string[]; code?: string });
      code =
        body.code ??
        {
          400: 'VALIDATION_ERROR',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          429: 'RATE_LIMITED',
          503: 'UNAVAILABLE',
        }[status] ??
        'REQUEST_FAILED';
      message = body.message ?? error.message;
    } else if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002' || error.code === 'P2003') {
        status = 409;
        code = 'CONFLICT';
        message = 'This operation conflicts with an existing record.';
      } else if (error.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'The requested record was not found.';
      }
    }
    if (status >= 500) {
      this.logger.error({ requestId, status, code });
      if (Sentry.isInitialized()) Sentry.captureException(error, { tags: { requestId, code } });
    }
    this.adapterHost.httpAdapter.reply(http.getResponse(), { code, message, requestId }, status);
  }
}
