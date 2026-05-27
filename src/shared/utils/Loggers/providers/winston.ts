import { ILogger } from 'src/shared/interfaces/logger';
import * as winston from 'winston';

export class WINSTION_LOGGER {
  logger(name = WINSTION_LOGGER.name): ILogger {
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: name },
      transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.log`
        // - Write all logs with importance level of `info` or less to `combined.log`
        //
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
      ],
    });

    //
    // If we're not in production then log to the `console` with the format:
    // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
    //
    if (process.env.NODE_ENV !== 'production') {
      logger.add(
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      );
    }

    return {
      log: logger.log,
      debug: logger.debug,
      error: logger.error,
      verbose: logger.verbose,
      warn: logger.warn,
    };
  }
}
