import pino from 'pino';
import pinoHttp from 'pino-http';
import 'pino-pretty';
import { ILogger } from 'src/shared/interfaces/logger';

export class PINO_LOGGER {
  logger(name = PINO_LOGGER.name): ILogger {
    const logger = pino();
    return {
      debug: logger.debug,
      error: logger.error,
      warn: logger.warn,
      log: console.log,
      verbose: () => {
        logger.error('Verbose Logger Not Available');
      },
    };
  }

  static httpLogger() {
    return pinoHttp();
  }
}
