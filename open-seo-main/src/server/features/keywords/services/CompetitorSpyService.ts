/**
 * CompetitorSpyService
 *
 * Extract top keywords for competitor domains with caching.
 * Enables competitive intelligence without requiring a prospect.
 *
 * Features:
 * - Fetch top 100 keywords for any domain
 * - 24-hour Redis cache to reduce API costs
 * - Traffic estimation based on position and volume
 * - Compare multiple competitors side by side
 */

import { fetchOrganicKeywords } from "@/server/lib/dataforseo-organic";
import { redis } from "@/server/lib/redis";
import { CACHE_NS, safeJsonParse } from "@/server/lib/cache/cache-keys";

// Constants
const CACHE_PREFIX = CACHE_NS.COMPETITOR_SPY;
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const DEFAULT_LIMIT = 100;
const COST_PER_DOMAIN_CENTS = 2; // $0.02 per domain

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
    try {
      const organicKeywords = await fetchOrganicKeywords(
        normalizedDomain,
        this.locationCode,
        this.languageCode,
        limit
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
      console.error("Competitor spy error:", error);
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
