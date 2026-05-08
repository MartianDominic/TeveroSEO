/**
 * StrikingDistanceService
 * Phase 96-03: Quick Win Opportunity Detection
 * DATA-01, DATA-07 FIX: Unified cache with freshness metadata
 *
 * Identifies pages ranking on page 2 (positions 11-20) that could
 * capture significant traffic with minor optimization.
 *
 * Difficulty based on position gap to page 1:
 * - Easy (11-13): 8-10 positions to climb
 * - Medium (14-17): 4-7 positions to climb
 * - Hard (18-20): 1-3 positions to climb (but furthest from page 1)
 *
 * NOTE: Uses shared CtrBenchmarkCalculator for consistent CTR benchmarks.
 * Returns cache metadata for UI freshness indicators.
 */
import { sql } from 'drizzle-orm';
import { db, type DbClient } from '@/db';
import type { StrikingDistancePage, StrikingDistanceFilters, StrikingDistanceResult } from '../types';
import { format, subDays } from 'date-fns';
import { createLogger } from '@/server/lib/logger';
import { getExpectedCtr } from '../utils/ctr-benchmark-calculator';
import {
  getAnalyticsCache,
  wrapWithMetadata,
  type CachedData,
} from '@/server/cache';

const logger = createLogger({ module: 'striking-distance-service' });

export class StrikingDistanceService {
  private cache = getAnalyticsCache();

  constructor(private db: DbClient) {}

