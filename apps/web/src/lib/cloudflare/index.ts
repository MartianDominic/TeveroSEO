/**
 * Cloudflare Integration Module
 *
 * Provides Cloudflare detection and Crawler Hints integration for IndexNow.
 */

export {
  // Detection
  detectCloudflare,
  detectCloudflareViaDns,

  // API Client
  CloudflareApiClient,

  // Integration
  integrateCloudfareCrawlerHints,

  // OAuth (future)
  generateCloudflareOAuthUrl,
  exchangeCloudflareOAuthCode,

  // Constants
  REQUIRED_SCOPES,

  // Types
  type CloudflareDetectionResult,
  type CloudflareZone,
  type CloudflareZoneSetting,
  type CrawlerHintsStatus,
  type CloudflareOAuthConfig,
  type CloudflareTokenInfo,
  type CrawlerHintsIntegrationResult,
} from "./crawler-hints";
