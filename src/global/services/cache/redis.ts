import { Provider, Scope } from '@nestjs/common';
import { configs } from 'config/config.env';
import Redis from 'ioredis';

let redis_client_instance: Redis | null = null;

export const REDIS_PROVIDER: Provider = {
  provide: 'REDIS_CLIENT',
  scope: Scope.DEFAULT,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  useFactory: () => {
    if (redis_client_instance) {
      return redis_client_instance;
    }

    redis_client_instance = new Redis(configs.REDIS_CONNECTION_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      lazyConnect: false,
      showFriendlyErrorStack: true,

      // eslint-disable-next-line @typescript-eslint/naming-convention
      retryStrategy: (times) => {
        if (times > 10) {
          return null;
        }
        return Math.min(times * 50, 2000);
      },

      connectTimeout: 30000,
      commandTimeout: 30000,
      keepAlive: 30000,
      family: 4,

      // eslint-disable-next-line @typescript-eslint/naming-convention
      reconnectOnError: (err) => {
        const TARGET_ERROR = 'READONLY';
        if (err.message.includes(TARGET_ERROR)) {
          return false;
        }
        return true;
      },
    });

    redis_client_instance.on('error', () => {});

    return redis_client_instance;
  },
};

export const get_redis_client = (): Redis | null => redis_client_instance;
