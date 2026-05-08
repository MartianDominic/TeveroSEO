/**
 * QuickCheckService
 *
 * No-workspace keyword validation with Redis caching and share links.
 * Enables instant keyword checking without creating a prospect/workspace.
 *
 * Features:
 * - Check 1-20 keywords instantly
 * - 7-day Redis cache to minimize API costs
 * - Shareable links (30-day TTL) for public access
 */

import { nanoid } from "nanoid";
import { redis } from "@/server/lib/redis";
import { fetchKeywordMetrics } from "@/server/lib/dataforseo";
import { CACHE_NS, safeJsonParse } from "@/server/lib/cache/cache-keys";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { getDfsCostTracker } from "@/server/features/scraping/providers/DfsCostTracker";
import { getLabsCost } from "@/server/features/scraping/cost";

const log = createLogger({ module: "quick-check-service" });

// Pseudo-client ID for anonymous/quick checks
const QUICK_CHECK_CLIENT_ID = "system:quick-check";

// DataForSEO Labs API cost per keyword (from centralized pricing)
const DFS_COST_PER_KEYWORD = getLabsCost("keywordMetrics");

// Constants
const MAX_KEYWORDS = 20;
const CACHE_PREFIX = CACHE_NS.KEYWORD;
const SHARE_PREFIX = CACHE_NS.QUICK_CHECK_SHARE;
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SHARE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const COST_PER_KEYWORD_CENTS = 0.5; // $0.005 per keyword

export interface QuickCheckKeyword {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
  competitionLevel: "low" | "medium" | "high";
}

export interface QuickCheckResult {
  keywords: QuickCheckKeyword[];
  totalVolume: number;
  costCents: number;
  cached: number;
  enriched: number;
}

export interface ShareableResult {
  token: string;
  shareUrl: string;
  expiresAt: Date;
}

interface CachedMetrics {
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
}

export interface QuickCheckOptions {
  /** Client ID for cost attribution (uses system:quick-check if not provided) */
  clientId?: string;
}

export class QuickCheckService {
  private locationCode: number;
  private languageCode: string;

  constructor(locationCode: number = 2440, languageCode: string = "lt") {
    this.locationCode = locationCode;
    this.languageCode = languageCode;
  }

