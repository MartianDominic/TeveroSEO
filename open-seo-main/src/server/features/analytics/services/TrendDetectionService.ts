/**
 * TrendDetectionService
 * Phase 96-03: Growing/Decaying Page Detection
 *
 * Uses 3-week rolling comparison (industry standard) to detect:
 * - Growing pages: >10% click increase over previous 3-week period
 * - Decaying pages: >10% click decrease over previous 3-week period
 *
 * Algorithm:
 * 1. Query growing_pages_cagg for current 3-week period (days -21 to 0)
 * 2. Query growing_pages_cagg for previous 3-week period (days -42 to -21)
 * 3. Calculate % change: (current - previous) / previous * 100
 * 4. Filter by threshold (default 10%)
 * 5. Assign confidence based on impression volume
 *
 * Uses continuous aggregate for sub-second queries at scale.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { TrendAnalysis, TrendFilters, TrendResult, QueryFilter } from '../types';
import { format, subDays } from 'date-fns';

export class TrendDetectionService {
  constructor(private db: typeof db) {}

  /**
   * Analyze page trends for a site.
   * Returns pages with >threshold% change in clicks.
   */
  async analyzePageTrends(
    siteId: string,
    filters: TrendFilters = {}
  ): Promise<TrendResult> {
    const {
      periodDays = 21,
      threshold = 0.10,
      minImpressions = 100,
      trend = 'all',
      queryFilter,
    } = filters;

    const endDate = format(subDays(new Date(), 3), 'yyyy-MM-dd'); // GSC 3-day latency
    const currentStart = format(subDays(new Date(), 3 + periodDays), 'yyyy-MM-dd');
    const previousStart = format(subDays(new Date(), 3 + periodDays * 2), 'yyyy-MM-dd');
    const previousEnd = format(subDays(new Date(), 3 + periodDays), 'yyyy-MM-dd');

    // Build query filter condition
    const queryCondition = this.buildQueryFilterCondition(queryFilter);

    // Query continuous aggregate for both periods
    const result = await this.db.execute<{
      page_url: string;
      current_clicks: number;
      previous_clicks: number;
      current_impressions: number;
      previous_impressions: number;
      current_position: number;
      previous_position: number;
      top_queries: string[];
    }>(sql`
      WITH current_period AS (
        SELECT
          page_url,
          SUM(daily_clicks) as clicks,
          SUM(daily_impressions) as impressions,
          AVG(avg_position) as position
        FROM growing_pages_cagg
        WHERE site_id = ${siteId}
          AND bucket >= ${currentStart}::date
          AND bucket <= ${endDate}::date
        GROUP BY page_url
        HAVING SUM(daily_impressions) >= ${minImpressions}
      ),
      previous_period AS (
        SELECT
          page_url,
          SUM(daily_clicks) as clicks,
          SUM(daily_impressions) as impressions,
          AVG(avg_position) as position
        FROM growing_pages_cagg
        WHERE site_id = ${siteId}
          AND bucket >= ${previousStart}::date
          AND bucket < ${previousEnd}::date
        GROUP BY page_url
        HAVING SUM(daily_clicks) > 0  -- Exclude pages with zero previous clicks
      ),
      top_queries AS (
        SELECT
          page_url,
          ARRAY_AGG(query ORDER BY SUM(clicks) DESC) FILTER (WHERE query IS NOT NULL) as queries
        FROM seo_gsc_query_analytics
        WHERE site_id = ${siteId}
          AND query_time >= ${currentStart}::date
          AND query_time <= ${endDate}::date
          ${queryCondition}
        GROUP BY page_url
      )
      SELECT
        c.page_url,
        c.clicks as current_clicks,
        p.clicks as previous_clicks,
        c.impressions as current_impressions,
        p.impressions as previous_impressions,
        c.position as current_position,
        p.position as previous_position,
        (SELECT queries[1:5] FROM top_queries tq WHERE tq.page_url = c.page_url) as top_queries
      FROM current_period c
      JOIN previous_period p ON c.page_url = p.page_url
      WHERE p.clicks > 0
      ORDER BY ABS((c.clicks - p.clicks)::float / p.clicks) DESC
    `);

    // Transform and filter results
    const pages: TrendAnalysis[] = [];
    let growingCount = 0;
    let decayingCount = 0;
    let stableCount = 0;

    for (const row of result.rows) {
      const changePercent = ((row.current_clicks - row.previous_clicks) / row.previous_clicks) * 100;

      let pageTrend: 'growing' | 'decaying' | 'stable';
      if (changePercent > threshold * 100) {
        pageTrend = 'growing';
        growingCount++;
      } else if (changePercent < -threshold * 100) {
        pageTrend = 'decaying';
        decayingCount++;
      } else {
        pageTrend = 'stable';
        stableCount++;
      }

      // Filter by requested trend type
      if (trend !== 'all' && pageTrend !== trend) {
        continue;
      }

      // Calculate confidence based on impression volume
      const totalImpressions = row.current_impressions + row.previous_impressions;
      let confidence: 'high' | 'medium' | 'low';
      if (totalImpressions > 1000) {
        confidence = 'high';
      } else if (totalImpressions > 200) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      pages.push({
        pageUrl: row.page_url,
        currentClicks: Number(row.current_clicks),
        previousClicks: Number(row.previous_clicks),
        currentImpressions: Number(row.current_impressions),
        previousImpressions: Number(row.previous_impressions),
        currentPosition: Number(row.current_position),
        previousPosition: Number(row.previous_position),
        changePercent,
        trend: pageTrend,
        confidence,
        topQueries: row.top_queries ?? [],
      });
    }

    return {
      pages,
      meta: {
        totalAnalyzed: result.rows.length,
        growingCount,
        decayingCount,
        stableCount,
        periodDays,
        threshold,
      },
    };
  }

  /**
   * Build SQL condition for query filtering (AND/OR/NOT).
   */
  private buildQueryFilterCondition(filter?: QueryFilter): ReturnType<typeof sql> {
    if (!filter) return sql``;

    const conditions: string[] = [];

    if (filter.include?.length) {
      if (filter.mode === 'or') {
        const orConditions = filter.include.map(term => `query ILIKE '%${term}%'`);
        conditions.push(`(${orConditions.join(' OR ')})`);
      } else {
        // Default: AND mode
        for (const term of filter.include) {
          conditions.push(`query ILIKE '%${term}%'`);
        }
      }
    }

    if (filter.exclude?.length) {
      for (const term of filter.exclude) {
        conditions.push(`query NOT ILIKE '%${term}%'`);
      }
    }

    if (filter.pattern) {
      conditions.push(`query ~ '${filter.pattern}'`);
    }

    if (conditions.length === 0) return sql``;

    return sql.raw(`AND ${conditions.join(' AND ')}`);
  }
}

// Singleton instance
let instance: TrendDetectionService | null = null;
export function getTrendDetectionService(): TrendDetectionService {
  if (!instance) {
    instance = new TrendDetectionService(db);
  }
  return instance;
}

// Convenience function
export async function analyzePageTrends(
  siteId: string,
  filters?: TrendFilters
): Promise<TrendResult> {
  return getTrendDetectionService().analyzePageTrends(siteId, filters);
}
