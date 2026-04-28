/// <reference types="vite/client" />
interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_SHOW_DEVTOOLS?: string;
  readonly AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
  readonly POSTHOG_PUBLIC_KEY?: string;
  readonly POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
