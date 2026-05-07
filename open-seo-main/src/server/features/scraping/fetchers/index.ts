/**
 * Fetchers Module
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Exports for HTTP fetcher implementations across all tiers:
 * - T0: DirectFetcher (free, polite rate limiting)
 * - T1: WebshareFetcher (free DC proxies)
 * - T2: GeonodeFetcher (residential proxies, $0.77/GB)
 * - T2.5: CamoufoxFetcher (stealth browser + Geonode)
 * - T3-T5: DataForSEOFetcher (enterprise API)
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

// T0: Direct Fetcher
export {
  DirectFetcher,
  createDirectFetcher,
  getDirectFetcher,
  resetDirectFetcher,
  clearRateLimiter,
  type DirectFetchOptions,
} from "./DirectFetcher";

// T1: Webshare DC Proxy Fetcher
export {
  WebshareFetcher,
  createWebshareFetcher,
  getWebshareFetcher,
  resetWebshareFetcher,
  type WebshareFetchOptions,
  type WebshareProxy,
  type WebshareConfig,
} from "./WebshareFetcher";

// T2: Geonode Residential Proxy Fetcher
export {
  GeonodeFetcher,
  createGeonodeFetcher,
  getGeonodeFetcher,
  resetGeonodeFetcher,
  buildGeonodeProxyUrl,
  type GeonodeFetchOptions,
  type GeonodeProxyUrl,
} from "./GeonodeFetcher";

// T2.5: Camoufox Stealth Browser Fetcher
export {
  CamoufoxFetcher,
  createCamoufoxFetcher,
  getCamoufoxFetcher,
  resetCamoufoxFetcher,
  type CamoufoxFetchOptions,
} from "./CamoufoxFetcher";

// T3-T5: DataForSEO API Fetcher
export {
  DataForSEOFetcher,
  createDataForSEOFetcher,
  getDataForSEOFetcher,
  resetDataForSEOFetcher,
  type DataForSEOFetchOptions,
} from "./DataForSEOFetcher";
