/**
 * CannibalizationDetector - Core Detection Logic
 *
 * Single responsibility: Find keyword conflicts between pages using
 * stored TimescaleDB data or live GSC API calls.
 *
 * DETECTION MODES:
 * - `stored`: Uses pre-aggregated seo_gsc_query_analytics (fast, for dashboards)
 * - `live`: Uses GSC API directly (real-time, for initial detection/refresh)
 */
import { sql, eq, and, inArray } from 'drizzle-orm';
import type { DbClient } from '@/db';
import { keywordCannibalization, type CompetingPage } from '@/db/link-schema';
import { format, subDays } from 'date-fns';
import { createLogger } from '@/server/lib/logger';
import { AppError } from '@/server/lib/errors';
import {
  fetchGSCQueryPageMetrics,
  getGSCDateRange,
  type GSCQueryPageMetrics,
} from '@/server/services/analytics/gsc-client';
import { getValidCredentials } from '@/server/services/analytics/google-auth';
import {
  CannibalizationScorer,
  type CannibalizingPage,
  type CannibalizationIssue,
} from './CannibalizationScorer';

const log = createLogger({ module: 'cannibalization-detector' });

// =============================================================================
// Type Definitions
// =============================================================================

export interface DetectionOptions {
  /** Detection mode: stored (fast), live (real-time), or auto */
  mode?: 'stored' | 'live' | 'auto';
  /** Start date for analysis (YYYY-MM-DD) */
  startDate?: string;
  /** End date for analysis (YYYY-MM-DD) */
  endDate?: string;
  /** Minimum impressions threshold for inclusion */
  minImpressions?: number;
  /** Maximum number of issues to return */
  limit?: number;
  /** Include resolved issues in results */
  includeResolved?: boolean;
  /** Whether to persist detected issues to database */
  persist?: boolean;
}

export interface DetectionResultInternal {
  issues: CannibalizationIssue[];
  dateRange: { start: string; end: string };
}

// =============================================================================
// CannibalizationDetector Class
// =============================================================================

export class CannibalizationDetector {
  private scorer: CannibalizationScorer;

  constructor(
    private database: DbClient,
    scorer?: CannibalizationScorer
  ) {
    this.scorer = scorer ?? new CannibalizationScorer();
  }

  /**
   * Detect cannibalization using stored TimescaleDB data.
   * Fast queries suitable for dashboard display.
   */
  async detectFromStoredData(
    siteId: string,
    options: DetectionOptions = {}
  ): Promise<DetectionResultInternal> {
    const {
      startDate: filterStartDate,
      endDate: filterEndDate,
      minImpressions = 100,
    } = options;

    // Default date range: last 30 days with 3-day GSC latency
    const endDate = filterEndDate ?? format(subDays(new Date(), 3), 'yyyy-MM-dd');
    const startDate = filterStartDate ?? format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const result = await this.database.execute<{
      query: string;
      page_url: string;
      total_clicks: number;
      total_impressions: number;
      avg_position: number;
      avg_ctr: number;
    }>(sql`
      WITH query_pages AS (
        SELECT
          query,
          page_url,
          SUM(clicks) as total_clicks,
          SUM(impressions) as total_impressions,
          AVG(position) as avg_position,
          CASE
            WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions)
            ELSE 0
          END as avg_ctr
        FROM seo_gsc_query_analytics
        WHERE site_id = ${siteId}
          AND query_time >= ${startDate}::date
          AND query_time <= ${endDate}::date
          AND query IS NOT NULL
          AND page_url IS NOT NULL
        GROUP BY query, page_url
        HAVING SUM(impressions) >= ${minImpressions}
      ),
      cannibalized_queries AS (
        SELECT query
        FROM query_pages
        GROUP BY query
        HAVING COUNT(DISTINCT page_url) >= 2
      )
      SELECT
        qp.query,
        qp.page_url,
        qp.total_clicks,
        qp.total_impressions,
        qp.avg_position,
        qp.avg_ctr
      FROM query_pages qp
      INNER JOIN cannibalized_queries cq ON qp.query = cq.query
      ORDER BY qp.query, qp.total_impressions DESC
    `);

    const issues = this.processQueryResults(result.rows);

    return {
      issues,
      dateRange: { start: startDate, end: endDate },
    };
  }

