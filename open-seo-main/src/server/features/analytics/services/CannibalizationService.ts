/**
 * CannibalizationService
 * Phase 96-03: Keyword Cannibalization Detection
 *
 * Detects when multiple pages from the same site compete for the same keyword
 * in search results. This dilutes ranking potential and confuses search engines.
 *
 * Detection criteria:
 * 1. Same keyword appears for 2+ different pages
 * 2. Both pages have significant impressions (configurable threshold)
 * 3. Position variance indicates Google uncertainty about which page to rank
 *
 * Severity levels:
 * - HIGH: >3 pages OR top 2 pages both in top 10
 * - MEDIUM: 2-3 pages with significant impressions
 * - LOW: 2 pages with one having minimal traffic
 */
import { sql } from 'drizzle-orm';
import { db, type DbClient } from '@/db';
import { format, subDays } from 'date-fns';

// CTR estimates by position for impact calculation
const CTR_ESTIMATES: Record<number, number> = {
  1: 0.2786, 2: 0.1538, 3: 0.1101, 4: 0.0804, 5: 0.0685,
  6: 0.0573, 7: 0.0500, 8: 0.0447, 9: 0.0404, 10: 0.0372,
  11: 0.0199, 12: 0.0168, 13: 0.0152, 14: 0.0140, 15: 0.0130,
  16: 0.0120, 17: 0.0112, 18: 0.0105, 19: 0.0099, 20: 0.0093,
};

// Expected CTR if consolidated to best-performing page
const CONSOLIDATED_TARGET_CTR = 0.1101; // Position 3 CTR

/**
 * Page data within a cannibalization issue
 */
export interface CannibalizingPage {
  pageUrl: string;
  clicks: number;
  impressions: number;
  avgPosition: number;
  ctr: number;
}

/**
 * Result of cannibalization detection for a single query
 */
export interface CannibalizationResult {
  query: string;
  pages: CannibalizingPage[];
  severity: 'high' | 'medium' | 'low';
  impactEstimate: number; // Estimated lost clicks due to cannibalization
  recommendation: string;
}

/**
 * Options for cannibalization detection
 */
export interface CannibalizationFilters {
  startDate?: string;
  endDate?: string;
  minImpressions?: number;
  limit?: number;
}

/**
 * Severity breakdown for a site
 */
export interface SeverityBreakdown {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export class CannibalizationService {
  constructor(private db: DbClient) {}

  /**
   * Detect keyword cannibalization for a site.
   * Returns queries where multiple pages are competing.
   */
  async detectCannibalization(
    siteId: string,
    filters: CannibalizationFilters = {}
  ): Promise<CannibalizationResult[]> {
    const {
      startDate: filterStartDate,
      endDate: filterEndDate,
      minImpressions = 100,
      limit = 100,
    } = filters;

    const endDate = filterEndDate ?? format(subDays(new Date(), 3), 'yyyy-MM-dd'); // GSC 3-day latency
    const startDate = filterStartDate ?? format(subDays(new Date(), 30), 'yyyy-MM-dd'); // Default 30 days

    // Query for queries with multiple pages
    const result = await this.db.execute<{
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

    // Group results by query
    const queryMap = new Map<string, CannibalizingPage[]>();

    for (const row of result.rows) {
      const pages = queryMap.get(row.query) ?? [];
      pages.push({
        pageUrl: row.page_url,
        clicks: Number(row.total_clicks),
        impressions: Number(row.total_impressions),
        avgPosition: Number(row.avg_position),
        ctr: Number(row.avg_ctr),
      });
      queryMap.set(row.query, pages);
    }

    // Transform to results with severity and recommendations
    const results: CannibalizationResult[] = [];

    for (const [query, pages] of queryMap) {
      const severity = this.calculateSeverity(pages);
      const impactEstimate = this.calculateImpact(pages);
      const recommendation = this.generateRecommendation(pages, query);

      results.push({
        query,
        pages,
        severity,
        impactEstimate,
        recommendation,
      });
    }

    // Sort by impact descending, then limit
    results.sort((a, b) => b.impactEstimate - a.impactEstimate);

    return results.slice(0, limit);
  }

  /**
   * Get cannibalization details for a specific query.
   */
  async getCannibalizationForQuery(
    siteId: string,
    query: string
  ): Promise<CannibalizationResult | null> {
    const endDate = format(subDays(new Date(), 3), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const result = await this.db.execute<{
      page_url: string;
      total_clicks: number;
      total_impressions: number;
      avg_position: number;
      avg_ctr: number;
    }>(sql`
      SELECT
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
        AND query = ${query}
        AND page_url IS NOT NULL
      GROUP BY page_url
      HAVING SUM(impressions) > 0
      ORDER BY SUM(impressions) DESC
    `);

    if (result.rows.length < 2) {
      return null; // No cannibalization - need at least 2 pages
    }

    const pages: CannibalizingPage[] = result.rows.map(row => ({
      pageUrl: row.page_url,
      clicks: Number(row.total_clicks),
      impressions: Number(row.total_impressions),
      avgPosition: Number(row.avg_position),
      ctr: Number(row.avg_ctr),
    }));

    return {
      query,
      pages,
      severity: this.calculateSeverity(pages),
      impactEstimate: this.calculateImpact(pages),
      recommendation: this.generateRecommendation(pages, query),
    };
  }

  /**
   * Get severity breakdown for a site.
   */
  async getSeverityBreakdown(siteId: string): Promise<SeverityBreakdown> {
    const issues = await this.detectCannibalization(siteId, { limit: 1000 });

    const breakdown: SeverityBreakdown = {
      high: 0,
      medium: 0,
      low: 0,
      total: issues.length,
    };

    for (const issue of issues) {
      breakdown[issue.severity]++;
    }

    return breakdown;
  }

  /**
   * Calculate severity based on page count and positions.
   *
   * - HIGH: >3 pages OR top 2 pages both in top 10 positions
   * - MEDIUM: 2-3 pages with significant impressions
   * - LOW: 2 pages with one having minimal traffic (low impression share)
   */
  private calculateSeverity(pages: CannibalizingPage[]): 'high' | 'medium' | 'low' {
    const pageCount = pages.length;

    // HIGH: More than 3 pages competing
    if (pageCount > 3) {
      return 'high';
    }

    // Sort by position to get top performers
    const sortedByPosition = [...pages].sort((a, b) => a.avgPosition - b.avgPosition);
    const top2Positions = sortedByPosition.slice(0, 2).map(p => p.avgPosition);

    // HIGH: Top 2 pages both in top 10 (direct SERP competition)
    if (top2Positions.every(pos => pos <= 10)) {
      return 'high';
    }

    // Calculate impression distribution
    const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);
    const maxImpressions = Math.max(...pages.map(p => p.impressions));
    const maxShare = maxImpressions / totalImpressions;

    // LOW: One page dominates (>80% of impressions)
    if (maxShare > 0.8) {
      return 'low';
    }

    // MEDIUM: Everything else (2-3 pages with distributed traffic)
    return 'medium';
  }

  /**
   * Calculate estimated impact (lost clicks) due to cannibalization.
   *
   * Formula: Sum of (impressions * (target_ctr - current_ctr)) for secondary pages
   * This estimates clicks lost by not consolidating to a single page.
   */
  private calculateImpact(pages: CannibalizingPage[]): number {
    const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);
    const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0);
    const currentCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // Estimate clicks if all impressions went to a consolidated page at position 3 CTR
    const potentialClicks = totalImpressions * CONSOLIDATED_TARGET_CTR;
    const lostClicks = Math.max(0, potentialClicks - totalClicks);

