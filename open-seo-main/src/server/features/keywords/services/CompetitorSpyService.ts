/**
 * CompetitorSpyService
 * Phase 95-10: Consumer Integration Completion
 *
 * Extract top keywords for competitor domains with caching.
 * Enables competitive intelligence without requiring a prospect.
 *
 * Features:
 * - Fetch top 100 keywords for any domain
 * - 24-hour Redis cache to reduce API costs
 * - Traffic estimation based on position and volume
 * - Compare multiple competitors side by side
 * - Page content fetching through MigrationRouter (Phase 95-10)
 * - Labs API cost tracking via DfsCostTracker
 */

import { fetchOrganicKeywords } from "@/server/lib/dataforseo-organic";
import { redis } from "@/server/lib/redis";
import { CACHE_NS, safeJsonParse } from "@/server/lib/cache/cache-keys";
import { createLogger } from "@/server/lib/logger";
import { routeRequest, scrapingService } from "@/server/features/scraping";
import type { ScrapeResult } from "@/server/features/scraping";
import type { ConsumerAdapter, ComparisonResult } from "@/server/features/scraping/migration/adapters/types";
import { db } from "@/db";
import { getDfsCostTracker } from "@/server/features/scraping/providers/DfsCostTracker";
import { getLabsCost } from "@/server/features/scraping/cost";

const log = createLogger({ module: "competitor-spy-service" });

// Constants
const CACHE_PREFIX = CACHE_NS.COMPETITOR_SPY;
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const DEFAULT_LIMIT = 100;
const COST_PER_DOMAIN_CENTS = 2; // $0.02 per domain
// Labs API cost per domain from centralized pricing ($0.002/query)
const LABS_API_COST_USD = getLabsCost("rankedKeywords");

// =============================================================================
// Page Fetch Types (for MigrationRouter integration)
// =============================================================================

export interface CompetitorPageInput {
  url: string;
  domain: string;
  clientId?: string;
}

export interface CompetitorPageOutput {
  url: string;
  html: string;
  title?: string;
  metaDescription?: string;
  success: boolean;
  fetchedAt: Date;
}

/**
 * Adapter for CompetitorSpy page fetching through MigrationRouter.
 */
const competitorSpyPageAdapter: ConsumerAdapter<CompetitorPageInput, CompetitorPageOutput> = {
  feature: "competitorSpy",

  toScrapeOptions(input: CompetitorPageInput) {
    return {
      url: input.url,
      feature: "competitorSpy" as const,
      includeHtml: true,
      includeParsedData: true,
      clientId: input.clientId,
    };
  },

  toConsumerOutput(result: ScrapeResult, input: CompetitorPageInput): CompetitorPageOutput {
    return {
      url: input.url,
      html: result.html ?? "",
      title: result.parsedData?.title,
      metaDescription: result.parsedData?.metaDescription,
      success: result.success,
      fetchedAt: new Date(),
    };
  },

  compareOutputs(legacy: CompetitorPageOutput, adapted: CompetitorPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    if (legacy.success !== adapted.success) {
      differences.push({ field: "success", legacy: legacy.success, new: adapted.success });
    }

    // Compare HTML lengths (exact match not expected due to different fetchers)
    const legacyLen = legacy.html?.length ?? 0;
    const adaptedLen = adapted.html?.length ?? 0;
    if (Math.abs(legacyLen - adaptedLen) / Math.max(legacyLen, 1) > 0.2) {
      differences.push({ field: "htmlLength", legacy: legacyLen, new: adaptedLen });
    }

    return { match: differences.length === 0, differences };
  },
};

export interface CompetitorKeyword {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc: number;
  url: string;
  trafficShare: number;
}

export interface CompetitorSpyResult {
  domain: string;
  keywords: CompetitorKeyword[];
  totalKeywords: number;
  estimatedTraffic: number;
  costCents: number;
  cached: boolean;
}

