import { configs } from 'config/config.env';

module.exports = {
  host: configs.DATABASE_HOST,
  port: configs.DATABASE_PORT,
  username: configs.DATABASE_USER,
  password: configs.DATABASE_PASSWORD,
  database: configs.DATABASE_NAME,
  dialect: 'postgres',
  timezone: '+01:00',
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false,
    },
    statement_timeout: 30000,
  },
  query: {
    timeout: 30000,
  },
  pool: {
    max: configs.NODE_ENV === 'production' ? 1 : 5,
    min: 0,
    acquire: 30000,
    idle: 5000,
    evict: 1000,
    handleDisconnects: true,
  },
  logging: configs.USE_DATABASE_LOG ? (): void => {} : false,
  ssl: configs.NODE_ENV === 'test',
  autoLoadModels: true,
  synchronize: false,
};
