import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import { SentryService } from '../../global/services/sentry/sentry.service';
import { ModuleRef } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private sentry_service: SentryService | null = null;

  constructor(private readonly module_ref?: ModuleRef) {
    if (module_ref) {
      try {
        this.sentry_service = module_ref.get(SentryService, { strict: false });
      } catch {
        this.sentry_service = null;
      }
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    const request_id =
      request.headers['x-request-id'] ||
      request.headers['x-amzn-requestid'] ||
      request.headers['x-amzn-trace-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const message = this.get_sanitized_message(exception);

    const report = this.get_internal_report(exception);

    const payload = {
      status_code: status,
      status: status < 500 ? 'Failed' : 'Error',
      message,
      data: process.env.NODE_ENV === 'production' ? undefined : report,
      time: new Date().toISOString(),
      request: {
        path: request.url,
        method: request.method,
        request_id,
      },
    };

    if (!this.sentry_service && this.module_ref) {
      try {
        this.sentry_service = this.module_ref.get(SentryService, {
          strict: false,
        });
      } catch {
        // no Sentry
      }
    }

    if (status >= 500 && this.sentry_service?.is_enabled()) {
      this.sentry_service.capture_exception(exception, {
        tags: {
          httpStatus: status,
          httpMethod: request.method,
          httpPath: request.url,
          errorType: this.get_error_type(exception),
        },
        extra: {
          requestBody: this.sanitize_request_body(request.body),
          queryParams: request.query,
          headers: this.sanitize_headers(request.headers),
          ip: request.ip,
          userAgent: request.get('user-agent'),
        },
        user: {
          id: (request as any).user?.id,
          email: (request as any).user?.email,
        },
        level: 'error',
      });
    } else if (status >= 400 && this.sentry_service?.is_enabled()) {
      this.sentry_service.add_breadcrumb({
        message: `Client error: ${status}`,
        level: 'warning',
        category: 'http',
        data: {
          method: request.method,
          path: request.url,
          status,
        },
      });
    }

    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} — ${request.method} ${request.url} — Request ID: ${request_id}`,
        JSON.stringify({
          exception: report,
          request: {
            headers: this.sanitize_headers(request.headers),
            body: this.sanitize_request_body(request.body),
            query: request.query,
            ip: request.ip,
            userAgent: request.get('user-agent'),
          },
        }),
      );
    }

    this.logger.error(`HTTP ${status} — ${request.method} ${request.url}`);
    if (process.env.NODE_ENV !== 'production') {
      this.logger.error(exception);
    }

    response.setHeader('X-Request-ID', request_id);
    response.status(status).json(payload);
  }

  private get_error_type(exception: unknown): string {
    if (exception instanceof HttpException) return 'HttpException';
    if ((exception as AxiosError).isAxiosError) return 'AxiosError';
    if (exception instanceof Error) return exception.constructor.name;
    return 'UnknownError';
  }

  private sanitize_headers(headers: any): Record<string, any> {
    const sensitive = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-access-token',
    ];
    const sanitized: Record<string, any> = {};

    Object.keys(headers).forEach((key) => {
      const lower_key = key.toLowerCase();
      if (sensitive.some((s) => lower_key.includes(s.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = headers[key];
      }
    });

    return sanitized;
  }

  private sanitize_request_body(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitive = [
      'password',
      'passcode',
      'pin',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'creditCard',
      'credit_card',
      'cvv',
      'ssn',
    ];

    const sanitize_object = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj;
      }

      const sanitized: any = {};
      for (const key in obj) {
        const lower_key = key.toLowerCase();
        if (sensitive.some((s) => lower_key.includes(s.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = sanitize_object(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
      return sanitized;
    };

    return sanitize_object(body);
  }

  private get_sanitized_message(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      let msg = '';

      if (typeof response === 'string') {
        msg = response
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (typeof response === 'object') {
        msg = (response as any).message || (response as any).error || '';
        if (Array.isArray(msg)) {
          msg = msg[0];
        }
      }

      return (
        msg ||
        '🔴 Aha! A tiny tangle. Hang tight and give it another go in a bit 😊'
      );
    }

    if ((exception as AxiosError).isAxiosError) {
      const axios_err = exception as AxiosError;
      if (axios_err.response?.data) {
        const data = axios_err.response.data;
        if (typeof data === 'string') {
          return data.replace(/<[^>]*>/g, '').slice(0, 200);
        }
        if (typeof data === 'object' && 'message' in data) {
          return (data as any).message;
        }
      }
      return '🔴 Aha! A tiny tangle. Hang tight and give it another go in a moment 😊';
    }

    if (exception instanceof Error) {
      return (
        exception?.message ||
        '🔴 Oops, a minor hiccup. Give it a moment and try again 😊'
      );
    }

    return '🔴 Apologies -- We encountered a little glitch and are working to resolve it 😊';
  }

  private get_internal_report(exception: unknown): any {
    if (exception instanceof HttpException) {
      return exception.getResponse();
    } else if ((exception as AxiosError).isAxiosError) {
      const { code, config, response } = exception as AxiosError;
      return {
        code,
        url: config?.url,
        method: config?.method,
        status: response?.status,
        data: response?.data,
      };
    } else if (exception instanceof Error) {
      return {
        message: exception.message,
        stack: exception.stack,
      };
    }
    return exception;
  }
}
