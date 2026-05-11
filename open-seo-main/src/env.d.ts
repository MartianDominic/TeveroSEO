// Typed process.env for Node.js runtime.
// All variables are validated at startup in src/server/lib/runtime-env.ts.
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: "development" | "production" | "test";

    AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
    TEAM_DOMAIN?: string;
    POLICY_AUD?: string;

    POSTHOG_PUBLIC_KEY?: string;
    POSTHOG_HOST?: string;

    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;

    DATABASE_URL?: string;
    REDIS_URL?: string;

    DATAFORSEO_API_KEY?: string;

    // Scrapling Service (Phase 100)
    SCRAPLING_SERVICE_URL?: string; // Default: "http://localhost:8001"

    // SEO Configuration
    SEO_QUALITY_THRESHOLD?: string; // Default: "80" - minimum score for content approval

    LOOPS_API_KEY?: string;
    LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID?: string;
    LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID?: string;

    AUTUMN_SECRET_KEY?: string;

    // R2 Cache Configuration
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET?: string;
    CF_ACCOUNT_ID?: string;
    R2_RETENTION_DAYS?: string; // Default: "90" - days to keep cached HTML in R2
    R2_PURGE_RATE_LIMIT?: string; // Default: "100" - max purge operations per minute
  }
}

interface ImportMetaEnv {
  readonly AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
  readonly POSTHOG_PUBLIC_KEY?: string;
  readonly POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
