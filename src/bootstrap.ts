/* eslint-disable @typescript-eslint/naming-convention */
import { NestFactory, ModuleRef } from '@nestjs/core';
import { Sequelize } from 'sequelize-typescript';
import { AppModule } from './bootstrap.module';
import { configs } from '../config/config.env';
import { IBootstrapConfigs } from './shared/interfaces/app_bootstrap';
import { ILogger } from './shared/interfaces/logger';
import { APP_LOGGER } from './shared/utils/Loggers';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import * as bodyParser from 'body-parser';
import { LoggingInterceptor } from './shared/Interceptors/logging.interceptor';
import { TransformInterceptor } from './shared/Interceptors/transform.interceptor';
import { AvailableRoute } from './shared/types/app_bootstrap';
import { AllExceptionsFilter } from './shared/filters/exception_filter';

export class Bootstrap {
  protected server_name: string;
  protected server_port: number;
  protected emoji: string;
  protected env: string;
  protected routes_to_exclude: string[];

  private logger: ILogger;

  constructor(
    configs: IBootstrapConfigs,
    private sequelize?: Sequelize,
  ) {
    this.server_name = configs.server_name;
    this.server_port = configs.server_port;
    this.env = configs.env;
    this.emoji = configs.emoji;
    this.routes_to_exclude = configs.routes_to_exclude;
    this.logger = new APP_LOGGER(
      configs.logger?.provider || 'DEFAULT',
    ).logger();
  }

  async init(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(app.get(ModuleRef)));
    app.use(
      ['/api/v1/transaction/webhook/stripe'],
      bodyParser.raw({ type: '*/*' }),
    );
    app.setGlobalPrefix(configs.API_VERSION, {
      exclude: this.routes_to_exclude,
    });

    app.use(json({ limit: '100mb' }));

    app.enableCors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'Content-Type',
        'Accept',
        'Authorization',
        'x-client-id',
      ],
      exposedHeaders: ['Authorization', 'x-client-id'],
      credentials: true,
      maxAge: 3600,
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.listen(this.server_port, () => {
      this.logger.log(
        `${this.server_name} ${this.env} rolling ON ${this.server_port}!! ${this.emoji} `,
      );
    });
    const available_routes = this.get_available_routes(app);
    this.memorize_available_routes(available_routes);
  }

  async onModuleDestroy() {
    await this.sequelize?.close();
    this.logger.log(
      `${this.server_name} ${this.env} connection pool gracefully closed!! ${this.emoji}`,
    );
  }

  get_available_routes(app) {
    const server = app.getHttpServer();
    const router = server._events.request._router;
    const available_routes: AvailableRoute[] = router?.stack
      .map((layer) => {
        if (layer.route) {
          return {
            route: {
              path: layer.route?.path,
              method: layer.route?.stack[0].method,
            },
          };
        }
      })
      .filter((item) => item !== undefined);
    return available_routes;
  }

  memorize_available_routes(routes: AvailableRoute[]) {}
}
