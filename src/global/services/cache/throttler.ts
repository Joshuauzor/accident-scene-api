import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';

/**
 * Lock types for different scenarios
 */
export enum LockType {
  USER = 'u', // User-level lock
  RESOURCE = 'r', // Resource-level lock
  COMPOSITE = 'c', // Composite lock (user + resource)
}

/**
 * Simplified lock options
 */
export interface LockOptions {
  type?: LockType;
  operation?: string;
  resource_id?: string;
  user_id?: string;
  ttl?: number;
  max_retries?: number;
  retry_delay?: number;
}

/**
 * Lock result
 */
export interface LockResult {
  acquired: boolean;
  lock_key: string;
  lock_value?: string;
  error?: string;
}

/**
 * Optimized Throttler Service
 * Performance-focused with simplified API
 */
@Injectable()
export class ThrottlerService {
  private readonly logger = new Logger(ThrottlerService.name);
  private readonly default_ttl = 30000; // 30 seconds
  private readonly default_max_retries = 3;
  private readonly default_retry_delay = 100; // 100ms
  // Limited in-memory cache (only for active locks, auto-cleaned)
  private readonly active_locks = new Map<string, string>();
  private readonly max_memory_locks = 1000; // Prevent memory leaks

  // Pre-compiled Lua script for atomic lock release
  private readonly release_script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Generate optimized lock key (shortened for performance)
   */
  private generate_key(options: LockOptions): string {
    const op = options.operation || 'tx';
    const type = options.type || LockType.USER;

    switch (type) {
      case LockType.USER:
        if (!options.user_id) {
          throw new Error('user_id required for USER lock');
        }
        return `l:${op}:u:${options.user_id}`;

      case LockType.RESOURCE:
        if (!options.resource_id) {
          throw new Error('resource_id required for RESOURCE lock');
        }
        return `l:${op}:r:${options.resource_id}`;

      case LockType.COMPOSITE:
        if (!options.user_id || !options.resource_id) {
          throw new Error(
            'user_id and resource_id required for COMPOSITE lock',
          );
        }
        return `l:${op}:c:${options.user_id}:${options.resource_id}`;

      default:
        throw new Error(`Invalid lock type: ${type}`);
    }
  }

  /**
   * Acquire lock with optimized performance
   */
  async acquire_lock_flexible(options: LockOptions): Promise<LockResult> {
    const lock_key = this.generate_key(options);
    const lock_value = randomBytes(8).toString('hex');
    const ttl = options.ttl || this.default_ttl;
    const max_retries = options.max_retries || this.default_max_retries;
    const retry_delay = options.retry_delay || this.default_retry_delay;

    for (let attempt = 1; attempt <= max_retries; attempt++) {
      try {
        const result = await this.redis.set(
          lock_key,
          lock_value,
          'PX',
          ttl,
          'NX',
        );

        if (result === 'OK') {
          // Always store lock_value (evict oldest if at limit)
          if (this.active_locks.size >= this.max_memory_locks) {
            // Remove oldest entry (FIFO)
            const first_key = this.active_locks.keys().next().value;
            if (first_key) {
              this.active_locks.delete(first_key);
            }
          }
          this.active_locks.set(lock_key, lock_value);
          return {
            acquired: true,
            lock_key,
            lock_value,
          };
        }

        if (attempt < max_retries) {
          await this.delay(retry_delay);
        }
      } catch (error) {
        if (attempt === max_retries) {
          return {
            acquired: false,
            lock_key,
            error: `Lock acquisition failed: ${error.message}`,
          };
        }
        await this.delay(retry_delay);
      }
    }

    return {
      acquired: false,
      lock_key,
      error: 'Lock acquisition timeout',
    };
  }

  /**
   * Release lock using pre-compiled Lua script (atomic, fast)
   */
  async release_lock_flexible(lock_result: LockResult): Promise<boolean> {
    if (!lock_result.acquired || !lock_result.lock_value) {
      return false;
    }

    try {
      const result = await this.redis.eval(
        this.release_script,
        1,
        lock_result.lock_key,
        lock_result.lock_value,
      );

      this.active_locks.delete(lock_result.lock_key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error releasing lock ${lock_result.lock_key}:`, error);
      this.active_locks.delete(lock_result.lock_key);
      return false;
    }
  }

  /**
   * Release lock by key (for backward compatibility)
   */
  async release_lock_by_key(
    lock_key: string,
    lock_value: string,
  ): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        this.release_script,
        1,
        lock_key,
        lock_value,
      );
      this.active_locks.delete(lock_key);
      return result === 1;
    } catch (error) {
      this.active_locks.delete(lock_key);
      return false;
    }
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY
  // ============================================================================

  /**
   * @deprecated Use acquire_lock_flexible() instead
   * Backward compatible method for user-level locks
   */
  async acquire_lock(
    user_id: string,
    operation = 'transaction',
  ): Promise<boolean> {
    const result = await this.acquire_lock_flexible({
      type: LockType.USER,
      user_id,
      operation,
    });
    return result.acquired;
  }

  /**
   * @deprecated Use release_lock_flexible() instead
   * Backward compatible method for releasing user-level locks
   */
  async release_lock(
    user_id: string,
    operation = 'transaction',
  ): Promise<boolean> {
    const lock_key = this.generate_key({
      type: LockType.USER,
      user_id,
      operation,
    });
    const lock_value = this.active_locks.get(lock_key);

    if (!lock_value) {
      // Lock not in memory - try to delete from Redis anyway
      // (lock will expire via TTL if this fails, but we try to clean up)
      try {
        await this.redis.del(lock_key);
        this.active_locks.delete(lock_key);
        return true;
      } catch {
        // If we can't delete, lock will expire via TTL
        return false;
      }
    }

    return this.release_lock_by_key(lock_key, lock_value);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
