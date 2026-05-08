/**
 * StrikingDistanceService
 * Phase 96-03: Quick Win Opportunity Detection
 *
 * Identifies pages ranking on page 2 (positions 11-20) that could
 * capture significant traffic with minor optimization.
 *
 * CTR estimates from Advanced Web Rankings data:
 * - Position 3: 11.01% CTR (target for potential calculation)
 * - Position 11: 1.99% CTR
 * - Position 20: 0.93% CTR
 *
 * Difficulty based on position gap to page 1:
 * - Easy (11-13): 8-10 positions to climb
 * - Medium (14-17): 4-7 positions to climb
 * - Hard (18-20): 1-3 positions to climb (but furthest from page 1)
 */
import { sql } from 'drizzle-orm';
import { db, type DbClient } from '@/db';
import type { StrikingDistancePage, StrikingDistanceFilters, StrikingDistanceResult } from '../types';
import { format, subDays } from 'date-fns';

// CTR estimates by position (AWR data)
const CTR_ESTIMATES: Record<number, number> = {
  1: 0.2786, 2: 0.1538, 3: 0.1101, 4: 0.0804, 5: 0.0685,
  6: 0.0573, 7: 0.0500, 8: 0.0447, 9: 0.0404, 10: 0.0372,
  11: 0.0199, 12: 0.0168, 13: 0.0152, 14: 0.0140, 15: 0.0130,
  16: 0.0120, 17: 0.0112, 18: 0.0105, 19: 0.0099, 20: 0.0093,
};

export class StrikingDistanceService {
  constructor(private db: DbClient) {}

  /**
   * Get pages in striking distance (positions 11-20).
   */
  async getStrikingDistancePages(
    siteId: string,
    filters: StrikingDistanceFilters = {}
  ): Promise<StrikingDistanceResult> {
    const {
      minPosition = 11,
      maxPosition = 20,
      minImpressions = 50,
      targetPosition = 3,
      limit = 100,
    } = filters;

    try {
      const endDate = format(subDays(new Date(), 3), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd'); // Last 30 days

      const targetCtr = CTR_ESTIMATES[targetPosition] ?? 0.1101;

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

      return {
        pages,
        meta: {
          totalPages: pages.length,
          totalPotentialClicks,
          avgDifficulty,
        },
      };
    } catch (error) {
      console.error('[StrikingDistanceService] getStrikingDistancePages failed:', {
        method: 'getStrikingDistancePages',
        params: { siteId, minPosition, maxPosition, minImpressions, limit },
        error: error instanceof Error ? error.message : 'Unknown error',
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
