/**
 * Proxy Configuration Module
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Handles validation and construction of proxy configurations
 * for the tiered fetching system.
 */

import { z } from "zod";
import { createComponentLogger } from "../logging";

// =============================================================================
// Geonode Configuration Schema
// =============================================================================

/**
 * Geonode proxy configuration schema.
 * Validates environment variables with sensible defaults.
 */
export const GeonodeConfigSchema = z.object({
  /**
   * Proxy host (without protocol).
   * Default: proxy.geonode.io
   */
  host: z.string().default("proxy.geonode.io"),

  /**
   * Proxy port.
   * 9000 = rotating residential
   * 9001 = sticky residential (session persistence)
   * 9002 = rotating datacenter
   * 9003 = sticky datacenter
   */
  port: z.coerce.number().int().min(1).max(65535).default(9000),

  /**
   * Full username including proxy type suffix.
   * Format: geonode_{accountId}-type-{proxyType}
   *
   * The username already contains the proxy type (residential/datacenter).
   * Do NOT add `-type-` again when constructing URLs.
   */
  username: z
    .string()
    .min(1, "GEONODE_USERNAME is required")
    .refine(
      (val) => val.includes("-type-"),
      "GEONODE_USERNAME must include proxy type suffix (e.g., -type-residential)"
    ),

  /**
   * API password (UUID format).
   * SECURITY: Should be stored in secrets manager in production.
   */
  password: z
    .string()
    .min(1, "GEONODE_PASSWORD is required")
    .refine(
      (val) => /^[a-f0-9-]{36}$/i.test(val),
      "GEONODE_PASSWORD should be a UUID (e.g., 34000f84-a2dd-4ce9-9892-57413ad0862e)"
    ),

  /**
   * Default country for geo-targeting (ISO 3166-1 alpha-2).
   * Empty = global rotation.
   */
  defaultCountry: z
    .string()
    .length(2)
    .optional()
    .transform((val) => val?.toLowerCase()),

  /**
   * Default session lifetime in minutes.
   * 0 = no persistence (rotating IPs per request).
   */
  sessionLifetimeMin: z.coerce.number().int().min(0).max(60).default(0),
});

export type GeonodeConfig = z.infer<typeof GeonodeConfigSchema>;

// =============================================================================
// Webshare Configuration Schema
// =============================================================================

/**
 * Webshare proxy configuration schema.
 * Optional - can be skipped if not using free DC proxies.
 */
export const WebshareConfigSchema = z.object({
  /**
   * Webshare API key.
   * Get from https://www.webshare.io/
   */
  apiKey: z.string().optional(),

  /**
   * Whether Webshare is enabled.
   * Automatically disabled if apiKey is not provided.
   */
  enabled: z.boolean().default(false),
});

export type WebshareConfig = z.infer<typeof WebshareConfigSchema>;

// =============================================================================
// Combined Proxy Configuration
// =============================================================================

/**
 * Combined proxy configuration for all tiers.
 */
export interface ProxyConfig {
  geonode: GeonodeConfig | null;
  webshare: WebshareConfig | null;

  /** Whether any proxy tier is configured */
  hasProxies: boolean;

  /** Configured tiers in escalation order */
  availableTiers: Array<"webshare" | "geonode">;
}

// =============================================================================
// Environment Loading
// =============================================================================

/**
 * Load and validate proxy configuration from environment.
 * Fails gracefully if proxies are not configured.
 */
export function loadProxyConfig(): ProxyConfig {
  // Try to load Geonode config
  let geonode: GeonodeConfig | null = null;
  const geonodeUsername = process.env.GEONODE_USERNAME?.trim();
  const geonodePassword = process.env.GEONODE_PASSWORD?.trim();

  if (geonodeUsername && geonodePassword) {
    try {
      geonode = GeonodeConfigSchema.parse({
        host: process.env.GEONODE_HOST,
        port: process.env.GEONODE_PORT,
        username: geonodeUsername,
        password: geonodePassword,
        defaultCountry: process.env.GEONODE_DEFAULT_COUNTRY,
        sessionLifetimeMin: process.env.GEONODE_SESSION_LIFETIME_MIN,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        // In production, log error but don't crash
        const proxyConfigLogger = createComponentLogger("proxy-config");
        proxyConfigLogger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            issues: error instanceof z.ZodError
              ? error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
              : undefined,
          },
          "Invalid Geonode configuration"
        );
      }
      // In development, allow missing config
    }
  }

  // Try to load Webshare config
  let webshare: WebshareConfig | null = null;
  const webshareApiKey = process.env.WEBSHARE_API_KEY?.trim();

  if (webshareApiKey) {
    webshare = {
      apiKey: webshareApiKey,
      enabled: true,
    };
  }

  // Determine available tiers
  const availableTiers: Array<"webshare" | "geonode"> = [];
  if (webshare?.enabled) availableTiers.push("webshare");
  if (geonode) availableTiers.push("geonode");

  return {
    geonode,
    webshare,
    hasProxies: availableTiers.length > 0,
    availableTiers,
  };
}

/**
 * Get validated proxy config, throwing if required proxies are missing.
 * Use this in production code that requires proxy access.
 */
export function getRequiredProxyConfig(): ProxyConfig {
  const config = loadProxyConfig();

  if (!config.geonode) {
    throw new Error(
      "Geonode proxy configuration is required for tiered scraping. " +
        "Set GEONODE_USERNAME and GEONODE_PASSWORD in environment."
    );
  }

  return config;
}

// =============================================================================
// Singleton Export
// =============================================================================

let _proxyConfig: ProxyConfig | null = null;

/**
 * Get proxy configuration (lazy-loaded singleton).
 */
export function getProxyConfig(): ProxyConfig {
  if (!_proxyConfig) {
    _proxyConfig = loadProxyConfig();
  }
  return _proxyConfig;
}

/**
 * Reload proxy configuration (for testing).
 */
export function reloadProxyConfig(): ProxyConfig {
  _proxyConfig = loadProxyConfig();
  return _proxyConfig;
}
