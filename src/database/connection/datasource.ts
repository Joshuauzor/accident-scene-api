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
    max: configs.NODE_ENV === 'production' ? 1 : 5, // 1 connection per Lambda instance in prod
    min: 0, // Don't maintain idle connections (Lambda-specific optimization)
    acquire: 30000, // 30 seconds to acquire connection (reduced from 60s for faster failure)
    idle: 5000, // Close idle connections after 5s (aggressive for Lambda)
    evict: 1000, // Check for idle connections every 1s (aggressive cleanup)
    handleDisconnects: true, // Auto-reconnect on disconnect
    // Lambda-specific: Don't create connections during bootstrap
    // Connections are created on-demand when first query is executed
  },
  // Lambda optimization: Defer connection until first query
  // This reduces cold start time by not connecting to DB during bootstrap
  // Connection will be established lazily when first database operation occurs
  logging: configs.USE_DATABASE_LOG ? (): void => {} : false,
  ssl: configs.NODE_ENV === 'test',
  autoLoadModels: true,
  synchronize: false,
};
