import { Logger } from '@nestjs/common';
import { ILogger } from 'src/shared/interfaces/logger';

export class WINSTION_LOGGER {
  logger(name = WINSTION_LOGGER.name): ILogger {
    const logger = new Logger(name);
    return {
      log: logger.log.bind(logger),
      debug: logger.debug.bind(logger),
      error: logger.error.bind(logger),
      verbose: logger.verbose.bind(logger),
      warn: logger.warn.bind(logger),
    };
  }
}
