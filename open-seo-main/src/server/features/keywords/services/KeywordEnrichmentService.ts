/**
 * KeywordEnrichmentService
 *
 * Batched DataForSEO enrichment with 7-day Redis cache.
 * Handles keyword metrics enrichment from DataForSEO API with:
 * - Batch processing (up to 1000 keywords per API call)
 * - 7-day Redis caching to reduce API costs
 * - Skip logic for CSV imports that already have metrics
 * - Cost tracking per batch
 * - Migration flag support for Phase 95 scraping infrastructure
 * - DfsCostTracker integration for cost attribution
 */

import { db } from "@/db";
import type { DbClient } from "@/db";
import {
  prospectKeywords,
  type ProspectKeywordSelect,
} from "@/db/prospect-keyword-schema";
import { redis } from "@/server/lib/redis";
import { fetchKeywordMetrics } from "@/server/lib/dataforseo";
import { CACHE_NS, safeJsonParse } from "@/server/lib/cache/cache-keys";
import { eq, inArray } from "drizzle-orm";
import {
  loadMigrationFlagsCached,
  shouldUseUnified,
} from "@/server/features/scraping/config";
import { getDfsCostTracker } from "@/server/features/scraping/providers/DfsCostTracker";

// Constants - exported for testing
export const CACHE_PREFIX = CACHE_NS.KEYWORD;
export const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const BATCH_SIZE = 1000;
export const COST_PER_KEYWORD_CENTS = 0.5; // $0.005 per keyword

// DataForSEO Labs API cost per keyword (in dollars)
// Based on search_volume/live endpoint pricing
export const DFS_COST_PER_KEYWORD = 0.005;

export interface EnrichmentResult {
  enriched: number;
  cached: number;
  skipped: number;
  failed: number;
  totalCostCents: number;
}

/**
 * Options for keyword enrichment with cost attribution.
 */
export interface EnrichmentOptions {
  /** Client ID for cost attribution */
  clientId?: string;
  /** Workspace ID for cost attribution */
  workspaceId?: string;
  /** Job ID for tracking (optional) */
  jobId?: string;
}

interface CachedMetrics {
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
}

export class KeywordEnrichmentService {
  private locationCode: number;
  private languageCode: string;
  private BATCH_SIZE = BATCH_SIZE;
  private dbClient: DbClient;

  constructor(locationCode: number = 2440, languageCode: string = "lt", dbClient: DbClient = db) {
    this.locationCode = locationCode;
    this.languageCode = languageCode;
    this.dbClient = dbClient;
  }

  /**
   * Estimate the DataForSEO cost for a batch of keywords.
   * Based on Labs API search_volume/live pricing.
   */
  estimateEnrichmentCost(keywordCount: number): number {
    return keywordCount * DFS_COST_PER_KEYWORD;
  }

