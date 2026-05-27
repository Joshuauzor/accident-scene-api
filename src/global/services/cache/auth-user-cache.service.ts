import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EmailUtils } from 'src/shared/utils/email.utils';

const REQUIRED_AUTH_FIELDS = [
  'id',
  'email',
  'account_status',
  'is_active',
] as const;

const DEFAULT_TTL_SECONDS = 120;

const KEY_PREFIX = 'auth:user:v1';

export type CachedAuthUser = Record<string, unknown>;

export interface AuthUserCacheInvalidateOptions {
  email?: string;
  previous_email?: string;
  user_id?: string;
}

@Injectable()
export class AuthUserCacheService {
  private readonly logger = new Logger(AuthUserCacheService.name);
  private readonly ttl_seconds: number;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    const parsed = parseInt(process.env.AUTH_USER_CACHE_TTL_SECONDS || '', 10);
    this.ttl_seconds =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SECONDS;
  }

  private email_key(normalized_email: string): string {
    return `${KEY_PREFIX}:email:${normalized_email}`;
  }

  private id_ref_key(user_id: string): string {
    return `${KEY_PREFIX}:id_ref:${user_id}`;
  }

  async get_or_load(
    email: string,
    loader: () => Promise<unknown | null>,
    options?: { skip_cache?: boolean },
  ): Promise<CachedAuthUser | null> {
    const normalized_email = EmailUtils.normalize_email(email);
    if (!normalized_email || options?.skip_cache) {
      return this.to_cacheable_user(await loader());
    }

    const email_key = this.email_key(normalized_email);

    try {
      const cached = await this.redis.get(email_key);
      if (cached) {
        const parsed = this.parse_entry(cached);
        if (parsed) {
          return parsed;
        }
        await this.redis.del(email_key);
      }
    } catch (error) {
      this.logger.warn(
        `Auth user cache read failed for ${normalized_email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const user = await loader();
    const cacheable = this.to_cacheable_user(user);
    if (!cacheable) {
      return null;
    }

    void this.set(normalized_email, cacheable);
    return cacheable;
  }

  async set(normalized_email: string, user: CachedAuthUser): Promise<void> {
    const safe_user = this.strip_sensitive_fields(user);
    if (!this.is_valid_entry(safe_user)) {
      return;
    }

    const user_id = safe_user.id as string;
    const payload = JSON.stringify(safe_user);

    try {
      const email_key = this.email_key(normalized_email);
      await this.redis.set(email_key, payload, 'EX', this.ttl_seconds);
      await this.redis.set(
        this.id_ref_key(user_id),
        normalized_email,
        'EX',
        this.ttl_seconds,
      );
    } catch (error) {
      this.logger.warn(
        `Auth user cache write failed for ${normalized_email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async invalidate(options: AuthUserCacheInvalidateOptions): Promise<void> {
    const emails = new Set<string>();

    for (const raw of [options.email, options.previous_email]) {
      if (!raw) continue;
      const normalized = EmailUtils.normalize_email(raw);
      if (normalized) emails.add(normalized);
    }

    if (options.user_id) {
      try {
        const ref = await this.redis.get(this.id_ref_key(options.user_id));
        if (ref) {
          emails.add(ref);
        }
      } catch (error) {
        this.logger.warn(
          `Auth user cache id ref lookup failed for ${options.user_id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const keys: string[] = [];
    for (const email of emails) {
      keys.push(this.email_key(email));
    }
    if (options.user_id) {
      keys.push(this.id_ref_key(options.user_id));
    }

    if (keys.length === 0) {
      return;
    }

    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn(
        `Auth user cache invalidation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private parse_entry(raw: string): CachedAuthUser | null {
    try {
      const parsed = JSON.parse(raw) as CachedAuthUser;
      return this.is_valid_entry(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private is_valid_entry(user: CachedAuthUser | null): user is CachedAuthUser {
    if (!user || typeof user !== 'object') {
      return false;
    }
    return REQUIRED_AUTH_FIELDS.every(
      (field) => user[field] !== undefined && user[field] !== null,
    );
  }

  private to_cacheable_user(user: unknown): CachedAuthUser | null {
    if (!user) {
      return null;
    }
    const plain =
      typeof (user as { get?: (opts: { plain: boolean }) => unknown }).get ===
      'function'
        ? (user as { get: (opts: { plain: boolean }) => CachedAuthUser }).get({
            plain: true,
          })
        : (user as CachedAuthUser);
    const safe = this.strip_sensitive_fields(plain);
    return this.is_valid_entry(safe) ? safe : null;
  }

  private strip_sensitive_fields(user: CachedAuthUser): CachedAuthUser {
    const { password: _password, ...rest } = user;
    return { ...rest };
  }
}
