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
import { enqueueGraphIngestion } from "@/server/queues/graphIngestionQueue";

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
 * H64-01 Fix: Implements actual SEO content hash comparison.
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

  // H64-01: Extract SEO content from HTML and compute hash
  const seoContent = extractSeoContentFromHtml(html);
  const newSeoHash = computeSeoContentHash(seoContent);

  // Compare with stored hash
  if (existing.seoContentHash === newSeoHash) {
    recordDeltaSkip("L2");
    return {
      action: "skip",
      reason: "L2 SEO content hash unchanged",
      layer: "L2",
    };
  }

  // SEO content changed - needs full reprocessing
  recordFullProcess();
  return {
    action: "process",
    reason: "L2 SEO content hash changed - reprocessing required",
    layer: "L3",
    newHeaders,
    html,
  };
}

/**
 * SEO content extracted from HTML for hash comparison.
 */
interface SeoContent {
  title: string;
  metaDescription: string;
  h1: string;
  canonical: string;
  structuredData: string;
}

/**
 * Extract SEO-relevant content from HTML for L2 hash comparison.
 *
 * Focuses on elements that affect SEO ranking:
 * - Title tag
 * - Meta description
 * - H1 heading
 * - Canonical URL
 * - Structured data (JSON-LD)
 */
function extractSeoContentFromHtml(html: string): SeoContent {
  // Use regex for lightweight extraction (no DOM parser needed)
  // This is intentionally simple - complex extraction happens in full processing

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? "";

  const metaDescMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i
  );
  const metaDescription = metaDescMatch?.[1]?.trim() ?? "";

  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  const h1 = h1Match?.[1]?.trim() ?? "";

  const canonicalMatch = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i
  ) || html.match(
    /<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i
  );
  const canonical = canonicalMatch?.[1]?.trim() ?? "";

  // Extract JSON-LD structured data
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  const structuredDataParts: string[] = [];
  for (const match of jsonLdMatches) {
    if (match[1]) {
      structuredDataParts.push(match[1].trim());
    }
  }
  const structuredData = structuredDataParts.join("|");

  return {
    title,
    metaDescription,
    h1,
    canonical,
    structuredData,
  };
}

/**
 * Compute hash of SEO content for comparison.
 *
 * Uses the same hashing approach as DeltaSyncService for consistency.
 */
function computeSeoContentHash(content: SeoContent): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  const parts = [
    content.title,
    content.metaDescription,
    content.h1,
    content.canonical,
    content.structuredData,
  ];
  return createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Trigger GraphRAG ingestion for a processed page.
 *
 * Per HIGH-INT-03: Connects crawling results to GraphRAG ingestion.
 * Called after successful L3 processing to extract entities and update graph.
 *
 * @param tenantId - Tenant ID for data isolation
 * @param url - Source URL of the crawled page
 * @param html - HTML content of the page
 * @returns Job ID of the enqueued ingestion job
 */
export async function triggerGraphIngestion(
  tenantId: string,
  url: string,
  html: string
): Promise<string> {
  return enqueueGraphIngestion({
    tenantId,
    url,
    html,
    crawledAt: Date.now(),
  });
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
