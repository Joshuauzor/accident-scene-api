import * as Sentry from '@sentry/nestjs';
import * as dotenv from 'dotenv';

dotenv.config();

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || NODE_ENV;
const SENTRY_RELEASE =
  process.env.SENTRY_RELEASE || process.env.npm_package_version;
const SENTRY_DEBUG = process.env.SENTRY_DEBUG;
const SENTRY_TRACES_SAMPLE_RATE = process.env.SENTRY_TRACES_SAMPLE_RATE;

// Suppress Sentry's verbose console logging
// Override the logger to prevent "Flushing client reports" spam
if (NODE_ENV !== 'production') {
  const sentry_logger = console;
  const original_log = sentry_logger.log;
  const original_debug = sentry_logger.debug;

  sentry_logger.log = function (...args: any[]) {
    // Filter out Sentry's verbose logs
    const message = args.join(' ');
    if (
      message.includes('Sentry Logger') ||
      message.includes('Flushing') ||
      message.includes('@sentry') ||
      message.includes('@opentelemetry')
    ) {
      return; // Suppress
    }
    return original_log.apply(console, args);
  };

  sentry_logger.debug = function (...args: any[]) {
    const message = args.join(' ');
    if (
      message.includes('Sentry Logger') ||
      message.includes('Flushing') ||
      message.includes('@sentry') ||
      message.includes('@opentelemetry')
    ) {
      return; // Suppress
    }
    return original_debug.apply(console, args);
  };
}

// Only initialize if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,

    // Performance monitoring
    tracesSampleRate:
      NODE_ENV === 'production'
        ? SENTRY_TRACES_SAMPLE_RATE
          ? parseFloat(SENTRY_TRACES_SAMPLE_RATE)
          : 0.1
        : 1.0,

    profilesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
      Sentry.httpIntegration({ trackIncomingRequestsAsSessions: false }),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],

    // Filter out noise
    ignoreErrors: [
      'ValidationError',
      'UnauthorizedError',
      'ForbiddenError',
      'NotFoundError',
      'BadRequestError',
    ],

    // Sanitize sensitive data (add your sanitize logic here)
    beforeSend: (event) => {
      event = sanitize_event(event);
      return event;
    },

    // Callback after event is sent
    beforeSendTransaction: (transaction) => {
      return transaction;
    },

    // Debug mode - only in development with explicit flag
    debug: NODE_ENV !== 'production' && SENTRY_DEBUG === 'true',
  });
}

const sanitize_event = (event: any): any => {
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
    event.request.data = sanitize_object(event.request.data);
  }

  return event;
};

/**
 * Recursively sanitize object, removing sensitive fields
 */
const sanitize_object = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize_object(item));
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
      sensitive_fields.some((field) => lower_key.includes(field.toLowerCase()))
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitize_object(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
};
