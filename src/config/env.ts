import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  HOST: z.string().default('0.0.0.0'),
  BASE_URL: z.string().url(),

  // KOauth OAuth2 Server Integration
  KOAUTH_URL: z.string().url(),
  KOAUTH_JWKS_URL: z.string().url(),
  KOAUTH_CLIENT_REGISTRATION_URL: z.string().url(),

  // Kura Database Connection (Read-Only)
  KURA_DATABASE_URL: z.string().regex(/^postgresql:\/\/.+/, {
    message: 'KURA_DATABASE_URL must be a valid PostgreSQL connection string',
  }),

  // Security Configuration
  ALLOWED_ORIGINS: z
    .string()
    .default('https://claude.ai')
    .transform((val) => val.split(',').map((origin) => origin.trim())),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

/**
 * Validated environment configuration
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws an error if validation fails
 */
function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      console.error('');

      error.errors.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  • ${path}: ${err.message}`);
      });

      console.error('');
      console.error('Please check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and type-safe configuration object
 * Export this to access environment variables throughout the application
 */
export const config = validateEnv();

/**
 * Check if running in production mode
 */
export const isProduction = config.NODE_ENV === 'production';

/**
 * Check if running in development mode
 */
export const isDevelopment = config.NODE_ENV === 'development';

/**
 * Check if running in test mode
 */
export const isTest = config.NODE_ENV === 'test';
