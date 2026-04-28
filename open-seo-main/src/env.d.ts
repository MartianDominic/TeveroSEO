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

    // SEO Configuration
    SEO_QUALITY_THRESHOLD?: string; // Default: "80" - minimum score for content approval

    LOOPS_API_KEY?: string;
    LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID?: string;
    LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID?: string;

    AUTUMN_SECRET_KEY?: string;
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