  /**
   * Get pages in striking distance (positions 11-20).
   * Returns data with cache metadata for UI freshness indicators.
   *
   * @param siteId - Site UUID
   * @param filters - Striking distance filters
   * @param workspaceId - Workspace UUID (required for caching)
   * @param options - Optional cache behavior settings
   */
  async getStrikingDistancePages(
    siteId: string,
    filters: StrikingDistanceFilters = {},
    workspaceId?: string,
    options: { skipCache?: boolean } = {}
  ): Promise<CachedData<StrikingDistanceResult>> {
    const {
      minPosition = 11,
      maxPosition = 20,
      minImpressions = 50,
      targetPosition = 3,
      limit = 100,
    } = filters;

    // Build cache key from filters
    const cacheKey = `${minPosition}:${maxPosition}:${minImpressions}:${targetPosition}:${limit}`;

    // Try cache first (if workspaceId provided and skipCache is false)
    if (workspaceId && !options.skipCache) {
      const cached = await this.cache.get<StrikingDistanceResult>(
        'striking',
        workspaceId,
        siteId,
        cacheKey
      );

      if (cached && !cached.metadata.refreshAvailable) {
        return cached;
      }
    }

    try {
      const endDate = format(subDays(new Date(), 3), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd'); // Last 30 days

      const targetCtr = getExpectedCtr(targetPosition);

      // Query pages with avg position in striking distance
      const result = await this.db.execute<{
        page_url: string;
        avg_position: number;
        total_impressions: number;
        total_clicks: number;
        top_queries: Array<{
          query: string;
          position: number;
          impressions: number;
          clicks: number;
        }>;
      }>(sql`
        WITH page_metrics AS (
          SELECT
            page_url,
            AVG(position) as avg_position,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks
          FROM seo_gsc_query_analytics
          WHERE site_id = ${siteId}
            AND query_time >= ${startDate}::date
            AND query_time <= ${endDate}::date
            AND page_url IS NOT NULL
          GROUP BY page_url
          HAVING AVG(position) >= ${minPosition}
            AND AVG(position) <= ${maxPosition}
            AND SUM(impressions) >= ${minImpressions}
        ),
        query_details AS (
          SELECT
            page_url,
            query,
            AVG(position) as avg_position,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks
          FROM seo_gsc_query_analytics
          WHERE site_id = ${siteId}
            AND query_time >= ${startDate}::date
            AND query_time <= ${endDate}::date
          GROUP BY page_url, query
        ),
        aggregated_queries AS (
          SELECT
            page_url,
            ARRAY_AGG(
              JSON_BUILD_OBJECT(
                'query', query,
                'position', avg_position,
                'impressions', total_impressions,
                'clicks', total_clicks
              )
              ORDER BY total_impressions DESC
            ) FILTER (WHERE query IS NOT NULL) as top_queries
          FROM query_details
          GROUP BY page_url
        )
        SELECT
          pm.page_url,
          pm.avg_position,
          pm.total_impressions,
          pm.total_clicks,
          COALESCE(aq.top_queries[1:5], ARRAY[]::jsonb[]) as top_queries
        FROM page_metrics pm
        LEFT JOIN aggregated_queries aq ON pm.page_url = aq.page_url
        ORDER BY (pm.total_impressions * ${targetCtr} - pm.total_clicks) DESC
        LIMIT ${limit}
      `);

      const pages: StrikingDistancePage[] = result.rows.map((row: any) => {
        const potentialClicks = Math.round(row.total_impressions * targetCtr);
        const clickGain = potentialClicks - row.total_clicks;
        const difficulty = this.calculateDifficulty(row.avg_position);

        return {
          pageUrl: row.page_url,
          avgPosition: Number(row.avg_position.toFixed(1)),
          impressions: Number(row.total_impressions),
          currentClicks: Number(row.total_clicks),
          potentialClicks,
          clickGain,
          difficulty,
          topQueries: (row.top_queries ?? []) as any,
        };
      });

      const totalPotentialClicks = pages.reduce((sum, p) => sum + p.potentialClicks, 0);
      const avgDifficulty = pages.length > 0
        ? pages.reduce((sum, p) => sum + (p.difficulty === 'easy' ? 1 : p.difficulty === 'medium' ? 2 : 3), 0) / pages.length
        : 0;

      const data: StrikingDistanceResult = {
        pages,
        meta: {
          totalPages: pages.length,
          totalPotentialClicks,
          avgDifficulty,
        },
      };

      // Cache the result if workspaceId provided
      const dataAsOf = new Date();
      if (workspaceId) {
        await this.cache.set(
          'striking',
          workspaceId,
          siteId,
          data,
          dataAsOf,
          cacheKey
        );
      }

      return wrapWithMetadata(data, dataAsOf);
    } catch (error) {
      logger.error('getStrikingDistancePages failed', error instanceof Error ? error : undefined, {
        method: 'getStrikingDistancePages',
        siteId,
        minPosition,
        maxPosition,
        minImpressions,
        limit,
      });
      throw new Error(`Failed to get striking distance pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate optimization difficulty based on position.
   * - Easy (11-13): Already close to page 1
   * - Medium (14-17): Mid-range
   * - Hard (18-20): Further from page 1
   */
  private calculateDifficulty(position: number): 'easy' | 'medium' | 'hard' {
    if (position <= 13) return 'easy';
    if (position <= 17) return 'medium';
    return 'hard';
  }
}

// Singleton
let instance: StrikingDistanceService | null = null;
export function getStrikingDistanceService(): StrikingDistanceService {
  if (!instance) {
    instance = new StrikingDistanceService(db);
  }
  return instance;
}

// Convenience function - returns CachedData with metadata
export async function getStrikingDistancePagesWithMetadata(
  siteId: string,
  filters?: StrikingDistanceFilters,
  workspaceId?: string
): Promise<CachedData<StrikingDistanceResult>> {
  return getStrikingDistanceService().getStrikingDistancePages(siteId, filters, workspaceId);
}

/**
 * Convenience function - returns just the data (backward compatible).
 * Use getStrikingDistancePagesWithMetadata() for cache metadata.
 */
export async function getStrikingDistancePages(
  siteId: string,
  filters?: StrikingDistanceFilters,
  workspaceId?: string
): Promise<StrikingDistanceResult> {
  const result = await getStrikingDistanceService().getStrikingDistancePages(siteId, filters, workspaceId);
  return result.data;
}