    return Math.round(lostClicks);
  }

  /**
   * Generate actionable recommendation based on page data.
   */
  private generateRecommendation(pages: CannibalizingPage[], query: string): string {
    // Sort by combined metric: clicks + (impressions * position weight)
    const sortedPages = [...pages].sort((a, b) => {
      const scoreA = a.clicks + (a.impressions * (1 / (a.avgPosition + 1)));
      const scoreB = b.clicks + (b.impressions * (1 / (b.avgPosition + 1)));
      return scoreB - scoreA;
    });

    const primaryPage = sortedPages[0];
    const secondaryPages = sortedPages.slice(1);
    const pageCount = pages.length;

    // Extract page slugs for readability
    const getPrimarySlug = (url: string): string => {
      try {
        const path = new URL(url).pathname;
        return path.length > 40 ? path.substring(0, 40) + '...' : path;
      } catch {
        return url.substring(0, 40);
      }
    };

    const primarySlug = getPrimarySlug(primaryPage.pageUrl);

    if (pageCount > 3) {
      return `Consolidate content: ${pageCount} pages compete for "${query}". ` +
        `Designate ${primarySlug} as the primary page and redirect or remove others.`;
    }

    if (secondaryPages.length === 1) {
      const secondarySlug = getPrimarySlug(secondaryPages[0].pageUrl);
      if (secondaryPages[0].avgPosition < primaryPage.avgPosition) {
        return `Consider merging: ${secondarySlug} ranks higher but ${primarySlug} gets more traffic. ` +
          `Evaluate which page better serves user intent for "${query}".`;
      }
      return `Add canonical tag from ${secondarySlug} to ${primarySlug}, ` +
        `or 301 redirect if content overlap is high for "${query}".`;
    }

    return `Designate ${primarySlug} as the primary page for "${query}". ` +
      `Add canonical tags or redirects from the ${secondaryPages.length} competing pages.`;
  }
}

// Singleton instance
let instance: CannibalizationService | null = null;

export function getCannibalizationService(): CannibalizationService {
  if (!instance) {
    instance = new CannibalizationService(db);
  }
  return instance;
}

// Convenience functions
export async function detectCannibalization(
  siteId: string,
  filters?: CannibalizationFilters
): Promise<CannibalizationResult[]> {
  return getCannibalizationService().detectCannibalization(siteId, filters);
}

export async function getCannibalizationForQuery(
  siteId: string,
  query: string
): Promise<CannibalizationResult | null> {
  return getCannibalizationService().getCannibalizationForQuery(siteId, query);
}

export async function getSeverityBreakdown(
  siteId: string
): Promise<SeverityBreakdown> {
  return getCannibalizationService().getSeverityBreakdown(siteId);
}