  /**
   * Detect cannibalization using live GSC API calls.
   * Real-time detection suitable for initial scans and refreshes.
   */
  async detectLive(
    siteId: string,
    options: DetectionOptions = {}
  ): Promise<DetectionResultInternal> {
    let credentials;
    try {
      credentials = await getValidCredentials(siteId);
    } catch (error) {
      log.error('Failed to get GSC credentials for cannibalization detection', error instanceof Error ? error : undefined, {
        siteId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError('GSC_API_ERROR', 'Failed to authenticate with Google Search Console');
    }

    if (!credentials.gscSiteUrl) {
      throw new AppError('CONFIG_ERROR', 'No GSC site URL configured for this client');
    }

    const { startDate, endDate } = getGSCDateRange('incremental');

    const metrics = await fetchGSCQueryPageMetrics(
      credentials.accessToken,
      credentials.gscSiteUrl,
      startDate,
      endDate
    );

    const issues = this.processGSCMetrics(metrics, options);

    return {
      issues,
      dateRange: { start: startDate, end: endDate },
    };
  }

  /**
   * Persist issues to the keywordCannibalization table.
   */
  async persistIssues(clientId: string, issues: CannibalizationIssue[]): Promise<void> {
    for (const issue of issues) {
      const competingPages: CompetingPage[] = issue.pages.map(p => ({
        pageId: '',
        url: p.pageUrl,
        title: '',
        gscPosition: p.avgPosition,
        gscClicks: p.clicks,
        inboundLinks: 0,
        hasExactMatchAnchor: false,
      }));

      await this.database
        .insert(keywordCannibalization)
        .values({
          id: crypto.randomUUID(),
          clientId,
          keyword: issue.query,
          keywordLower: issue.query.toLowerCase(),
          competingPages,
          severity: issue.severity,
          recommendedPrimary: issue.recommendation.primaryPage,
          reasoning: issue.recommendation.rationale,
          status: 'detected',
        })
        .onConflictDoUpdate({
          target: [
            keywordCannibalization.clientId,
            keywordCannibalization.keywordLower,
          ],
          set: {
            severity: issue.severity,
            competingPages,
            recommendedPrimary: issue.recommendation.primaryPage,
            reasoning: issue.recommendation.rationale,
          },
        });
    }
  }

  /**
   * Check if a target URL is involved in any active cannibalization issue.
   */
  async isTargetCannibalized(
    targetUrl: string,
    clientId: string
  ): Promise<boolean> {
    const issues = await this.database
      .select({
        id: keywordCannibalization.id,
        competingPages: keywordCannibalization.competingPages,
      })
      .from(keywordCannibalization)
      .where(
        and(
          eq(keywordCannibalization.clientId, clientId),
          inArray(keywordCannibalization.status, ['detected', 'monitoring'])
        )
      );

    for (const issue of issues) {
      const pages = issue.competingPages ?? [];
      if (pages.some(p => p.url === targetUrl)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get stored cannibalization issues for a client.
   */
  async getStoredIssues(
    clientId: string,
    options: { includeResolved?: boolean; limit?: number } = {}
  ): Promise<(typeof keywordCannibalization.$inferSelect)[]> {
    const statusFilter = options.includeResolved
      ? ['detected', 'monitoring', 'resolved', 'ignored']
      : ['detected', 'monitoring'];

    return this.database
      .select()
      .from(keywordCannibalization)
      .where(
        and(
          eq(keywordCannibalization.clientId, clientId),
          inArray(keywordCannibalization.status, statusFilter)
        )
      )
      .limit(options.limit ?? 100);
  }

  /**
   * Update the status of a cannibalization issue.
   */
  async updateIssueStatus(
    issueId: string,
    status: 'acknowledged' | 'in_progress' | 'resolved' | 'ignored' | 'monitoring'
  ): Promise<void> {
    await this.database
      .update(keywordCannibalization)
      .set({
        status,
        ...(status === 'resolved' ? { resolvedAt: new Date() } : {}),
      })
      .where(eq(keywordCannibalization.id, issueId));
  }

  /**
   * Process raw query results into CannibalizationIssue array.
   */
  processQueryResults(
    rows: Array<{
      query: string;
      page_url: string;
      total_clicks: number;
      total_impressions: number;
      avg_position: number;
      avg_ctr: number;
    }>
  ): CannibalizationIssue[] {
    // Group results by query
    const queryMap = new Map<string, CannibalizingPage[]>();

    for (const row of rows) {
      const pages = queryMap.get(row.query) ?? [];
      pages.push({
        pageUrl: row.page_url,
        clicks: Number(row.total_clicks),
        impressions: Number(row.total_impressions),
        avgPosition: Number(row.avg_position),
        ctr: Number(row.avg_ctr),
        impressionShare: 0, // Calculated below
      });
      queryMap.set(row.query, pages);
    }

    // Calculate impression shares and create issues
    const issues: CannibalizationIssue[] = [];

    for (const [query, pages] of queryMap) {
      // Calculate impression shares
      const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);
      for (const page of pages) {
        page.impressionShare = totalImpressions > 0 ? page.impressions / totalImpressions : 0;
      }

      issues.push(this.scorer.createIssue(query, pages));
    }

    // Sort by impact descending
    issues.sort((a, b) => b.impactEstimate.monthlyLostClicks - a.impactEstimate.monthlyLostClicks);

    return issues;
  }

  /**
   * Process GSC API metrics into CannibalizationIssue array.
   */
  processGSCMetrics(
    metrics: GSCQueryPageMetrics[],
    options: DetectionOptions
  ): CannibalizationIssue[] {
    const minImpressions = options.minImpressions ?? 50;

    // Group by keyword
    const keywordGroups = new Map<string, GSCQueryPageMetrics[]>();
    for (const row of metrics) {
      const key = row.query.toLowerCase();
      const existing = keywordGroups.get(key) ?? [];
      existing.push(row);
      keywordGroups.set(key, existing);
    }

    const issues: CannibalizationIssue[] = [];

    for (const [keyword, data] of keywordGroups) {
      // Filter to pages with minimum impressions and ranking
      const competing = data
        .filter(p => p.position <= 100 && p.impressions >= minImpressions)
        .sort((a, b) => a.position - b.position);

      if (competing.length < 2) continue;

      // Convert to CannibalizingPage format
      const totalImpressions = competing.reduce((sum, p) => sum + p.impressions, 0);
      const pages: CannibalizingPage[] = competing.map(p => ({
        pageUrl: p.pageUrl,
        clicks: p.clicks,
        impressions: p.impressions,
        avgPosition: p.position,
        ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
        impressionShare: totalImpressions > 0 ? p.impressions / totalImpressions : 0,
      }));

      issues.push(this.scorer.createIssue(keyword, pages));
    }

    // Sort by impact descending
    issues.sort((a, b) => b.impactEstimate.monthlyLostClicks - a.impactEstimate.monthlyLostClicks);

    return issues;
  }

  /**
   * Process page rows from a single-query lookup.
   */
  processPageRows(
    rows: Array<{
      page_url: string;
      total_clicks: number;
      total_impressions: number;
      avg_position: number;
      avg_ctr: number;
    }>
  ): CannibalizingPage[] {
    const totalImpressions = rows.reduce((sum, r) => sum + Number(r.total_impressions), 0);

    return rows.map(row => ({
      pageUrl: row.page_url,
      clicks: Number(row.total_clicks),
      impressions: Number(row.total_impressions),
      avgPosition: Number(row.avg_position),
      ctr: Number(row.avg_ctr),
      impressionShare: totalImpressions > 0 ? Number(row.total_impressions) / totalImpressions : 0,
    }));
  }
}
