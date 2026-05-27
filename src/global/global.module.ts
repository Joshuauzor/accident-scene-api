import { Global, Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { REDIS_PROVIDER } from './services/cache/redis';
import { AuthUserCacheService } from './services/cache/auth-user-cache.service';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerService } from './services/cache/throttler';
import { SentryService } from './services/sentry/sentry.service';

@Global()
@Module({
  providers: [
    ConfigService,
    REDIS_PROVIDER,
    AuthUserCacheService,
    ThrottlerService,
    SentryService,
  ],
  exports: [
    ConfigService,
    HttpModule,
    REDIS_PROVIDER,
    AuthUserCacheService,
    ThrottlerService,
    SentryService,
  ],
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [],
})
export class GlobalModule {}
