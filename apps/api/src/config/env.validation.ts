import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('zebl-lms-api'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  PORT: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
  APP_GLOBAL_PREFIX: z.string().min(1).default('api/v1'),
  APP_CORS_ORIGINS: z.string().default('http://localhost:4200'),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  LOG_PRETTY: booleanFromString.default(true),

  SWAGGER_ENABLED: booleanFromString.default(true),
  SWAGGER_PATH: z.string().min(1).default('docs'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).default(8),
  PASSWORD_RESET_EXPIRES_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().default('superadmin@zebl.local'),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe!SuperAdmin1'),

  STORAGE_ROOT_DIR: z.string().min(1).default('uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().min(1).default('/uploads'),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  BLOB_STORE_ID: z.string().min(1).optional(),
  UPLOAD_MAX_THUMBNAIL_BYTES: z.coerce.number().int().positive().default(5_000_000),
  UPLOAD_MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(50_000_000),
  UPLOAD_MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(500_000_000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }
  return result.data;
}
