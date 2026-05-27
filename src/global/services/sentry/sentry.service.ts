import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { configs } from 'config/config.env';
import * as Sentry from '@sentry/node';
// import { Context } from 'aws-lambda';

/**
 * Sentry Service - Production-ready error tracking and performance monitoring
 * Works seamlessly in both Lambda and regular NestJS environments
 */
@Injectable()
export class SentryService implements OnModuleInit {
  private readonly logger = new Logger(SentryService.name);
  private is_initialized = false;

  /**
   * Initialize Sentry on module init
   * This runs automatically when the module loads
   * Note: Sentry may already be initialized in bootstrap files, this is idempotent
   */
  async onModuleInit(): Promise<void> {
    if (this.should_initialize()) {
      this.initialize();
    } else {
      // Check if Sentry was already initialized elsewhere (e.g., in bootstrap)
      if (configs.SENTRY_DSN && Sentry.isInitialized()) {
        this.is_initialized = true;
        this.logger.debug('Sentry already initialized (likely in bootstrap)');
      } else {
        this.logger.debug('Sentry not initialized - SENTRY_DSN not configured');
      }
    }
  }

  /**
   * Check if Sentry should be initialized
   */
  private should_initialize(): boolean {
    // Don't initialize if already initialized or if Sentry client already exists
    if (this.is_initialized || Sentry.isInitialized()) {
      return false;
    }
    return !!configs.SENTRY_DSN;
  }

  /**
   * Initialize Sentry with production-ready configuration
   */
  private initialize(): void {
    try {
      Sentry.init({
        dsn: configs.SENTRY_DSN,
        environment:
          configs.SENTRY_ENVIRONMENT || configs.NODE_ENV || 'development',
        release: configs.SENTRY_RELEASE,

        // Performance monitoring
        tracesSampleRate: this.get_traces_sample_rate(),
        profilesSampleRate: configs.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Integrations
        integrations: [
          Sentry.httpIntegration({ trackIncomingRequestsAsSessions: true }),
          Sentry.onUncaughtExceptionIntegration({
            exitEvenIfOtherHandlersAreRegistered: false,
          }),
          Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
          Sentry.httpIntegration({ trackIncomingRequestsAsSessions: false }),
        ],

        // Filter out noise
        ignoreErrors: [
          'ValidationError',
          'UnauthorizedError',
          'ForbiddenError',
          'NotFoundError',
          'BadRequestError',
        ],

        // Sanitize sensitive data
        beforeSend: (event, hint) => this.sanitize_event(event, hint),

        // Debug mode - disabled in production
        debug:
          configs.NODE_ENV !== 'production' && configs.SENTRY_DEBUG === 'true',
      });

      this.is_initialized = true;
      this.logger.log(
        `Sentry initialized for environment: ${
          configs.SENTRY_ENVIRONMENT || configs.NODE_ENV
        }`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Sentry', error);
    }
  }

  /**
   * Get traces sample rate based on environment
   */
  private get_traces_sample_rate(): number {
    if (configs.NODE_ENV === 'production') {
      return configs.SENTRY_TRACES_SAMPLE_RATE
        ? parseFloat(configs.SENTRY_TRACES_SAMPLE_RATE)
        : 0.1; // 10% in production
    }
    return 1.0; // 100% in development/staging
  }

  /**
   * Sanitize sensitive data from events
   */
  private sanitize_event(event: any, hint: any): any {
    // Remove sensitive headers
    if (event.request?.headers) {
      const sensitive_headers = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
        'x-access-token',
        'x-csrf-token',
      ];

      sensitive_headers.forEach((header) => {
        Object.keys(event.request.headers).forEach((key) => {
          if (key.toLowerCase() === header.toLowerCase()) {
            event.request.headers[key] = '[REDACTED]';
          }
        });
      });
    }

    // Remove sensitive cookies
    if (event.request?.cookies) {
      event.request.cookies = '[REDACTED]';
    }

    // Sanitize request body
    if (event.request?.data) {
      event.request.data = this.sanitize_object(event.request.data);
    }

    return event;
  }

  /**
   * Recursively sanitize object, removing sensitive fields
   */
  private sanitize_object(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize_object(item));
    }

    const sensitive_fields = [
      'password',
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
      'privateKey',
      'private_key',
    ];

    const sanitized: any = {};
    for (const key in obj) {
      const lower_key = key.toLowerCase();
      if (
        sensitive_fields.some((field) =>
          lower_key.includes(field.toLowerCase()),
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = this.sanitize_object(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }

    return sanitized;
  }

  /**
   * Capture exception
   */
  capture_exception(exception: unknown, context?: Record<string, any>): string {
    if (!this.is_initialized) {
      return '';
    }

    try {
      const event_id = Sentry.captureException(exception, {
        tags: context?.tags,
        extra: context?.extra,
        user: context?.user,
        level: context?.level || 'error',
      });
      return event_id;
    } catch (error) {
      this.logger.error('Failed to capture exception to Sentry', error);
      return '';
    }
  }

  /**
   * Capture message
   */
  capture_message(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: Record<string, any>,
  ): string {
    if (!this.is_initialized) {
      return '';
    }

    try {
      const event_id = Sentry.captureMessage(message, {
        level,
        tags: context?.tags,
        extra: context?.extra,
      });
      return event_id;
    } catch (error) {
      this.logger.error('Failed to capture message to Sentry', error);
      return '';
    }
  }

  /**
   * Add breadcrumb
   */
  add_breadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.is_initialized) {
      return;
    }

    try {
      Sentry.addBreadcrumb(breadcrumb);
    } catch (error) {
      this.logger.error('Failed to add breadcrumb to Sentry', error);
    }
  }

  /**
   * Set user context
   */
  set_user(user: Sentry.User | null): void {
    if (!this.is_initialized) {
      return;
    }

    try {
      Sentry.setUser(user);
    } catch (error) {
      this.logger.error('Failed to set user context in Sentry', error);
    }
  }

  /**
   * Set custom context
   */
  set_context(name: string, context: Record<string, any>): void {
    if (!this.is_initialized) {
      return;
    }

    try {
      Sentry.setContext(name, context);
    } catch (error) {
      this.logger.error('Failed to set context in Sentry', error);
    }
  }

  /**
   * Set tag
   */
  set_tag(key: string, value: string): void {
    if (!this.is_initialized) {
      return;
    }

    try {
      Sentry.setTag(key, value);
    } catch (error) {
      this.logger.error('Failed to set tag in Sentry', error);
    }
  }

  /**
   * Check if Sentry is initialized
   */
  is_enabled(): boolean {
    return this.is_initialized;
  }

  /**
   * Get Sentry instance (for advanced usage)
   */
  get_client(): typeof Sentry | null {
    return this.is_initialized ? Sentry : null;
  }
}
