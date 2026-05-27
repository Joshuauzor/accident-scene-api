import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';
import { config } from 'dotenv';
import { plainToClass } from 'class-transformer';
import { Logger } from '@nestjs/common';

const logger = new Logger('EnvConfig');
const NODE_ENVS = ['development', 'production', 'staging', 'test'] as const;
type NodeENV = (typeof NODE_ENVS)[number];

class EnvConfig {
  @IsIn(NODE_ENVS)
  NODE_ENV: NodeENV = 'development';

  @IsString()
  DATABASE_DIALECT: string;

  @IsString()
  DATABASE_USER: string;

  @IsString()
  DATABASE_HOST: string;

  @IsNumber()
  DATABASE_PORT: number;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  DATABASE_PREFIX: string;

  @IsBoolean()
  USE_DATABASE_LOG = true;

  // SERVER
  @IsString()
  SERVER_NAME: string;

  @IsNumber()
  SERVER_PORT: number;

  @IsString()
  @IsOptional()
  SERVER_URL: string;

  @IsBoolean()
  @IsOptional()
  IS_OFFLINE = false; // If true, the server will run in offline mode

  @IsString()
  ENCRYPTION_PRIVATE_KEY: string;

  @IsString()
  ENV_EMOJI: string;

  @IsString()
  INTER_SERVICE_QUEUE_URL: string;

  @IsString()
  SQS_DLQ_URL: string;

  @IsString()
  SQS_PRIORITY_QUEUE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  API_VERSION: string;

  // Sentry Configuration
  @IsString()
  @IsOptional()
  SENTRY_DSN: string = process.env.SENTRY_DSN || '';

  @IsString()
  @IsOptional()
  SENTRY_ENVIRONMENT: string =
    process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';

  @IsString()
  @IsOptional()
  SENTRY_RELEASE: string =
    process.env.SENTRY_RELEASE || process.env.APP_VERSION || '';

  @IsString()
  @IsOptional()
  SENTRY_TRACES_SAMPLE_RATE: string =
    process.env.SENTRY_TRACES_SAMPLE_RATE || '';

  @IsString()
  @IsOptional()
  SENTRY_DEBUG: string = process.env.SENTRY_DEBUG || 'false';

  @IsBoolean()
  SYNC_SEEDERS = false;

  @IsString()
  REDIS_CONNECTION_URL: string;

  @IsString()
  DEFAULT_REGION: string;

  @IsString()
  ACCESS_KEY_ID: string;

  @IsString()
  SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_ACCOUNT_ID: string;

  @IsString()
  S3_FOLDER: string;

  @IsString()
  S3_BUCKET_NAME: string;

  @IsString()
  CLOUDINARY_CLOUD_NAME: string;

  @IsString()
  CLOUDINARY_UPLOAD_PRESET: string;

  @IsString()
  CLOUDINARY_API_KEY: string;

  @IsString()
  CLOUDINARY_API_SECRET: string;

  @IsString()
  CLOUDINARY_FOLDER: string;

  @IsString()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  GOOGLE_OAUTH_REDIRECT: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID_MOBILE: string;

  @IsString()
  @IsOptional()
  GOOGLE_OAUTH_REDIRECT_MOBILE: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string;

  @IsString()
  USER_DEFAULT_PHOTO_URL: string;

  @IsString()
  APPLE_CLIENT_ID: string;

  @IsString()
  APPLE_REDIRECT_URI: string;

  @IsString()
  @IsOptional()
  APPLE_REDIRECT_URI_MOBILE: string;

  @IsString()
  @IsOptional()
  APPLE_TEAM_ID: string;

  @IsString()
  @IsOptional()
  APPLE_KEY_ID: string;

  @IsString()
  @IsOptional()
  APPLE_PRIVATE_KEY: string;

  @IsString()
  @IsOptional()
  GOOGLE_MAPS_API_KEY: string;

  @IsString()
  KAFKA_GROUP_ID: string;

  @IsString()
  @IsOptional()
  KAFKA_BROKERS: string;

  @IsNumber()
  CONCURRENT_PARTITIONS: number;

  static get_default_object(): EnvConfig {
    const obj = new EnvConfig();

    // EAAS DATABASE
    obj.DATABASE_DIALECT = process.env.DATABASE_DIALECT || 'mysql';
    obj.DATABASE_USER = process.env.DATABASE_USER || '';
    obj.DATABASE_HOST = process.env.DATABASE_HOST || '';
    obj.DATABASE_PORT = process.env.DATABASE_PORT
      ? +process.env.DATABASE_PORT
      : 3306;
    obj.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || '';
    obj.DATABASE_NAME = process.env.DATABASE_NAME || '';
    obj.DATABASE_PREFIX = process.env.DATABASE_PREFIX || '';
    obj.USE_DATABASE_LOG = Boolean(process.env.USE_DATABASE_LOG);
    // SERVER
    obj.IS_OFFLINE = Boolean(process.env.IS_OFFLINE);
    obj.NODE_ENV = process.env.NODE_ENV as NodeENV;
    obj.SERVER_NAME = process.env.SERVER_NAME || 'CliqMit';
    obj.SERVER_PORT = process.env.SERVER_PORT
      ? +process.env.SERVER_PORT
      : 50050;
    obj.SERVER_URL =
      process.env.SERVER_URL || `http://localhost:${obj.SERVER_PORT}`;
    obj.ENV_EMOJI = process.env.ENV_EMOJI || '👍👍👍';

    // AWS
    obj.DEFAULT_REGION = process.env.DEFAULT_REGION || '';
    obj.ACCESS_KEY_ID = process.env.ACCESS_KEY_ID || '';
    obj.AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || '';
    obj.SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY || '';
    obj.S3_FOLDER = process.env.S3_FOLDER || '';

    obj.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
    obj.INTER_SERVICE_QUEUE_URL = process.env.INTER_SERVICE_QUEUE_URL || '';
    // CLOUDINARY
    obj.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
    obj.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
    obj.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
    obj.CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || '';
    obj.CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';
    // KAFKA
    obj.KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || '';
    obj.KAFKA_BROKERS = process.env.KAFKA_BROKERS || '';
    obj.CONCURRENT_PARTITIONS = Number(process.env.CONCURRENT_PARTITIONS) || 5;

    // ENCRYPTION
    obj.ENCRYPTION_PRIVATE_KEY =
      process.env.ENCRYPTION_PRIVATE_KEY || 'CLIQMIT_ENCRYPTION_PRIVATE_KEY';

    obj.JWT_SECRET = process.env.JWT_SECRET || 'INODETELLYOU_CLIQMIT_MATTER';
    obj.API_VERSION = 'api/v1';
    obj.SYNC_SEEDERS = Boolean(process.env.SYNC_SEEDERS || false);
    obj.REDIS_CONNECTION_URL =
      process.env.REDIS_CONNECTION_URL || 'redis://127.0.0.1:6379';
    obj.FRONTEND_URL =
      process.env.FRONTEND_URL || 'http://www.accident-scene.com';
    obj.USER_DEFAULT_PHOTO_URL = '';
    // // GOOGLE MAPS
    obj.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

    return obj;
  }
}

config();

const configs = plainToClass(
  EnvConfig,
  { ...process.env, ...EnvConfig.get_default_object() },
  { enableImplicitConversion: true },
);

const errors = validateSync(configs, { whitelist: true });

if (errors.length > 0) {
  logger.error(JSON.stringify(errors, undefined, '  '));
  throw new Error('Invalid env variables.');
}

export { configs };