interface CachedResult {
  domain: string;
  keywords: CompetitorKeyword[];
  totalKeywords: number;
  estimatedTraffic: number;
}

export class CompetitorSpyService {
  private locationCode: number;
  private languageCode: string;

  constructor(locationCode: number = 2440, languageCode: string = "lt") {
    this.locationCode = locationCode;
    this.languageCode = languageCode;
  }

  /**
   * Record Labs API cost to DfsCostTracker (fire-and-forget pattern).
   * Non-blocking - errors are caught silently to avoid disrupting the main flow.
   */
  private recordLabsCostFireAndForget(
    domain: string,
    success: boolean,
    responseTimeMs: number,
    clientId?: string,
    errorMessage?: string
  ): void {
    const costTracker = getDfsCostTracker(db);

    // Fire-and-forget: don't await, catch errors silently
    costTracker
      .recordCost({
        url: `labs:ranked_keywords:${domain}`,
        domain,
        mode: "basic", // Labs API doesn't have JS/browser modes
        usedStandardQueue: false, // Labs API uses live endpoint
        estimatedCost: LABS_API_COST_USD,
        actualCost: success ? LABS_API_COST_USD : undefined,
        success,
        responseTimeMs,
        clientId,
        errorMessage,
      })
      .catch(() => {
        // Silently ignore - cost tracking is non-blocking
      });
  }

