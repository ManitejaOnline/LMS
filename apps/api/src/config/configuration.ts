import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  name: process.env.APP_NAME ?? 'zebl-lms-api',
  port: Number(process.env.APP_PORT ?? 3000),
  globalPrefix: process.env.APP_GLOBAL_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.APP_CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL!,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const loggingConfig = registerAs('logging', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  pretty: (process.env.LOG_PRETTY ?? 'true').toLowerCase() === 'true',
}));

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: (process.env.SWAGGER_ENABLED ?? 'true').toLowerCase() === 'true',
  path: process.env.SWAGGER_PATH ?? 'docs',
}));

export const authConfig = registerAs('auth', () => ({
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH ?? 8),
  passwordResetExpiresMinutes: Number(
    process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30,
  ),
  seedSuperAdminEmail:
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@zebl.local',
  seedSuperAdminPassword:
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1',
}));

export const storageConfig = registerAs('storage', () => ({
  rootDir: process.env.STORAGE_ROOT_DIR ?? 'uploads',
  publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? '/uploads',
  maxThumbnailBytes: Number(process.env.UPLOAD_MAX_THUMBNAIL_BYTES ?? 5_000_000),
  maxDocumentBytes: Number(process.env.UPLOAD_MAX_DOCUMENT_BYTES ?? 50_000_000),
  maxVideoBytes: Number(process.env.UPLOAD_MAX_VIDEO_BYTES ?? 500_000_000),
}));

export type AppConfig = ConfigType<typeof appConfig>;
export type DatabaseConfig = ConfigType<typeof databaseConfig>;
export type JwtConfig = ConfigType<typeof jwtConfig>;
export type LoggingConfig = ConfigType<typeof loggingConfig>;
export type SwaggerConfig = ConfigType<typeof swaggerConfig>;
export type AuthRuntimeConfig = ConfigType<typeof authConfig>;
export type StorageConfig = ConfigType<typeof storageConfig>;
