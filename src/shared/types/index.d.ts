import { Dialect } from 'sequelize';

export type DatabaseConfigs = {
  dialect: Dialect;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  logging: boolean;
};