  /**
   * Enrich keywords that need metrics.
   * - Checks migration flag (volumeRefresh) before API calls
   * - Checks Redis cache first (7-day TTL)
   * - Skips keywords with existing metrics from source
   * - Batches API calls (max 1000 per call)
   * - Tracks costs via DfsCostTracker for attribution
   */
  async enrichBatch(keywordIds: string[], options: EnrichmentOptions = {}): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
      enriched: 0,
      cached: 0,
      skipped: 0,
      failed: 0,
      totalCostCents: 0,
    };

    if (keywordIds.length === 0) {
      return result;
    }

    // Check migration flag for volumeRefresh feature
    const flags = loadMigrationFlagsCached();
    const useUnifiedPath = shouldUseUnified(flags.volumeRefresh);

    // If unified path is enabled, route through new infrastructure
    // For now, we continue with legacy path but add cost tracking
    // TODO: Implement unified path routing when TieredFetcher supports keyword enrichment
    if (useUnifiedPath) {
      // eslint-disable-next-line no-console
      console.info("[KeywordEnrichmentService] volumeRefresh flag set to unified - using legacy with tracking");
    }

    // Get cost tracker for attribution
    const costTracker = getDfsCostTracker(this.dbClient);

    // Fetch keywords from DB
    const keywords = await this.dbClient
      .select()
      .from(prospectKeywords)
      .where(inArray(prospectKeywords.id, keywordIds));

    // Separate by enrichment need
    const needsEnrichment: ProspectKeywordSelect[] = [];
    const fromCache: Array<ProspectKeywordSelect & CachedMetrics> = [];
    const skip: ProspectKeywordSelect[] = [];

    for (const kw of keywords) {
      // Skip if metrics already present from source (CSV with metrics)
      if (kw.searchVolume !== null && kw.source === "csv_upload") {
        skip.push(kw);
        continue;
      }

      // Check cache
      const cached = await this.getCached(kw.normalizedKeyword);
      if (cached) {
        fromCache.push({ ...kw, ...cached });
        continue;
      }

      needsEnrichment.push(kw);
    }

    // Update skipped
    result.skipped = skip.length;
    if (skip.length > 0) {
      await this.dbClient
        .update(prospectKeywords)
        .set({ enrichmentStatus: "skipped" })
        .where(
          inArray(
            prospectKeywords.id,
            skip.map((k) => k.id)
          )
        );
    }

    // Update cached - batch by grouping keywords with same metrics
    result.cached = fromCache.length;
    if (fromCache.length > 0) {
      // Group cached keywords by their metric values for batch updates
      const updateGroups = new Map<
        string,
        { ids: string[]; metrics: CachedMetrics }
      >();
      const enrichedAt = new Date();

      for (const kw of fromCache) {
        const key = `${kw.searchVolume}|${kw.keywordDifficulty}|${kw.cpc}|${kw.competition}`;
        if (!updateGroups.has(key)) {
          updateGroups.set(key, {
            ids: [],
            metrics: {
              searchVolume: kw.searchVolume,
              keywordDifficulty: kw.keywordDifficulty,
              cpc: kw.cpc,
              competition: kw.competition,
            },
          });
        }
        updateGroups.get(key)!.ids.push(kw.id);
      }

      // Execute batch updates - one query per unique metric combination
      for (const { ids, metrics } of updateGroups.values()) {
        await this.dbClient
          .update(prospectKeywords)
          .set({
            searchVolume: metrics.searchVolume,
            keywordDifficulty: metrics.keywordDifficulty,
            cpc: metrics.cpc,
            competition: metrics.competition,
            enrichmentStatus: "cached",
            enrichedAt,
          })
          .where(inArray(prospectKeywords.id, ids));
      }
    }

    // Batch API calls with cost tracking
    const batches = this.chunkArray(needsEnrichment, this.BATCH_SIZE);
    for (const batch of batches) {
      const batchStartTime = Date.now();
      const keywordStrings = batch.map((k) => k.normalizedKeyword);
      const estimatedCost = this.estimateEnrichmentCost(batch.length);

      try {
        const metrics = await fetchKeywordMetrics(
          keywordStrings,
          this.locationCode,
          this.languageCode
        );

        // Record successful cost
        await costTracker.recordCost({
          url: `keyword-enrichment:batch:${batch.length}`,
          domain: "labs-api",
          mode: "basic",
          usedStandardQueue: false,
          estimatedCost,
          actualCost: estimatedCost,
          success: true,
          responseTimeMs: Date.now() - batchStartTime,
          clientId: options.clientId,
          workspaceId: options.workspaceId,
          jobId: options.jobId,
        });

        // Map metrics to keywords
        const metricsMap = new Map(
          metrics.map((m) => [m.keyword.toLowerCase(), m])
        );

        // Separate enriched and failed keywords for batch processing
        const enrichedKeywords: Array<{
          id: string;
          normalizedKeyword: string;
          metrics: CachedMetrics;
        }> = [];
        const failedIds: string[] = [];

        for (const kw of batch) {
          const metric = metricsMap.get(kw.normalizedKeyword);
          if (metric) {
            enrichedKeywords.push({
              id: kw.id,
              normalizedKeyword: kw.normalizedKeyword,
              metrics: {
                searchVolume: metric.searchVolume,
                keywordDifficulty: metric.competition * 100, // Convert to 0-100 scale
                cpc: metric.cpc,
                competition: metric.competition,
              },
            });
          } else {
            failedIds.push(kw.id);
          }
        }

        // Batch update failed keywords
        if (failedIds.length > 0) {
          await this.dbClient
            .update(prospectKeywords)
            .set({ enrichmentStatus: "failed" })
            .where(inArray(prospectKeywords.id, failedIds));
          result.failed += failedIds.length;
        }

        // Batch update enriched keywords - group by same metric values
        if (enrichedKeywords.length > 0) {
          const enrichedAt = new Date();
          const updateGroups = new Map<
            string,
            { ids: string[]; metrics: CachedMetrics }
          >();

          for (const kw of enrichedKeywords) {
            const key = `${kw.metrics.searchVolume}|${kw.metrics.keywordDifficulty}|${kw.metrics.cpc}|${kw.metrics.competition}`;
            if (!updateGroups.has(key)) {
              updateGroups.set(key, { ids: [], metrics: kw.metrics });
            }
            updateGroups.get(key)!.ids.push(kw.id);
          }

          // Execute batch updates - one query per unique metric combination
          for (const { ids, metrics: m } of updateGroups.values()) {
            await this.dbClient
              .update(prospectKeywords)
              .set({
                searchVolume: m.searchVolume,
                keywordDifficulty: m.keywordDifficulty,
                cpc: m.cpc,
                competition: m.competition,
                enrichmentStatus: "enriched",
                enrichmentCostCents: COST_PER_KEYWORD_CENTS,
                enrichedAt,
              })
              .where(inArray(prospectKeywords.id, ids));
          }

          // Cache all results (parallel for performance)
          await Promise.all(
            enrichedKeywords.map((kw) =>
              this.setCache(kw.normalizedKeyword, kw.metrics)
            )
          );

          result.enriched += enrichedKeywords.length;
        }

        result.totalCostCents += batch.length * COST_PER_KEYWORD_CENTS;
      } catch (error) {
        // Log the error for debugging before marking batch as failed
        // eslint-disable-next-line no-console
        console.error("[KeywordEnrichmentService] Batch enrichment failed", {
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });

        // Record failed cost
        await costTracker.recordCost({
          url: `keyword-enrichment:batch:${batch.length}`,
          domain: "labs-api",
          mode: "basic",
          usedStandardQueue: false,
          estimatedCost,
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          responseTimeMs: Date.now() - batchStartTime,
          clientId: options.clientId,
          workspaceId: options.workspaceId,
          jobId: options.jobId,
        });

        // Mark entire batch as failed on error
        await this.dbClient
          .update(prospectKeywords)
          .set({ enrichmentStatus: "failed" })
          .where(
            inArray(
              prospectKeywords.id,
              batch.map((k) => k.id)
            )
          );
        result.failed += batch.length;
      }
    }

    return result;
  }

  private async getCached(keyword: string): Promise<CachedMetrics | null> {
    const key = `${CACHE_PREFIX}${keyword}`;
    const cached = await redis.get(key);
    if (cached) {
      const data = safeJsonParse<CachedMetrics>(cached, key);
      if (!data) {
        // Corrupted cache - delete and treat as miss
        await redis.del(key);
        return null;
      }
      return data;
    }
    return null;
  }

  private async setCache(keyword: string, metrics: CachedMetrics): Promise<void> {
    const key = `${CACHE_PREFIX}${keyword}`;
    await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(metrics));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const keywordEnrichmentService = new KeywordEnrichmentService();