  /**
   * Extract top keywords for a competitor domain.
   * Results cached for 24 hours.
   */
  async spyOnCompetitor(
    domain: string,
    limit: number = DEFAULT_LIMIT
  ): Promise<CompetitorSpyResult> {
    // Normalize domain
    const normalizedDomain = this.normalizeDomain(domain);

    // Check cache
    const cacheKey = `${CACHE_PREFIX}${normalizedDomain}:${limit}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const cachedResult = safeJsonParse<CachedResult>(cached, cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true,
          costCents: 0,
        };
      }
      // Corrupted cache - delete and fetch fresh
      await redis.del(cacheKey);
    }

    // Fetch from DataForSEO
    const startTime = Date.now();
    try {
      const organicKeywords = await fetchOrganicKeywords(
        normalizedDomain,
        this.locationCode,
        this.languageCode,
        limit
      );

      const responseTimeMs = Date.now() - startTime;

      // Track Labs API cost (fire-and-forget)
      this.recordLabsCostFireAndForget(
        normalizedDomain,
        true,
        responseTimeMs
      );

      // Transform to CompetitorKeyword format
      const keywords: CompetitorKeyword[] = organicKeywords
        .map((kw) => ({
          keyword: kw.keyword,
          position: kw.position,
          searchVolume: kw.searchVolume,
          cpc: kw.cpc || 0,
          url: kw.url || "",
          trafficShare: this.estimateTrafficShare(kw.position, kw.searchVolume),
        }))
        .sort((a, b) => b.searchVolume - a.searchVolume);

      const estimatedTraffic = keywords.reduce(
        (sum, k) => sum + k.trafficShare,
        0
      );

      const result: CompetitorSpyResult = {
        domain: normalizedDomain,
        keywords,
        totalKeywords: keywords.length,
        estimatedTraffic: Math.round(estimatedTraffic),
        costCents: COST_PER_DOMAIN_CENTS,
        cached: false,
      };

      // Cache result
      const cacheData: CachedResult = {
        domain: result.domain,
        keywords: result.keywords,
        totalKeywords: result.totalKeywords,
        estimatedTraffic: result.estimatedTraffic,
      };
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(cacheData));

      return result;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track failed request cost (fire-and-forget)
      this.recordLabsCostFireAndForget(
        normalizedDomain,
        false,
        responseTimeMs,
        undefined,
        errorMessage
      );

      log.error("Competitor spy error", error instanceof Error ? error : new Error(String(error)), { domain: normalizedDomain });
      throw new Error(`Failed to fetch keywords for ${normalizedDomain}`);
    }
  }

  /**
   * Compare multiple competitors side by side.
   */
  async compareCompetitors(domains: string[]): Promise<CompetitorSpyResult[]> {
    const results = await Promise.all(
      domains.map((domain) => this.spyOnCompetitor(domain))
    );
    return results;
  }

  /**
   * Fetch a competitor page's HTML content.
   * Routes through MigrationRouter for unified scraping infrastructure.
   *
   * @param url - URL to fetch
   * @param options - Fetch options including clientId for cost tracking
   * @returns Page content with metadata
   */
  async fetchCompetitorPage(
    url: string,
    options: { clientId?: string } = {}
  ): Promise<CompetitorPageOutput> {
    const domain = this.normalizeDomain(url);
    const input: CompetitorPageInput = {
      url,
      domain,
      clientId: options.clientId,
    };

    // Legacy fallback function for direct fetch
    const legacyFn = async (): Promise<CompetitorPageOutput> => {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; TeveroSEO/1.0)",
          },
          signal: AbortSignal.timeout(30000),
        });
        const html = await response.text();

        // Extract basic metadata
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const metaMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
        );

        return {
          url,
          html,
          title: titleMatch?.[1]?.trim(),
          metaDescription: metaMatch?.[1]?.trim(),
          success: response.ok,
          fetchedAt: new Date(),
        };
      } catch (error) {
        log.error("Legacy fetch failed", error instanceof Error ? error : new Error(String(error)), { url });
        return {
          url,
          html: "",
          success: false,
          fetchedAt: new Date(),
        };
      }
    };

    // Route through MigrationRouter
    return routeRequest({
      feature: "competitorSpy",
      input,
      legacyFn,
      adapter: competitorSpyPageAdapter,
    });
  }

  /**
   * Fetch multiple competitor pages in batch.
   * Uses ScrapingService.scrapeBatch for efficient parallel fetching.
   *
   * @param urls - URLs to fetch
   * @param options - Fetch options
   * @returns Map of URL to page content
   */
  async fetchCompetitorPages(
    urls: string[],
    options: { clientId?: string; concurrency?: number } = {}
  ): Promise<Map<string, CompetitorPageOutput>> {
    const results = new Map<string, CompetitorPageOutput>();

    // Use ScrapingService batch method directly for efficiency
    const batchResult = await scrapingService.scrapeBatch(urls, {
      feature: "competitorSpy",
      clientId: options.clientId,
      concurrency: options.concurrency ?? 5,
      includeHtml: true,
      includeParsedData: true,
    });

    for (const result of batchResult.results) {
      results.set(result.url, {
        url: result.url,
        html: result.html ?? "",
        title: result.parsedData?.title,
        metaDescription: result.parsedData?.metaDescription,
        success: result.success,
        fetchedAt: new Date(),
      });
    }

    log.info("Batch competitor pages fetched", {
      urlCount: urls.length,
      successCount: batchResult.results.filter(r => r.success).length,
      totalCostUsd: batchResult.totalCostUsd,
    });

    return results;
  }

  /**
   * Normalize domain input.
   * Strips protocol, paths, and converts to lowercase.
   */
  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");
  }

  /**
   * Estimate traffic share based on position and volume.
   * CTR model: pos 1 = 28%, pos 2 = 15%, pos 3 = 11%, etc.
   */
  private estimateTrafficShare(position: number, volume: number): number {
    const ctrByPosition: Record<number, number> = {
      1: 0.28,
      2: 0.15,
      3: 0.11,
      4: 0.08,
      5: 0.06,
      6: 0.045,
      7: 0.035,
      8: 0.03,
      9: 0.025,
      10: 0.02,
    };

    const ctr = ctrByPosition[position] || (position <= 20 ? 0.01 : 0.005);
    return volume * ctr;
  }
}

export const competitorSpyService = new CompetitorSpyService();
