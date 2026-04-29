/**
 * Read an env var. Returns undefined if unset or empty after trim.
 * Node.js runtime only — no Cloudflare Workers fallback.
 */
function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Synchronous version of getRequiredEnvValue for use in contexts
 * where async is not possible (e.g., hash functions, synchronous initialization).
 * Throws immediately if the env var is missing.
 */
export function getRequiredEnvValueSync(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get a required env var or throw a descriptive error. Async for
 * backward-compatibility with existing callers (safe to `await`).
 */
export async function getRequiredEnvValue(name: string): Promise<string> {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Optional env read (async kept for callsite compatibility). */
export async function getOptionalEnvValue(
  name: string,
): Promise<string | undefined> {
  return readEnv(name);
}

/**
 * Legacy shim — previously returned a Cloudflare Worker binding. On Node.js
 * there are no runtime bindings; every value comes from process.env. Callers
 * that need a raw string should use getRequiredEnvValue. This export remains
 * so existing import sites type-check; it throws to surface any caller that
 * still expects a Workers binding object.
 */
export async function getWorkersBinding(name: string): Promise<unknown> {
  throw new Error(
    `getWorkersBinding(${name}) is not available in the Node.js runtime. Use getRequiredEnvValue("${name}") or read process.env.${name} directly.`,
  );
}

/**
 * Validate that a set of env vars is present. Call this at server startup
 * (src/server.ts or src/start.ts) to fail fast on misconfiguration.
 *
 * Accepts a list of variable names. Throws aggregated error listing every
 * missing variable rather than failing on the first.
 */
export function validateEnv(required: readonly string[]): void {
  const missing: string[] = [];
  for (const name of required) {
    if (!readEnv(name)) missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in .env or the deployment environment before starting.`,
    );
  }
}

/**
 * The canonical list of env vars the app requires in hosted mode.
 * Consumed by validateEnv() at startup.
 *
 * SECURITY: All critical variables must be listed here to fail fast
 * at startup rather than crash at runtime when features are used.
 */
export const REQUIRED_ENV_HOSTED = [
  // Database
  "DATABASE_URL",
  "REDIS_URL",
  "ALWRITY_DATABASE_URL",
  // Authentication
  "CLERK_PUBLISHABLE_KEY",
  // SEO Features
  "DATAFORSEO_API_KEY",
  // Security
  "IP_SALT",
  "INTERNAL_API_KEY",
  "SITE_ENCRYPTION_KEY",
  // AI Features
  "ANTHROPIC_API_KEY",
  // Payments (Stripe)
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  // Google OAuth (required for GSC/Analytics integration)
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  // Email Service (required for alerts)
  "RESEND_API_KEY",
  // Cron Security (required for scheduled jobs)
  "CRON_SECRET",
] as const;

/**
 * Validate all required environment variables at module load time.
 * This ensures the app fails fast with a clear error message
 * rather than crashing when a feature tries to use a missing variable.
 */
function validateRequiredEnvAtStartup(): void {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    // In development, only validate core vars to allow partial setups
    return;
  }

  const missing = REQUIRED_ENV_HOSTED.filter(key => !readEnv(key));
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(", ")}. ` +
      `Set them in .env or the deployment environment before starting.`
    );
  }
}

// Run validation at module load time (production only)
validateRequiredEnvAtStartup();

/** Always-required vars regardless of auth mode. */
export const REQUIRED_ENV_CORE = [
  "DATABASE_URL",
  "REDIS_URL",
  "ALWRITY_DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
] as const;

/**
 * Environment variables required for SEO audit features.
 * These are optional at startup but required when using DataForSEO-powered features.
 */
export const REQUIRED_ENV_SEO = [
  "DATAFORSEO_API_KEY",
] as const;

/**
 * Environment variables required for security features.
 * IP_SALT: Used for hashing IP addresses (GDPR compliance)
 * INTERNAL_API_KEY: Used for internal service-to-service auth
 * PERSONAL_CODE_SALT: Used for hashing personal codes (e-signature)
 */
export const REQUIRED_ENV_SECURITY = [
  "IP_SALT",
  "INTERNAL_API_KEY",
] as const;

/**
 * Validate SITE_ENCRYPTION_KEY format.
 * Must be a base64-encoded 32-byte key for AES-256.
 *
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * @throws Error if key is present but invalid format
 */
export function validateSiteEncryptionKey(): void {
  const key = readEnv("SITE_ENCRYPTION_KEY");
  if (!key) {
    // Key is optional - only validate if present
    return;
  }

  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      `SITE_ENCRYPTION_KEY must be a base64-encoded 32-byte key. ` +
        `Got ${decoded.length} bytes after decoding. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
}

/**
 * Environment variables required for site connections feature.
 * SITE_ENCRYPTION_KEY is required when storing platform credentials.
 */
export const REQUIRED_ENV_CONNECTIONS = [
  "SITE_ENCRYPTION_KEY",
] as const;
