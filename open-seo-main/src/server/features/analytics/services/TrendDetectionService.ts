/**
 * TrendDetectionService
 * Phase 96-03: Growing/Decaying Page Detection
 * DATA-01, DATA-07 FIX: Unified cache with freshness metadata
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
 * Returns cache metadata for UI freshness indicators.
 */
import { sql } from 'drizzle-orm';
import { db, type DbClient } from '@/db';
import type { TrendAnalysis, TrendFilters, TrendResult, QueryFilter } from '../types';
import { format, subDays } from 'date-fns';
import { createLogger } from '@/server/lib/logger';
import {
  getAnalyticsCache,
  wrapWithMetadata,
  type CachedData,
} from '@/server/cache';
import { getAnalyticsEventBus } from '../events/analytics-event-bus';

const logger = createLogger({ module: 'trend-detection-service' });

export class TrendDetectionService {
  private cache = getAnalyticsCache();

  constructor(private db: DbClient) {}

  /**
   * Analyze page trends for a site.
   * Returns pages with >threshold% change in clicks.
   * Includes cache metadata for UI freshness indicators.
   *
   * @param siteId - Site UUID
   * @param filters - Trend filters
   * @param workspaceId - Workspace UUID (required for caching)
   * @param options - Optional cache behavior settings
   */
  async analyzePageTrends(
    siteId: string,
    filters: TrendFilters = {},
    workspaceId?: string,
    options: { skipCache?: boolean } = {}
  ): Promise<CachedData<TrendResult>> {
    const {
      periodDays = 21,
      threshold = 0.10,
      minImpressions = 100,
      trend = 'all',
      queryFilter,
    } = filters;

    // Build cache key from filters
    const cacheKey = this.buildCacheKey(filters);

    // Try cache first (if workspaceId provided and skipCache is false)
    if (workspaceId && !options.skipCache) {
      const cached = await this.cache.get<TrendResult>(
        'trends',
        workspaceId,
        siteId,
        cacheKey
      );

      if (cached && !cached.metadata.refreshAvailable) {
        return cached;
      }
    }

    try {
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
            AND bucket >= ${currentStart}::timestamptz
            AND bucket <= ${endDate}::timestamptz
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
            AND bucket >= ${previousStart}::timestamptz
            AND bucket < ${previousEnd}::timestamptz
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

      const data: TrendResult = {
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

      // Cache the result if workspaceId provided
      const dataAsOf = new Date();
      if (workspaceId) {
        await this.cache.set(
          'trends',
          workspaceId,
          siteId,
          data,
          dataAsOf,
          cacheKey
        );
      }

      // Emit event asynchronously (non-blocking)
      if (growingCount > 0 || decayingCount > 0) {
        setImmediate(() => {
          try {
            const eventBus = getAnalyticsEventBus();
            eventBus.emit('trends:analyzed', {
              siteId,
              growingCount,
              decayingCount,
              stableCount,
              timestamp: new Date(),
            });
          } catch (error) {
            logger.warn('Failed to emit trends:analyzed event', {
              siteId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }

      return wrapWithMetadata(data, dataAsOf);
    } catch (error) {
      logger.error('analyzePageTrends failed', error instanceof Error ? error : undefined, {
        method: 'analyzePageTrends',
        siteId,
        periodDays: filters.periodDays,
        threshold: filters.threshold,
      });
      throw new Error(`Failed to analyze page trends: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build cache key from filters.
   */
  private buildCacheKey(filters: TrendFilters): string {
    const parts = [
      String(filters.periodDays ?? 21),
      String(filters.threshold ?? 0.10),
      String(filters.minImpressions ?? 100),
      filters.trend ?? 'all',
      filters.queryFilter?.include?.join(',') ?? '',
      filters.queryFilter?.exclude?.join(',') ?? '',
      filters.queryFilter?.pattern ?? '',
    ];
    return parts.join(':');
  }

  /**
   * Build SQL condition for query filtering (AND/OR/NOT).
   * Uses parameterized queries to prevent SQL injection.
   */
  private buildQueryFilterCondition(filter?: QueryFilter): ReturnType<typeof sql> {
    if (!filter) return sql``;

    const conditions: Array<ReturnType<typeof sql>> = [];

    if (filter.include?.length) {
      // Sanitize terms: escape SQL LIKE wildcards in user input
      const sanitizedTerms = filter.include.map(term =>
        this.sanitizeLikeTerm(term)
      );

      if (filter.mode === 'or') {
        // Build OR conditions with parameterized ILIKE
        const orConditions = sanitizedTerms.map(term =>
          sql`query ILIKE ${'%' + term + '%'}`
        );
        // Combine with OR
        if (orConditions.length === 1) {
          conditions.push(orConditions[0]);
        } else {
          conditions.push(sql`(${sql.join(orConditions, sql` OR `)})`);
        }
      } else {
        // Default: AND mode - each term becomes a separate condition
        for (const term of sanitizedTerms) {
          conditions.push(sql`query ILIKE ${'%' + term + '%'}`);
        }
      }
    }

    if (filter.exclude?.length) {
      const sanitizedTerms = filter.exclude.map(term =>
        this.sanitizeLikeTerm(term)
      );
      for (const term of sanitizedTerms) {
        conditions.push(sql`query NOT ILIKE ${'%' + term + '%'}`);
      }
    }

    if (filter.pattern) {
      // Validate regex pattern to prevent ReDoS and injection
      const sanitizedPattern = this.sanitizeRegexPattern(filter.pattern);
      if (sanitizedPattern) {
        // Use parameterized regex - Drizzle will handle escaping
        conditions.push(sql`query ~ ${sanitizedPattern}`);
      }
    }

    if (conditions.length === 0) return sql``;

    // Join all conditions with AND, prefixed with AND keyword
    return sql`AND ${sql.join(conditions, sql` AND `)}`;
  }

  /**
   * Sanitize a term for use in ILIKE patterns.
   * Escapes SQL LIKE special characters (%, _, \).
   */
  private sanitizeLikeTerm(term: string): string {
    return term
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent
      .replace(/_/g, '\\_');   // Escape underscore
  }

  /**
   * Validate and sanitize regex pattern.
   * Returns null if pattern is invalid or potentially dangerous.
   */
  private sanitizeRegexPattern(pattern: string): string | null {
    // Reject empty patterns
    if (!pattern || pattern.trim().length === 0) {
      return null;
    }

    // Limit pattern length to prevent ReDoS
    if (pattern.length > 200) {
      logger.warn('Regex pattern too long, rejecting', { patternLength: pattern.length });
      return null;
    }

    // Test that the pattern is valid PostgreSQL regex
    try {
      // Create a simple RegExp to validate syntax (basic check)
      new RegExp(pattern);
    } catch {
      logger.warn('Invalid regex pattern, rejecting', { pattern });
      return null;
    }

    return pattern;
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

// Convenience function - returns CachedData with metadata
export async function analyzePageTrendsWithMetadata(
  siteId: string,
  filters?: TrendFilters,
  workspaceId?: string
): Promise<CachedData<TrendResult>> {
  return getTrendDetectionService().analyzePageTrends(siteId, filters, workspaceId);
}

/**
 * Convenience function - returns just the data (backward compatible).
 * Use analyzePageTrendsWithMetadata() for cache metadata.
 */
export async function analyzePageTrends(
  siteId: string,
  filters?: TrendFilters,
  workspaceId?: string
): Promise<TrendResult> {
  const result = await getTrendDetectionService().analyzePageTrends(siteId, filters, workspaceId);
  return result.data;
}
