/**
 * Environment Configuration & Validation
 *
 * Centralizes all environment variable access with Zod validation.
 * Validates at startup to fail fast with clear error messages.
 *
 * SECURITY: This module validates all required secrets at startup.
 * Missing or invalid secrets will cause the application to fail fast
 * with clear error messages, preventing silent security bypasses.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   console.log(env.OPEN_SEO_URL);
 */

import { z } from 'zod';

/**
 * Server-side environment variables schema.
 * These are validated at server startup.
 *
 * SECURITY NOTES:
 * - All required secrets must have minimum length validation
 * - CLERK_WEBHOOK_SECRET is required for secure webhook verification
 * - INTERNAL_API_KEY must be at least 32 chars for service-to-service auth
 */
const serverEnvSchema = z.object({
  // Database (REQUIRED)
  DATABASE_URL: z.string().min(10, 'DATABASE_URL must be a valid connection string'),

  // Redis (REQUIRED)
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Authentication (Clerk) - REQUIRED
  CLERK_SECRET_KEY: z.string().min(20, 'CLERK_SECRET_KEY must be at least 20 characters'),

  // Webhook verification (REQUIRED for secure webhook handling)
  // SECURITY: Without this, webhook signature verification silently fails
  CLERK_WEBHOOK_SECRET: z.string().min(10, 'CLERK_WEBHOOK_SECRET is required for webhook security'),

  // Internal API key for service-to-service authentication (REQUIRED in production)
  // SECURITY: Must be at least 32 characters for cryptographic strength
  INTERNAL_API_KEY: z.string().min(32, 'INTERNAL_API_KEY must be at least 32 characters').optional()
    .refine(
      (val) => process.env.NODE_ENV !== 'production' || (val && val.length >= 32),
      'INTERNAL_API_KEY is required in production and must be at least 32 characters'
    ),

  // Backend services - using standardized names
  OPEN_SEO_URL: z.string().url('OPEN_SEO_URL must be a valid URL').default('http://localhost:3001'),
  AI_WRITER_URL: z.string().url('AI_WRITER_URL must be a valid URL').default('http://localhost:8000'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Client-side environment variables schema.
 * Must be prefixed with NEXT_PUBLIC_ to be exposed to the browser.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required'),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().optional().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().optional().default('/sign-up'),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().optional().default('/clients'),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().optional().default('/clients'),

  // Public URLs for client-side API calls
  NEXT_PUBLIC_OPEN_SEO_URL: z.string().url().optional(),
  NEXT_PUBLIC_AI_WRITER_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
});

/**
 * Combined schema for full validation.
 */
const envSchema = serverEnvSchema.merge(clientEnvSchema);

export type Env = z.infer<typeof envSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validate environment variables and return typed config.
 * Logs detailed errors and throws on validation failure.
 *
 * SECURITY: Environment validation is ALWAYS performed.
 * The SKIP_ENV_VALIDATION bypass has been removed to prevent
 * accidental deployment without required security configuration.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error('===============================================');
    console.error('  Invalid environment variables:');
    console.error('===============================================');

    for (const [key, messages] of Object.entries(errors)) {
      console.error(`  ${key}:`);
      for (const msg of messages || []) {
        console.error(`    - ${msg}`);
      }
    }

    console.error('===============================================');
    console.error('  Please check your .env file or environment');
    console.error('  See apps/web/.env.example for required vars');
    console.error('===============================================');

    throw new Error('Invalid environment configuration. See console for details.');
  }

  // SECURITY: Warn about localhost URLs in production
  if (process.env.NODE_ENV === 'production') {
    if (result.data.AI_WRITER_URL?.includes('localhost')) {
      console.warn('WARNING: AI_WRITER_URL contains localhost in production!');
    }
    if (result.data.OPEN_SEO_URL?.includes('localhost')) {
      console.warn('WARNING: OPEN_SEO_URL contains localhost in production!');
    }
  }

  return result.data;
}

/**
 * Validated environment variables.
 * Import this instead of accessing process.env directly.
 */
export const env = validateEnv();

/**
 * Get Clerk webhook secret with validation.
 * SECURITY: This function ensures the webhook secret is available,
 * throwing an error if not configured rather than silently failing.
 */
export function getClerkWebhookSecret(): string {
  const secret = env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CLERK_WEBHOOK_SECRET is required for webhook verification');
  }
  return secret;
}

/**
 * Get internal API key for service-to-service authentication.
 * SECURITY: Returns undefined in development, throws in production if not set.
 */
export function getInternalApiKey(): string | undefined {
  return env.INTERNAL_API_KEY;
}

/**
 * Helper to get Open SEO URL (server-side).
 * Uses OPEN_SEO_URL with fallback to default.
 */
export function getOpenSeoUrl(): string {
  return env.OPEN_SEO_URL;
}

/**
 * Helper to get AI Writer URL (server-side).
 * Uses AI_WRITER_URL with fallback to default.
 */
export function getAiWriterUrl(): string {
  return env.AI_WRITER_URL;
}

/**
 * Helper to get Open SEO URL for client-side.
 * Uses NEXT_PUBLIC_OPEN_SEO_URL or falls back to server URL.
 */
export function getPublicOpenSeoUrl(): string {
  return env.NEXT_PUBLIC_OPEN_SEO_URL ?? env.OPEN_SEO_URL;
}

/**
 * Helper to get AI Writer URL for client-side.
 * Uses NEXT_PUBLIC_AI_WRITER_URL or falls back to server URL.
 */
export function getPublicAiWriterUrl(): string {
  return env.NEXT_PUBLIC_AI_WRITER_URL ?? env.AI_WRITER_URL;
}
