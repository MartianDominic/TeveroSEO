/**
 * Master Dashboard Service
 * Phase 96-02: Master Dashboard
 * DATA-01, DATA-07 FIX: Unified cache with freshness metadata
 *
 * Multi-site aggregation using continuous aggregates for sub-second queries.
 * Returns cache metadata for UI freshness indicators.
 */
import { sql } from 'drizzle-orm';
import { subDays, format } from 'date-fns';
import type { DbClient } from '@/db';
import { SiteTagsRepository } from '../repositories/SiteTagsRepository';
import {
  getAnalyticsCache,
  wrapWithMetadata,
  type CachedData,
} from '@/server/cache';
import type {
  DashboardFilters,
  DashboardAggregates,
  DateRange,
  ComparisonPeriod,
  SiteMetrics,
} from '../types';
import { createLogger } from '@/server/lib/logger';

const logger = createLogger({ module: 'master-dashboard-service' });

export class MasterDashboardService {
  private cache = getAnalyticsCache();

  constructor(
    private db: DbClient,
    private siteTagsRepo: SiteTagsRepository
  ) {}

  /**
   * Get aggregated metrics for all sites in workspace.
   * Uses master_dashboard_cagg continuous aggregate for performance.
   * Returns data with cache metadata for UI freshness indicators.
   *
   * @param workspaceId - Workspace UUID
   * @param filters - Dashboard filters (date range, comparison, tags, sites)
   * @param options - Optional cache behavior settings
   */
  async getAggregatedMetrics(
    workspaceId: string,
    filters: DashboardFilters,
    options: { skipCache?: boolean } = {}
  ): Promise<CachedData<DashboardAggregates>> {
    // Build cache key suffix from filters
    const cacheKey = this.buildCacheKey(filters);

    // Try cache first (unless skipCache is true)
    if (!options.skipCache) {
      const cached = await this.cache.get<DashboardAggregates>(
        'dashboard',
        workspaceId,
        'all', // Workspace-level aggregation
        cacheKey
      );

      if (cached && !cached.metadata.refreshAvailable) {
        return cached;
      }
    }

    try {
      // 1. Calculate date ranges
      const { startDate, endDate } = filters.dateRange;
      const comparisonRange = this.calculateComparisonRange(filters.dateRange, filters.comparison);

      // 2. Get site IDs filtered by tags (if any)
      let siteIds = filters.siteIds;
      if (filters.tags?.length) {
        siteIds = await this.siteTagsRepo.findSiteIdsByTags(filters.tags);
        if (siteIds.length === 0) {
          // No sites match tags - return empty result
          return this.emptyResult(filters.dateRange, comparisonRange);
        }
      }

      // 3. Query master_dashboard_cagg for current period
      const currentMetricsQuery = sql`
        SELECT
          m.site_id,
          s.site_name,
          s.site_url,
          SUM(m.daily_clicks) as total_clicks,
          SUM(m.daily_impressions) as total_impressions,
          AVG(m.avg_position) as avg_position,
          AVG(m.avg_ctr) as avg_ctr
        FROM master_dashboard_cagg m
        JOIN site_connections s ON m.site_id = s.id
        WHERE s.workspace_id = ${workspaceId}
          AND m.bucket >= ${startDate}::date
          AND m.bucket <= ${endDate}::date
          ${siteIds ? sql`AND m.site_id = ANY(${siteIds})` : sql``}
        GROUP BY m.site_id, s.site_name, s.site_url
        ORDER BY total_clicks DESC
      `;

      const currentMetrics = await this.db.execute(currentMetricsQuery);

      if (currentMetrics.rows.length === 0) {
        return this.emptyResult(filters.dateRange, comparisonRange);
      }

      // 4. Query comparison period (if requested)
      let comparisonMetrics: any = null;
      if (comparisonRange) {
        const comparisonQuery = sql`
          SELECT
            site_id,
            SUM(daily_clicks) as total_clicks,
            SUM(daily_impressions) as total_impressions,
            AVG(avg_position) as avg_position,
            AVG(avg_ctr) as avg_ctr
          FROM master_dashboard_cagg
          WHERE bucket >= ${comparisonRange.startDate}::date
            AND bucket <= ${comparisonRange.endDate}::date
            ${siteIds ? sql`AND site_id = ANY(${siteIds})` : sql``}
          GROUP BY site_id
        `;

        comparisonMetrics = await this.db.execute(comparisonQuery);
      }

      // 5. Get sparkline data for each site (last 7 days)
      const sparklines = await this.getSitesSparklines(
        currentMetrics.rows.map((r: any) => r.site_id),
        7
      );

      // 6. Get tags for each site
      const siteTags = await this.siteTagsRepo.findBySiteIds(
        currentMetrics.rows.map((r: any) => r.site_id)
      );

      // 7. Assemble response with percentage changes
      const data = this.assembleResponseData(
        currentMetrics,
        comparisonMetrics,
        sparklines,
        siteTags,
        filters
      );

      // 8. Cache the result with current timestamp as data freshness
      const dataAsOf = new Date();
      await this.cache.set(
        'dashboard',
        workspaceId,
        'all',
        data,
        dataAsOf,
        cacheKey
      );

      // 9. Return with metadata
      return wrapWithMetadata(data, dataAsOf);
    } catch (error) {
      logger.error('getAggregatedMetrics failed', error instanceof Error ? error : undefined, {
        method: 'getAggregatedMetrics',
        workspaceId,
        dateRange: filters.dateRange,
        comparison: filters.comparison,
      });
      throw new Error(`Failed to get aggregated metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate comparison date range based on period type.
   */
  private calculateComparisonRange(
    current: DateRange,
    comparison?: ComparisonPeriod
  ): DateRange | null {
    if (!comparison) return null;

    const endDate = new Date(current.endDate);
    const startDate = new Date(current.startDate);

    switch (comparison) {
      case 'WoW':
        return {
          startDate: format(subDays(startDate, 7), 'yyyy-MM-dd'),
          endDate: format(subDays(endDate, 7), 'yyyy-MM-dd'),
        };
      case 'MoM':
        return {
          startDate: format(subDays(startDate, 30), 'yyyy-MM-dd'),
          endDate: format(subDays(endDate, 30), 'yyyy-MM-dd'),
        };
      case 'YoY':
        return {
          startDate: format(subDays(startDate, 365), 'yyyy-MM-dd'),
          endDate: format(subDays(endDate, 365), 'yyyy-MM-dd'),
        };
    }
  }

  /**
   * Get sparkline data for multiple sites.
   */
  private async getSitesSparklines(
    siteIds: string[],
    days: number
  ): Promise<Map<string, Array<{ date: string; clicks: number }>>> {
    if (siteIds.length === 0) return new Map();

    // Validate days parameter
    const safeDays = this.validateDaysParam(days);

    try {
      // Use parameterized interval multiplication instead of sql.raw()
      const query = sql`
        SELECT
          site_id,
          bucket::date as date,
          daily_clicks as clicks
        FROM master_dashboard_cagg
        WHERE site_id = ANY(${siteIds})
          AND bucket >= NOW() - (INTERVAL '1 day' * ${safeDays})
        ORDER BY site_id, bucket ASC
      `;

      const result = await this.db.execute(query);

      const sparklineMap = new Map<string, Array<{ date: string; clicks: number }>>();

      for (const row of result.rows as any[]) {
        const siteId = row.site_id;
        if (!sparklineMap.has(siteId)) {
          sparklineMap.set(siteId, []);
        }
        sparklineMap.get(siteId)!.push({
          date: row.date.toISOString().split('T')[0],
          clicks: Number(row.clicks),
        });
      }

      return sparklineMap;
    } catch (error) {
      logger.error('getSitesSparklines failed', error instanceof Error ? error : undefined, {
        method: 'getSitesSparklines',
        siteIdsCount: siteIds.length,
        days,
      });
      throw new Error(`Failed to get sparklines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sparkline for a single site.
   */
  async getSiteSparkline(
    siteId: string,
    days: number
  ): Promise<Array<{ date: string; clicks: number }>> {
    // Validate days parameter
    const safeDays = this.validateDaysParam(days);

    try {
      // Use parameterized interval multiplication instead of sql.raw()
      const query = sql`
        SELECT
          bucket::date as date,
          daily_clicks as clicks
        FROM master_dashboard_cagg
        WHERE site_id = ${siteId}
          AND bucket >= NOW() - (INTERVAL '1 day' * ${safeDays})
        ORDER BY bucket ASC
      `;

      const result = await this.db.execute(query);

      return result.rows.map((r: any) => ({
        date: r.date.toISOString().split('T')[0],
        clicks: Number(r.clicks),
      }));
    } catch (error) {
      logger.error('getSiteSparkline failed', error instanceof Error ? error : undefined, {
        method: 'getSiteSparkline',
        siteId,
        days,
      });
      throw new Error(`Failed to get site sparkline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build cache key suffix from filters.
   */
  private buildCacheKey(filters: DashboardFilters): string {
    const parts = [
      filters.dateRange.startDate,
      filters.dateRange.endDate,
      filters.comparison ?? 'none',
      filters.tags?.sort().join(',') ?? '',
      filters.siteIds?.sort().join(',') ?? '',
    ];
    return parts.join(':');
  }

  /**
   * Assemble final response data with percentage changes.
   */
  private assembleResponseData(
    currentMetrics: any,
    comparisonMetrics: any,
    sparklines: Map<string, Array<{ date: string; clicks: number }>>,
    siteTags: any[],
    filters: DashboardFilters
  ): DashboardAggregates {
    const comparisonMap = new Map();
    if (comparisonMetrics) {
      for (const row of comparisonMetrics.rows) {
        comparisonMap.set(row.site_id, row);
      }
    }

    const tagsMap = new Map<string, string[]>();
    for (const tag of siteTags) {
      if (!tagsMap.has(tag.siteId)) {
        tagsMap.set(tag.siteId, []);
      }
      tagsMap.get(tag.siteId)!.push(tag.tagName);
    }

    const sites: SiteMetrics[] = currentMetrics.rows.map((row: any) => {
      const comparison = comparisonMap.get(row.site_id);

      const clicksChange = comparison
        ? ((Number(row.total_clicks) - Number(comparison.total_clicks)) /
            Number(comparison.total_clicks)) *
          100
        : 0;

      const impressionsChange = comparison
        ? ((Number(row.total_impressions) - Number(comparison.total_impressions)) /
            Number(comparison.total_impressions)) *
          100
        : 0;

      const ctrChange = comparison
        ? ((Number(row.avg_ctr) - Number(comparison.avg_ctr)) / Number(comparison.avg_ctr)) * 100
        : 0;

      const positionChange = comparison
        ? ((Number(row.avg_position) - Number(comparison.avg_position)) /
            Number(comparison.avg_position)) *
          100
        : 0;

      return {
        siteId: row.site_id,
        siteName: row.site_name || row.site_url,
        siteUrl: row.site_url,
        tags: tagsMap.get(row.site_id) || [],
        metrics: {
          clicks: Number(row.total_clicks),
          impressions: Number(row.total_impressions),
          ctr: Number(row.avg_ctr),
          position: Number(row.avg_position),
        },
        comparison: {
          clicksChange,
          impressionsChange,
          ctrChange,
          positionChange,
        },
        trend: sparklines.get(row.site_id) || [],
      };
    });

    // Calculate totals
    const totals = sites.reduce(
      (acc, site) => ({
        clicks: acc.clicks + site.metrics.clicks,
        impressions: acc.impressions + site.metrics.impressions,
        avgPosition: acc.avgPosition + site.metrics.position,
        avgCtr: acc.avgCtr + site.metrics.ctr,
      }),
      { clicks: 0, impressions: 0, avgPosition: 0, avgCtr: 0 }
    );

    totals.avgPosition = totals.avgPosition / sites.length;
    totals.avgCtr = totals.avgCtr / sites.length;

    // Calculate comparison totals
    let comparisonTotals = {
      clicksChange: 0,
      impressionsChange: 0,
      positionChange: 0,
      ctrChange: 0,
    };

    if (comparisonMetrics && comparisonMetrics.rows.length > 0) {
      const prevTotals = comparisonMetrics.rows.reduce(
        (acc: any, row: any) => ({
          clicks: acc.clicks + Number(row.total_clicks),
          impressions: acc.impressions + Number(row.total_impressions),
          position: acc.position + Number(row.avg_position),
          ctr: acc.ctr + Number(row.avg_ctr),
        }),
        { clicks: 0, impressions: 0, position: 0, ctr: 0 }
      );

      comparisonTotals = {
        clicksChange: ((totals.clicks - prevTotals.clicks) / prevTotals.clicks) * 100,
        impressionsChange:
          ((totals.impressions - prevTotals.impressions) / prevTotals.impressions) * 100,
        positionChange:
          ((totals.avgPosition - prevTotals.position / comparisonMetrics.rows.length) /
            (prevTotals.position / comparisonMetrics.rows.length)) *
          100,
        ctrChange:
          ((totals.avgCtr - prevTotals.ctr / comparisonMetrics.rows.length) /
            (prevTotals.ctr / comparisonMetrics.rows.length)) *
          100,
      };
    }

    return {
      totals,
      comparison: comparisonTotals,
      sites,
      meta: {
        siteCount: sites.length,
        dateRange: filters.dateRange,
        comparisonPeriod: this.calculateComparisonRange(
          filters.dateRange,
          filters.comparison
        ),
      },
    };
  }

  /**
   * Validate and sanitize days parameter.
   * Returns a safe positive integer within reasonable bounds.
   */
  private validateDaysParam(days: number): number {
    // Ensure it's a finite number
    if (!Number.isFinite(days)) {
      return 7; // Default fallback
    }

    // Convert to integer and clamp to reasonable range (1-365 days)
    const safeDays = Math.floor(Math.abs(days));
    return Math.max(1, Math.min(safeDays, 365));
  }

  /**
   * Return empty result structure with metadata.
   */
  private emptyResult(dateRange: DateRange, comparisonPeriod: DateRange | null): CachedData<DashboardAggregates> {
    const data: DashboardAggregates = {
      totals: {
        clicks: 0,
        impressions: 0,
        avgPosition: 0,
        avgCtr: 0,
      },
      comparison: {
        clicksChange: 0,
        impressionsChange: 0,
        positionChange: 0,
        ctrChange: 0,
      },
      sites: [],
      meta: {
        siteCount: 0,
        dateRange,
        comparisonPeriod,
      },
    };
    return wrapWithMetadata(data, new Date());
  }
}

/**
 * Singleton instance getter.
 */
let instance: MasterDashboardService | null = null;

export function getMasterDashboardService(
  db?: DbClient,
  siteTagsRepo?: SiteTagsRepository
): MasterDashboardService {
  if (!instance && db && siteTagsRepo) {
    instance = new MasterDashboardService(db, siteTagsRepo);
  }
  if (!instance) {
    throw new Error('MasterDashboardService not initialized. Provide db and siteTagsRepo on first call.');
  }
  return instance;
}
