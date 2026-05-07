/**
 * Scraping Config Module
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Exports for proxy and scraping configuration.
 */

export {
  // Schemas
  GeonodeConfigSchema,
  WebshareConfigSchema,
  // Types
  type GeonodeConfig,
  type WebshareConfig,
  type ProxyConfig,
  // Functions
  loadProxyConfig,
  getProxyConfig,
  getRequiredProxyConfig,
  reloadProxyConfig,
} from "./proxy-config";
