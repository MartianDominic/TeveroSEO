/**
 * CannibalizationService - Unified Keyword Cannibalization Detection
 *
 * Facade that orchestrates detection, scoring, and reporting modules.
 * Maintains backward compatibility with existing API consumers.
 *
 * @see CannibalizationDetector - Core detection logic
 * @see CannibalizationScorer - Risk scoring algorithms
 * @see CannibalizationReporter - Export and alert formatting
 */
import { sql } from 'drizzle-orm';
import { db, type DbClient } from '@/db';
import type { CannibalizationSeverity } from '@/db/link-schema';
import { format, subDays } from 'date-fns';
import { createLogger } from '@/server/lib/logger';
import { getAnalyticsEventBus } from '../events/analytics-event-bus';
import { CannibalizationDetector, type DetectionOptions } from './CannibalizationDetector';
import {
  CannibalizationScorer,
  type CannibalizingPage,
  type CannibalizationIssue,
  type ImpactEstimate,
  type Recommendation,
  type DetectionSummary,
} from './CannibalizationScorer';
import {
  CannibalizationReporter,
  type CannibalizationResult,
  type SeverityBreakdown,
  type CannibalizationFilters,
} from './CannibalizationReporter';

const log = createLogger({ module: 'cannibalization-service' });

// =============================================================================
// Re-export Types for Backward Compatibility
// =============================================================================

export type {
  CannibalizingPage,
  CannibalizationIssue,
  ImpactEstimate,
  Recommendation,
  DetectionSummary,
  DetectionOptions,
  CannibalizationResult,
  SeverityBreakdown,
  CannibalizationFilters,
};

/**
 * Metadata about the detection run
 */
export interface DetectionMetadata {
  mode: 'stored' | 'live';
  dateRange: { start: string; end: string };
  queryCount: number;
  executionTimeMs: number;
}

/**
 * Full detection result
 */
export interface DetectionResult {
  issues: CannibalizationIssue[];
  summary: DetectionSummary;
  metadata: DetectionMetadata;
}

// =============================================================================
// CannibalizationService Class
// =============================================================================

export class CannibalizationService {
  private detector: CannibalizationDetector;
  private scorer: CannibalizationScorer;
  private reporter: CannibalizationReporter;

  constructor(private database: DbClient) {
    this.scorer = new CannibalizationScorer();
    this.detector = new CannibalizationDetector(database, this.scorer);
    this.reporter = new CannibalizationReporter();
  }

  // ===========================================================================
  // Public API - Unified Methods
  // ===========================================================================

