/**
 * Fetchers Module
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Exports for HTTP fetcher implementations.
 */

// Types
export type {
  FetchResult,
  BaseFetchOptions,
  GeoTargetingOptions,
  SessionOptions,
  ConnectionTestResult,
} from "./types";

export { TIER_TO_NUMBER, NUMBER_TO_TIER } from "./types";

// Geonode Fetcher
export {
  GeonodeFetcher,
  createGeonodeFetcher,
  getGeonodeFetcher,
  resetGeonodeFetcher,
  buildGeonodeProxyUrl,
  type GeonodeFetchOptions,
  type GeonodeProxyUrl,
} from "./GeonodeFetcher";
