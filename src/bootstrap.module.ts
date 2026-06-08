import { MiddlewareConsumer, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { SentryModule } from '@sentry/nestjs/setup';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { GlobalModule } from './global/global.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { BootService } from './bootstrap.service';
import { BootController } from './bootstrap.controller';
import { CustomRateLimitMiddleware } from './shared/middlewares/rate-limiter';
import { AuthModule } from './modules/authentication/auth.module';
import { TenantModule } from './modules/tenants/tenant.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    // Serve static files (bank logos, etc.)
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'src', 'shared', 'logos'),
      serveRoot: '/assets/logos/banks',
      serveStaticOptions: {
        index: false,
        cacheControl: true,
        maxAge: 86400000, // 24 hours in milliseconds
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
      },
    }),
    SentryModule.forRoot(),
    EventEmitterModule.forRoot({
      global: true,
    }),
    GlobalModule,
    DatabaseModule,
    AuthModule,
    TenantModule,
    ReportsModule,
  ],
  controllers: [BootController],
  providers: [
    BootService,
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: LoggingInterceptor,
    // },
    // {
    //   provide: APP_GUARD,
    //   useClass: PermissionGuard,
    // },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CustomRateLimitMiddleware).forRoutes('*');
  }
}