  /**
   * Unified detection entry point.
   * Automatically chooses between stored and live detection based on options.
   */
  async detect(
    siteId: string,
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    const startTime = Date.now();
    const mode = options.mode ?? 'auto';

    log.info('Starting cannibalization detection', { siteId, mode, options });

    let issues: CannibalizationIssue[];
    let actualMode: 'stored' | 'live';
    let dateRange: { start: string; end: string };

    if (mode === 'live') {
      const result = await this.detector.detectLive(siteId, options);
      issues = result.issues;
      actualMode = 'live';
      dateRange = result.dateRange;
    } else if (mode === 'stored') {
      const result = await this.detector.detectFromStoredData(siteId, options);
      issues = result.issues;
      actualMode = 'stored';
      dateRange = result.dateRange;
    } else {
      // Auto mode: try stored first, fall back to live if no data
      const storedResult = await this.detector.detectFromStoredData(siteId, options);
      if (storedResult.issues.length > 0) {
        issues = storedResult.issues;
        actualMode = 'stored';
        dateRange = storedResult.dateRange;
      } else {
        log.info('No stored data found, falling back to live detection', { siteId });
        const liveResult = await this.detector.detectLive(siteId, options);
        issues = liveResult.issues;
        actualMode = 'live';
        dateRange = liveResult.dateRange;
      }
    }

    // Persist if requested and using live mode
    if (options.persist !== false && actualMode === 'live') {
      await this.detector.persistIssues(siteId, issues);
    }

    // Apply limit
    const limit = options.limit ?? 100;
    const limitedIssues = issues.slice(0, limit);

    // Calculate summary
    const summary = this.scorer.calculateSummary(limitedIssues);

    const executionTimeMs = Date.now() - startTime;
    log.info('Cannibalization detection complete', {
      siteId,
      mode: actualMode,
      issueCount: limitedIssues.length,
      executionTimeMs,
    });

    // Emit event asynchronously (non-blocking)
    if (limitedIssues.length > 0) {
      setImmediate(() => {
        try {
          const eventBus = getAnalyticsEventBus();
          eventBus.emit('cannibalization:detected', {
            siteId,
            issueCount: limitedIssues.length,
            severity: {
              critical: summary.bySeverity.critical,
              high: summary.bySeverity.high,
              medium: summary.bySeverity.medium,
              low: summary.bySeverity.low,
            },
            timestamp: new Date(),
          });
        } catch (error) {
          log.warn('Failed to emit cannibalization:detected event', {
            siteId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    return {
      issues: limitedIssues,
      summary,
      metadata: {
        mode: actualMode,
        dateRange,
        queryCount: issues.length,
        executionTimeMs,
      },
    };
  }

  // ===========================================================================
  // Public API - Legacy Methods (Backward Compatibility)
  // ===========================================================================

  /**
   * Legacy method: Detect keyword cannibalization for a site.
   * @deprecated Use detect() for new implementations
   */
  async detectCannibalization(
    siteId: string,
    filters: CannibalizationFilters = {}
  ): Promise<CannibalizationResult[]> {
    const result = await this.detect(siteId, {
      ...filters,
      mode: 'stored',
      persist: false,
    });

    return result.issues.map(issue => this.reporter.toLegacyFormat(issue));
  }

  /**
   * Legacy method: Get cannibalization details for a specific query.
   * @deprecated Use detect() with query filter for new implementations
   */
  async getCannibalizationForQuery(
    siteId: string,
    query: string
  ): Promise<CannibalizationResult | null> {
    const endDate = format(subDays(new Date(), 3), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const result = await this.database.execute<{
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
      return null;
    }

    const pages = this.detector.processPageRows(result.rows);
    const issue = this.scorer.createIssue(query, pages);

    return this.reporter.toLegacyFormat(issue);
  }

  /**
   * Legacy method: Get severity breakdown for a site.
   * @deprecated Use detect() summary for new implementations
   */
  async getSeverityBreakdown(siteId: string): Promise<SeverityBreakdown> {
    const result = await this.detect(siteId, { limit: 1000, persist: false });
    return this.reporter.toLegacySeverityBreakdown(result.issues);
  }

  // ===========================================================================
  // Public API - Monitoring & Storage Methods
  // ===========================================================================

  async isTargetCannibalized(targetUrl: string, clientId: string): Promise<boolean> {
    return this.detector.isTargetCannibalized(targetUrl, clientId);
  }

  async getStoredIssues(
    clientId: string,
    options: { includeResolved?: boolean; limit?: number } = {}
  ): Promise<CannibalizationIssue[]> {
    const results = await this.detector.getStoredIssues(clientId, options);
    return results.map(row => this.reporter.fromStoredFormat(row));
  }

  async updateIssueStatus(
    issueId: string,
    status: 'acknowledged' | 'in_progress' | 'resolved' | 'ignored' | 'monitoring'
  ): Promise<void> {
    return this.detector.updateIssueStatus(issueId, status);
  }

  // ===========================================================================
  // Delegate Access to Sub-modules (for advanced usage)
  // ===========================================================================

  async detectFromStoredData(siteId: string, options: DetectionOptions = {}) {
    return this.detector.detectFromStoredData(siteId, options);
  }

  async detectLive(siteId: string, options: DetectionOptions = {}) {
    return this.detector.detectLive(siteId, options);
  }
}

// =============================================================================
// Singleton & Convenience Functions
// =============================================================================

let instance: CannibalizationService | null = null;

export function getCannibalizationService(): CannibalizationService {
  if (!instance) {
    instance = new CannibalizationService(db);
  }
  return instance;
}

export function resetCannibalizationService(): void {
  instance = null;
}

// Legacy convenience functions
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

// New convenience functions
export async function detectKeywordCannibalization(
  clientId: string,
  options?: DetectionOptions
): Promise<DetectionResult> {
  return getCannibalizationService().detect(clientId, options);
}

export async function isTargetCannibalized(
  targetUrl: string,
  clientId: string
): Promise<boolean> {
  return getCannibalizationService().isTargetCannibalized(targetUrl, clientId);
}
