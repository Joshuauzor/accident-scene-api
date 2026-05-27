import { Injectable, NestMiddleware, Logger, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Redis } from 'ioredis';
import { minimatch } from 'minimatch';
import RedisStore from 'rate-limit-redis';
import { AesEncryption } from '../utils/encryption';
import { configs } from '../../../config/config.env';

type RedisReply = any;

interface RateLimitConfig {
  patterns: string[];
  windowMs: number;
  max: number;
  prefix?: string;
  description?: string;
}

@Injectable()
export class CustomRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CustomRateLimitMiddleware.name);
  private readonly excludedPatterns: string[];
  private readonly exceptionPatterns: string[];
  private readonly defaultRateLimiter: ReturnType<typeof rateLimit>;
  private readonly specificRateLimiters: Map<
    string,
    { config: RateLimitConfig; limiter: ReturnType<typeof rateLimit> }
  >;
  private readonly aes_encrypt: AesEncryption;

  constructor(@Inject('REDIS_CLIENT') private readonly redis_client: Redis) {
    this.aes_encrypt = new AesEncryption(configs.ENCRYPTION_PRIVATE_KEY);
    this.redis_client.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    this.excludedPatterns = process.env.EXCLUDED_PATTERNS?.split(',') || [
      '/api/v1/users/x-user/*',
      '/api/v1/bootstrap/*',
    ];

    this.exceptionPatterns = process.env.EXCEPTION_PATTERNS?.split(',') || [
      '/api/v1/reset-password',
      '/api/v1/remove',
    ];

    // Endpoint-specific rate limit configurations
    const specific_configs: RateLimitConfig[] = [
      {
        patterns: ['/api/v1/notifications/*'],
        windowMs: 1 * 60 * 1000,
        max: 60,
        prefix: 'notifications',
        description: 'Notifications endpoints',
      },
      {
        patterns: ['/api/v1/events/*', '/api/v1/event-notifications/*'],
        windowMs: 5 * 60 * 1000,
        max: 100,
        prefix: 'events',
        description: 'Events endpoints',
      },
      {
        patterns: [
          '/api/v1/auth/*',
          '/api/v1/login',
          '/api/v1/register',
          '/api/v1/verify-otp',
        ],
        windowMs: 15 * 60 * 1000,
        max: 100,
        prefix: 'auth',
        description: 'Authentication endpoints',
      },
      {
        patterns: ['/api/v1/upload/*', '/api/v1/media/*'],
        windowMs: 10 * 60 * 1000,
        max: 30,
        prefix: 'media',
        description: 'Media/File upload endpoints',
      },
    ];

    this.specificRateLimiters = new Map();
    specific_configs.forEach((config) => {
      const limiter = this.create_rate_limiter(config);
      config.patterns.forEach((pattern) => {
        this.specificRateLimiters.set(pattern, { config, limiter });
        this.logger.log(
          `Rate limiter configured: ${pattern} - ${config.max} requests per ${
            config.windowMs / 1000
          }s`,
        );
      });
    });

    this.defaultRateLimiter = this.create_rate_limiter({
      patterns: ['*'],
      windowMs: 10 * 60 * 1000,
      max: 200,
      prefix: 'default',
      description: 'Default rate limiter',
    });

    this.logger.log('Rate limiting middleware initialized');
  }

  private create_rate_limiter(
    config: RateLimitConfig,
  ): ReturnType<typeof rateLimit> {
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      handler: this.custom_rate_limit_handler.bind(this),
      store: new RedisStore({
        prefix: `rate-limit:${config.prefix || 'default'}:`,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        sendCommand: (...args: [string, ...any[]]): Promise<RedisReply> => {
          return this.redis_client.call(
            ...args,
          ) as unknown as Promise<RedisReply>;
        },
      }),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      keyGenerator: (req: Request) => {
        const current_user = (req as any).current_user;
        if (current_user?.id) {
          return `user:${current_user.id}`;
        }

        const authorization = req.headers['authorization'];
        if (authorization && authorization.includes('Bearer')) {
          try {
            const token = authorization.split('Bearer')[1]?.trim();
            if (token) {
              const decrypted_token = this.aes_encrypt.decrypt(token);
              if (decrypted_token) {
                const user_data = JSON.parse(decrypted_token);
                if (user_data?.user?.id || user_data?.user?.email) {
                  const user_id = user_data.user.id || user_data.user.email;
                  return `user:${user_id}`;
                }
              }
            }
          } catch (error) {
            this.logger.debug(
              'Failed to extract user from token for rate limiting',
            );
          }
        }

        if (req.body && (req.body.email || req.body.phone_number)) {
          const identifier = req.body.email || req.body.phone_number;
          return `auth:${identifier}`;
        }

        const forwarded_for = req.headers['x-forwarded-for'] as string;
        const real_ip =
          forwarded_for?.split(',')[0]?.trim() ||
          (req.headers['x-real-ip'] as string) ||
          req.ip;

        const account_id = req.headers['x-api-key'] || real_ip;
        return `ip:${account_id}`;
      },
    });
  }

  use(req: Request, res: Response, next: () => void): any {
    if (this.is_excluded(req.originalUrl)) {
      this.logger.debug(`Skipping rate limit for path: ${req.originalUrl}`);
      (req as any).rateLimitPassed = false;
      return next();
    }

    (req as any).rateLimitPassed = true;

    // Find the appropriate rate limiter for this path
    const limiter = this.get_rate_limiter_for_path(req.originalUrl);

    this.logger.debug(
      `Applying rate limit for path: ${req.originalUrl} (using ${
        limiter.config?.description || 'default'
      } limiter)`,
    );

    return limiter.handler(req, res, next);
  }

  private get_rate_limiter_for_path(path: string): {
    handler: ReturnType<typeof rateLimit>;
    config?: RateLimitConfig;
  } {
    const normalized_path = this.normalize_path(path);

    // Check specific rate limiters first
    for (const [pattern, { config, limiter }] of this.specificRateLimiters) {
      if (minimatch(normalized_path, pattern, { nocase: true })) {
        return { handler: limiter, config };
      }
    }

    // Return default rate limiter if no specific match found
    return { handler: this.defaultRateLimiter };
  }

  private normalize_path(path: string): string {
    // Remove query parameters and trailing slashes
    return path.split('?')[0].replace(/\/+$/, '');
  }

  private is_excluded(path: string): boolean {
    const normalized_path = this.normalize_path(path);

    const is_exception = this.exceptionPatterns.some((exception) =>
      minimatch(normalized_path, exception, { nocase: true }),
    );

    if (is_exception) {
      return false;
    }

    return this.excludedPatterns.some((pattern) =>
      minimatch(normalized_path, pattern, { nocase: true }),
    );
  }

  private custom_rate_limit_handler(req: Request, res: Response): void {
    const current_user = (req as any).current_user;
    const identifier =
      current_user?.id ||
      current_user?.email ||
      req.headers['x-api-key'] ||
      req.ip;

    const limiter_info = this.get_rate_limiter_for_path(req.originalUrl);
    const limiter_type = limiter_info.config?.description || 'default';

    this.logger.warn(
      `Rate limit exceeded for: ${identifier} on ${req.originalUrl} (${limiter_type})`,
    );

    const response = {
      status_code: 429,
      status: 'Success',
      message: 'Too many requests, please try again later.',
      time: new Date().toISOString(),
      data: null,
      request: {
        method: req.method,
        path: req.originalUrl,
      },
    };
    res.status(429).json(response);
  }
}
