import { ILogger, LoggerProviders } from 'src/shared/interfaces/logger';
import { PINO_LOGGER } from './providers/pino';
import { WINSTION_LOGGER } from './providers/winston';
import { Logger } from '@nestjs/common';

export class APP_LOGGER {
  constructor(
    private provider: LoggerProviders = 'DEFAULT',
    private name = APP_LOGGER.name,
  ) {}

  logger(): ILogger {
    switch (this.provider) {
      case 'PINO':
        return new PINO_LOGGER().logger(this.name);

      case 'WINSTION':
        return new WINSTION_LOGGER().logger(this.name);

      case 'DEFAULT':
        return new Logger(this.name);
    }
  }
}
