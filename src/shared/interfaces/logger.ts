import { LoggerService } from '@nestjs/common';

export type LoggerProviders = 'WINSTION' | 'PINO' | 'DEFAULT';

export interface ILogger extends LoggerService {
  log: any;
  debug: any;
  warn: any;
  error: any;
  verbose: any;
}
