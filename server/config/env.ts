import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'ohs-expert-dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  dbHost: process.env.DB_HOST || '',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || 'ohs_user',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'ohs_expert',
  dbConnectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  dbSsl: process.env.DB_SSL === 'true',
  cloudSqlConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME || '',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads'),
  maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024,
};
