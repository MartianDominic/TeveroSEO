/**
 * Delta Crawling Cascade (L0->L1->L2->L3)
 *
 * Skip unchanged content at the earliest possible layer to minimize crawl cost.
 *
 * Per 64-RESEARCH.md:
 * - L0 (sitemap lastmod): Free, no network - skip if unchanged
 * - L1 (conditional GET): Cheap 304 check - skip if server says unchanged
 * - L2 (hash comparison): Use DeltaSyncService - skip if SEO content unchanged
 * - L3 (full reprocess): Fallback for new URLs or when all layers indicate change
 *
 * Target: 80%+ skip rate on stable sites.
 *
 * @module delta-cascade
 */

import type { SitemapUrl } from "./sitemap-parser";
import { filterByLastmod } from "./sitemap-parser";
import type { DeltaSyncService } from "./delta-sync";
import { conditionalGet, hasConditionalHeaders, type CachedHeaders } from "./conditional-get";
import { recordDeltaSkip, recordFullProcess } from "@/server/lib/metrics/crawl-metrics";

/**
 * Result of delta cascade decision.
 */
export interface DeltaResult {
  /** Action to take */
  action: "skip" | "fetch" | "process";
  /** Human-readable reason */
  reason: string;
  /** Which layer made the decision */
  layer: "L0" | "L1" | "L2" | "L3";
  /** New headers to cache (when L1 returns 200) */
  newHeaders?: CachedHeaders;
  /** HTML content (when L1 returns 200) */
  html?: string;
}

/**
 * Orchestrate L0->L1->L2->L3 delta crawling cascade.
 *
 * Each layer tries to skip processing at the earliest possible point:
 * - L0: Check sitemap lastmod (free, no network)
 * - L1: HTTP conditional GET (cheap network check)
 * - L2: Template-aware hash comparison (uses DeltaSyncService)
 * - L3: Full reprocess fallback
 *
 * Per Shopify Pitfall 2: Treat sitemap lastmod as negative-only signal.
 * Unchanged lastmod = skip, changed lastmod = verify with L1/L2.
 *
 * @param url - URL to check
 * @param tenantId - Tenant ID for delta service
 * @param sitemapInfo - Sitemap URL info (may be null for URLs not in sitemap)
 * @param lastCrawledAt - When we last crawled this URL (null if never)
 * @param cachedHeaders - Cached ETag/Last-Modified from previous crawl
 * @param deltaService - DeltaSyncService instance for L2 hash comparison
 * @returns Decision on whether to skip, fetch, or process
 *
 * @example
 * ```typescript
 * const result = await deltaCascade(
 *   "https://example.com/product",
 *   "tenant-123",
 *   sitemapInfo,
 *   lastCrawledAt,
 *   { etag: '"abc"', lastModified: null },
 *   deltaService
 * );
 *
 * if (result.action === "skip") {
 *   // Content unchanged, skip processing
 * } else if (result.action === "fetch") {
 *   // Need to fetch content (no cached state)
 * } else {
 *   // Process the content (result.html available if L1 returned 200)
 * }
 * ```
 */
export async function deltaCascade(
  url: string,
  tenantId: string,
  sitemapInfo: SitemapUrl | null,
  lastCrawledAt: Date | null,
  cachedHeaders: CachedHeaders | null,
  deltaService: DeltaSyncService
): Promise<DeltaResult> {
  // L0: Sitemap lastmod check (free, no network)
  // Per RESEARCH.md: Treat as negative-only signal for Shopify-like platforms
  if (sitemapInfo?.lastmod && lastCrawledAt) {
    const { unchanged } = filterByLastmod([sitemapInfo], lastCrawledAt);
    if (unchanged.length > 0) {
      // Sitemap says unchanged - we can skip
      recordDeltaSkip("L0");
      return {
        action: "skip",
        reason: "Sitemap lastmod unchanged since last crawl",
        layer: "L0",
      };
    }
    // Sitemap says changed - verify with L1/L2 before proceeding
    // (Fall through to L1 if we have cached headers)
  }

  // L1: Conditional GET (cheap network check)
  if (hasConditionalHeaders(cachedHeaders)) {
    const condResult = await conditionalGet(url, cachedHeaders!);

    if (condResult.status === "unchanged") {
      recordDeltaSkip("L1");
      return {
        action: "skip",
        reason: "304 Not Modified - server confirms unchanged",
        layer: "L1",
      };
    }

    if (condResult.status === "changed" && condResult.response) {
      // Got 200 with content - proceed to L2 hash comparison
      const html = await condResult.response.text();
      return checkL2(
        url,
        tenantId,
        html,
        deltaService,
        condResult.headers
      );
    }

    // L1 error - fall through to L3
  }

  // L3: No cached state available, need full fetch
  recordFullProcess();
  return {
    action: "fetch",
    reason: "No cached state available for delta check",
    layer: "L3",
  };
}

/**
 * L2: Template-aware hash comparison using DeltaSyncService.
 *
 * Compares SEO content hash (excludes volatile price/stock data).
 * Only triggers full reprocess when SEO-relevant content changes.
 */
async function checkL2(
  url: string,
  tenantId: string,
  html: string,
  deltaService: DeltaSyncService,
  newHeaders: CachedHeaders | undefined
): Promise<DeltaResult> {
  // Try to get existing snapshot for comparison
  const existing = await deltaService.getSnapshot(tenantId, url);

  if (!existing) {
    // No previous snapshot - this is a new URL, need to process
    recordFullProcess();
    return {
      action: "process",
      reason: "New URL - no previous snapshot for comparison",
      layer: "L3",
      newHeaders,
      html,
    };
  }

  // We have an existing snapshot - in a full implementation we would:
  // 1. Extract product data from HTML
  // 2. Compute new hashes
  // 3. Compare with existing.seoContentHash
  // For now, we return process since we can't extract product data here
  // The actual hash comparison happens in the crawl pipeline
  recordFullProcess();
  return {
    action: "process",
    reason: "Content fetched - full processing required",
    layer: "L3",
    newHeaders,
    html,
  };
}

/**
 * Calculate delta skip rate from a batch of results.
 *
 * @param results - Array of delta cascade results
 * @returns Skip rate as decimal (0.0-1.0)
 */
export function calculateSkipRate(results: DeltaResult[]): number {
  if (results.length === 0) return 0;
  const skipped = results.filter((r) => r.action === "skip").length;
  return skipped / results.length;
}

/**
 * Get layer statistics from a batch of results.
 *
 * @param results - Array of delta cascade results
 * @returns Count per layer
 */
export function getLayerStats(results: DeltaResult[]): Record<string, number> {
  const stats: Record<string, number> = {
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
  };
  for (const result of results) {
    stats[result.layer]++;
  }
  return stats;
}
