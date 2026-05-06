/**
 * GscBridgeService
 * Phase 84-01 Task 3: GSC bridge for client path
 *
 * HTTP bridge to AI-Writer GSC service for fetching ranking data.
 * Only available for /clients/:id path (not prospects).
 *
 * Features:
 * - Calls AI-Writer endpoint: POST /api/gsc/search-analytics
 * - 1-hour cache to avoid GSC API quota issues
 * - Rate limited (100 calls/day/client)
 * - Graceful error handling
 *
 * Security:
 * - T-84-01: Verify client ownership via Clerk context (caller responsibility)
 * - T-84-03: Never expose GSC credentials in response
 * - T-84-05: Only /clients/:id path gets GSC access
 */

import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "gsc-bridge-service" });

// Phase 91: Extended from 1h to 6h — GSC data has 2-3 day processing latency anyway
const CACHE_TTL_SECONDS = 6 * 60 * 60;

// Rate limit: 100 calls per day per client
const RATE_LIMIT_PER_DAY = 100;

/**
 * Query parameters for GSC search analytics.
 */
export interface GscQuery {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}

/**
 * Ranking data returned from GSC.
 */
export interface GscRankingData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Client GSC credentials status.
 */
export interface GscCredentialsStatus {
  siteUrl: string | null;
  hasCredentials: boolean;
  lastSync?: string;
}

/**
 * Raw GSC API response row.
 */
interface GscApiRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * GscBridgeService - HTTP bridge to AI-Writer GSC service.
 */
export class GscBridgeService {
  private aiWriterUrl: string;

  constructor(aiWriterUrl?: string) {
    this.aiWriterUrl =
      aiWriterUrl ?? process.env.AI_WRITER_URL ?? "http://localhost:8000";
  }

  /**
   * Fetch ranking data from AI-Writer GSC service.
   *
   * @param clientId - Client ID for rate limiting and caching
   * @param query - GSC query parameters
   * @returns Array of ranking data or empty array on error
   */
  async fetchRankings(
    clientId: string,
    query: GscQuery
  ): Promise<GscRankingData[]> {
    // Check cache first
    const cacheKey = this.buildCacheKey(clientId, query);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      log.debug("GSC data served from cache", { clientId, cacheKey });
      return cached;
    }

    // Check rate limit
    const withinLimit = await this.checkRateLimit(clientId);
    if (!withinLimit) {
      log.warn("GSC rate limit exceeded", { clientId });
      return [];
    }

    try {
      const response = await fetch(`${this.aiWriterUrl}/api/gsc/search-analytics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Client credentials are stored in AI-Writer, passed via clientId
          "X-Client-Id": clientId,
        },
        body: JSON.stringify({
          site_url: query.siteUrl,
          start_date: query.startDate,
          end_date: query.endDate,
          dimensions: query.dimensions ?? ["query"],
          row_limit: query.rowLimit ?? 1000,
        }),
      });

      if (!response.ok) {
        log.warn("GSC API request failed", {
          clientId,
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = (await response.json()) as { rows?: GscApiRow[] };
      const rows: GscApiRow[] = data.rows ?? [];

      // Transform to our format
      const rankings: GscRankingData[] = rows.map((row) => ({
        query: row.keys[0] ?? "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));

      // Cache results
      await this.setCache(cacheKey, rankings);

      // Increment rate limit counter
      await this.incrementRateLimit(clientId);

      log.info("GSC rankings fetched successfully", {
        clientId,
        count: rankings.length,
      });

      return rankings;
    } catch (error) {
      log.error(
        "GSC fetch failed",
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Check if client has GSC credentials configured.
   *
   * @param clientId - Client ID to check
   * @returns Credentials status
   */
  async getClientGscCredentials(clientId: string): Promise<GscCredentialsStatus> {
    try {
      const response = await fetch(
        `${this.aiWriterUrl}/api/clients/${clientId}/gsc-status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        return {
          siteUrl: null,
          hasCredentials: false,
        };
      }

      const data = (await response.json()) as {
        site_url?: string;
        has_credentials?: boolean;
        last_sync?: string;
      };

      return {
        siteUrl: data.site_url ?? null,
        hasCredentials: !!data.has_credentials,
        lastSync: data.last_sync,
      };
    } catch (error) {
      log.error(
        "Failed to check GSC credentials",
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        siteUrl: null,
        hasCredentials: false,
      };
    }
  }

  /**
   * Build cache key for GSC query.
   */
  private buildCacheKey(clientId: string, query: GscQuery): string {
    const queryHash = Buffer.from(
      `${query.siteUrl}:${query.startDate}:${query.endDate}:${query.dimensions?.join(",") ?? "query"}`
    )
      .toString("base64")
      .slice(0, 32);

    return `gsc:${clientId}:${queryHash}`;
  }

  /**
   * Get data from cache.
   */
  private async getFromCache(key: string): Promise<GscRankingData[] | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as GscRankingData[];
      }
    } catch (error) {
      log.debug("Cache read failed", { key });
    }
    return null;
  }

  /**
   * Set data in cache with TTL.
   */
  private async setCache(key: string, data: GscRankingData[]): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(data), "EX", CACHE_TTL_SECONDS);
    } catch (error) {
      log.debug("Cache write failed", { key });
    }
  }

  /**
   * Check if client is within daily rate limit.
   */
  private async checkRateLimit(clientId: string): Promise<boolean> {
    try {
      const key = `gsc:ratelimit:${clientId}:${this.getTodayKey()}`;
      const count = await redis.get(key);
      return !count || parseInt(count, 10) < RATE_LIMIT_PER_DAY;
    } catch {
      // On error, allow the request (fail open for better UX)
      return true;
    }
  }

  /**
   * Increment rate limit counter.
   */
  private async incrementRateLimit(clientId: string): Promise<void> {
    try {
      const key = `gsc:ratelimit:${clientId}:${this.getTodayKey()}`;
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, 86400); // 24 hours
      await pipeline.exec();
    } catch {
      // Rate limit tracking failure is non-critical
    }
  }

  /**
   * Get today's date key for rate limiting.
   */
  private getTodayKey(): string {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Factory function to create GscBridgeService instance.
 *
 * @param aiWriterUrl - Optional custom AI-Writer URL
 * @returns New GscBridgeService instance
 */
export function createGscBridge(aiWriterUrl?: string): GscBridgeService {
  return new GscBridgeService(aiWriterUrl);
}

/**
 * Default singleton instance.
 */
let defaultInstance: GscBridgeService | null = null;

/**
 * Get the default GscBridgeService singleton.
 */
export function getGscBridge(): GscBridgeService {
  if (!defaultInstance) {
    defaultInstance = new GscBridgeService();
  }
  return defaultInstance;
}
