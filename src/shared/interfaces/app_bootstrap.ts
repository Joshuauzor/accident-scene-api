import { ILogger, LoggerProviders } from './logger';

export interface IBootstrapConfigs {
  server_port: number;
  server_name: string;
  env: string;
  emoji: string;
  logger?: { provider: LoggerProviders; use?: ILogger };
  routes_to_exclude: string[];
}
