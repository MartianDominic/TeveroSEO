/**
 * Hybrid Crawler Module
 *
 * High-performance crawling with HTTP-first approach and delta sync.
 * Per ADR-003: Only client site audits require crawling (5-10% of tasks).
 *
 * Components:
 * - SitemapParser: XML sitemap parsing with lastmod support
 * - DeltaSyncService: Template-aware hash comparison for change detection
 * - HybridCrawler: HTTP-first with Playwright fallback
 * - Singleflight: Redis-based request deduplication (Phase 64)
 * - ConditionalGet: HTTP 304 support for delta crawling (Phase 64)
 * - DeltaCascade: L0->L1->L2->L3 orchestration (Phase 64)
 */

export * from "./sitemap-parser";
export * from "./delta-sync";
export * from "./hybrid-crawler";
export { Singleflight, createCrawlSingleflight, type SingleflightResult } from "./singleflight";
export {
  conditionalGet,
  hasConditionalHeaders,
  type CachedHeaders,
  type ConditionalGetResult,
} from "./conditional-get";
export {
  deltaCascade,
  calculateSkipRate,
  getLayerStats,
  type DeltaResult,
} from "./delta-cascade";