  /**
   * Record cost to DfsCostTracker (fire-and-forget pattern).
   * Non-blocking - errors are caught silently to avoid disrupting the main flow.
   */
  private recordCostFireAndForget(
    keywordCount: number,
    success: boolean,
    responseTimeMs: number,
    clientId: string,
    errorMessage?: string
  ): void {
    const estimatedCost = keywordCount * DFS_COST_PER_KEYWORD;
    const costTracker = getDfsCostTracker(db);

    // Fire-and-forget: don't await, catch errors silently
    costTracker
      .recordCost({
        url: `quick-check:keywords:${keywordCount}`,
        domain: "labs-api",
        mode: "basic",
        usedStandardQueue: false,
        estimatedCost,
        actualCost: success ? estimatedCost : undefined,
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
   * Check 1-20 keywords instantly without creating a workspace.
   * Uses Redis cache to minimize API calls.
   * Tracks costs via DfsCostTracker for budget monitoring.
   */
  async checkKeywords(keywords: string[], options: QuickCheckOptions = {}): Promise<QuickCheckResult> {
    // Validate input
    if (keywords.length === 0) {
      throw new Error("At least one keyword is required");
    }
    if (keywords.length > MAX_KEYWORDS) {
      throw new Error(`Maximum ${MAX_KEYWORDS} keywords allowed`);
    }

    // Use provided clientId or fall back to pseudo-client for anonymous checks
    const clientId = options.clientId ?? QUICK_CHECK_CLIENT_ID;

    // Normalize and dedupe
    const normalizedKeywords = [
      ...new Set(keywords.map((k) => k.toLowerCase().trim())),
    ];

    const result: QuickCheckResult = {
      keywords: [],
      totalVolume: 0,
      costCents: 0,
      cached: 0,
      enriched: 0,
    };

    // Check cache first
    const needsEnrichment: string[] = [];
    const cachedResults: QuickCheckKeyword[] = [];

    for (const keyword of normalizedKeywords) {
      const cached = await this.getCached(keyword);
      if (cached) {
        cachedResults.push({
          keyword,
          searchVolume: cached.searchVolume,
          keywordDifficulty: cached.keywordDifficulty,
          cpc: cached.cpc,
          competition: cached.competition,
          competitionLevel: this.getCompetitionLevel(cached.competition),
        });
        result.cached++;
      } else {
        needsEnrichment.push(keyword);
      }
    }

    // Fetch from API
    if (needsEnrichment.length > 0) {
      const startTime = Date.now();
      try {
        const metrics = await fetchKeywordMetrics(
          needsEnrichment,
          this.locationCode,
          this.languageCode
        );

        const responseTimeMs = Date.now() - startTime;

        // Track cost via DfsCostTracker (fire-and-forget)
        this.recordCostFireAndForget(
          needsEnrichment.length,
          true,
          responseTimeMs,
          clientId
        );

        const metricsMap = new Map(
          metrics.map((m) => [m.keyword.toLowerCase(), m])
        );

        for (const keyword of needsEnrichment) {
          const metric = metricsMap.get(keyword);
          if (metric) {
            const keywordDifficulty = metric.competition * 100;
            const enrichedKw: QuickCheckKeyword = {
              keyword: metric.keyword,
              searchVolume: metric.searchVolume,
              keywordDifficulty,
              cpc: metric.cpc,
              competition: metric.competition,
              competitionLevel: this.getCompetitionLevel(metric.competition),
            };

            // Cache result
            await this.setCache(keyword, {
              searchVolume: metric.searchVolume,
              keywordDifficulty,
              cpc: metric.cpc,
              competition: metric.competition,
            });

            result.keywords.push(enrichedKw);
            result.enriched++;
          }
        }

        // Cost: $0.005 per keyword
        result.costCents = needsEnrichment.length * COST_PER_KEYWORD_CENTS;
      } catch (error) {
        const responseTimeMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Track failed cost via DfsCostTracker (fire-and-forget)
        this.recordCostFireAndForget(
          needsEnrichment.length,
          false,
          responseTimeMs,
          clientId,
          errorMessage
        );

        log.error("Quick check API error", error instanceof Error ? error : new Error(String(error)));
        throw new Error("Failed to fetch keyword metrics");
      }
    }

    // Combine cached and enriched
    result.keywords = [...cachedResults, ...result.keywords];
    result.totalVolume = result.keywords.reduce(
      (sum, k) => sum + k.searchVolume,
      0
    );

    return result;
  }

  /**
   * Generate a shareable link for quick check results.
   * Link expires in 30 days.
   */
  async generateShareLink(result: QuickCheckResult): Promise<ShareableResult> {
    const token = nanoid(16);
    const key = `${SHARE_PREFIX}${token}`;
    const expiresAt = new Date(Date.now() + SHARE_TTL_SECONDS * 1000);

    await redis.setex(
      key,
      SHARE_TTL_SECONDS,
      JSON.stringify({
        result,
        createdAt: new Date().toISOString(),
      })
    );

    return {
      token,
      shareUrl: `/share/quick-check/${token}`,
      expiresAt,
    };
  }

  /**
   * Retrieve shared results by token.
   */
  async getSharedResults(token: string): Promise<QuickCheckResult | null> {
    const key = `${SHARE_PREFIX}${token}`;
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    const parsed = safeJsonParse<{ result: QuickCheckResult }>(cached, key);
    if (!parsed) {
      // Corrupted share link - delete it
      await redis.del(key);
      return null;
    }

    return parsed.result;
  }

  private getCompetitionLevel(competition: number): "low" | "medium" | "high" {
    if (competition <= 0.33) return "low";
    if (competition <= 0.66) return "medium";
    return "high";
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

  private async setCache(keyword: string, data: CachedMetrics): Promise<void> {
    const key = `${CACHE_PREFIX}${keyword}`;
    await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(data));
  }
}

export const quickCheckService = new QuickCheckService();
