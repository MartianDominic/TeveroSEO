/**
 * CannibalizationReporter - Export and Alert Formatting
 *
 * Single responsibility: Convert cannibalization data between formats
 * for API responses, exports, and storage.
 */
import type { CannibalizationSeverity } from '@/db/link-schema';
import { keywordCannibalization } from '@/db/link-schema';
import type {
  CannibalizingPage,
  CannibalizationIssue,
  ImpactEstimate,
} from './CannibalizationScorer';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Legacy result format for backward compatibility with Phase 96 API
 */
export interface CannibalizationResult {
  query: string;
  pages: CannibalizingPage[];
  severity: 'high' | 'medium' | 'low';
  impactEstimate: number;
  recommendation: string;
}

/**
 * Severity breakdown for a site (legacy format)
 */
export interface SeverityBreakdown {
  high: number;
  medium: number;
  low: number;
  total: number;
}

/**
 * Filters for legacy API compatibility
 */
export interface CannibalizationFilters {
  startDate?: string;
  endDate?: string;
  minImpressions?: number;
  limit?: number;
}

// =============================================================================
// CannibalizationReporter Class
// =============================================================================

export class CannibalizationReporter {
  /**
   * Convert CannibalizationIssue to legacy CannibalizationResult format.
   */
  toLegacyFormat(issue: CannibalizationIssue): CannibalizationResult {
    return {
      query: issue.query,
      pages: issue.pages,
      severity: this.mapToLegacySeverity(issue.severity),
      impactEstimate: issue.impactEstimate.dailyLostClicks,
      recommendation: issue.recommendation.rationale,
    };
  }

  /**
   * Convert stored database row to CannibalizationIssue.
   */
  fromStoredFormat(row: typeof keywordCannibalization.$inferSelect): CannibalizationIssue {
    const pages: CannibalizingPage[] = (row.competingPages ?? []).map(p => ({
      pageUrl: p.url,
      clicks: p.gscClicks ?? 0,
      impressions: 0, // Not stored in this format
      avgPosition: p.gscPosition ?? 0,
      ctr: 0,
      impressionShare: 0,
    }));

    // Recalculate impact (approximation without impressions)
    const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0);
    const impactEstimate: ImpactEstimate = {
      dailyLostClicks: Math.round(totalClicks * 0.3), // Rough estimate
      monthlyLostClicks: Math.round(totalClicks * 0.3 * 30),
      confidence: 'low',
    };

    return {
      id: row.id,
      query: row.keyword,
      pages,
      severity: row.severity as CannibalizationSeverity,
      impactEstimate,
      recommendation: {
        action: 'canonical',
        primaryPage: row.recommendedPrimary ?? '',
        secondaryPages: pages.filter(p => p.pageUrl !== row.recommendedPrimary).map(p => p.pageUrl),
        rationale: row.reasoning ?? '',
        priority: row.severity === 'critical' ? 90 : row.severity === 'high' ? 70 : row.severity === 'medium' ? 50 : 30,
      },
      detectedAt: row.detectedAt,
      status: row.status as CannibalizationIssue['status'],
    };
  }

  /**
   * Map 4-tier severity to legacy 3-tier.
   */
  mapToLegacySeverity(severity: CannibalizationSeverity): 'high' | 'medium' | 'low' {
    if (severity === 'critical' || severity === 'high') return 'high';
    if (severity === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Convert issues to legacy severity breakdown format.
   */
  toLegacySeverityBreakdown(issues: CannibalizationIssue[]): SeverityBreakdown {
    const breakdown: SeverityBreakdown = {
      high: 0,
      medium: 0,
      low: 0,
      total: issues.length,
    };

    for (const issue of issues) {
      const legacySeverity = this.mapToLegacySeverity(issue.severity);
      breakdown[legacySeverity]++;
    }

    return breakdown;
  }

  /**
   * Format issues for CSV export.
   */
  toCSVRows(issues: CannibalizationIssue[]): string[][] {
    const headers = [
      'Query',
      'Severity',
      'Page Count',
      'Primary Page',
      'Secondary Pages',
      'Daily Lost Clicks',
      'Monthly Lost Clicks',
      'Confidence',
      'Recommended Action',
      'Rationale',
    ];

    const rows: string[][] = [headers];

    for (const issue of issues) {
      rows.push([
        issue.query,
        issue.severity,
        issue.pages.length.toString(),
        issue.recommendation.primaryPage,
        issue.recommendation.secondaryPages.join('; '),
        issue.impactEstimate.dailyLostClicks.toString(),
        issue.impactEstimate.monthlyLostClicks.toString(),
        issue.impactEstimate.confidence,
        issue.recommendation.action,
        issue.recommendation.rationale,
      ]);
    }

    return rows;
  }

  /**
   * Format issues for JSON export with full detail.
   */
  toExportJSON(issues: CannibalizationIssue[]): object {
    return {
      exportedAt: new Date().toISOString(),
      issueCount: issues.length,
      issues: issues.map(issue => ({
        query: issue.query,
        severity: issue.severity,
        status: issue.status,
        detectedAt: issue.detectedAt?.toISOString(),
        pages: issue.pages.map(p => ({
          url: p.pageUrl,
          clicks: p.clicks,
          impressions: p.impressions,
          position: p.avgPosition,
          ctr: p.ctr,
          impressionShare: p.impressionShare,
        })),
        impact: {
          dailyLostClicks: issue.impactEstimate.dailyLostClicks,
          monthlyLostClicks: issue.impactEstimate.monthlyLostClicks,
          confidence: issue.impactEstimate.confidence,
        },
        recommendation: {
          action: issue.recommendation.action,
          primaryPage: issue.recommendation.primaryPage,
          secondaryPages: issue.recommendation.secondaryPages,
          rationale: issue.recommendation.rationale,
          priority: issue.recommendation.priority,
        },
      })),
    };
  }

  /**
   * Generate alert payload for notifications.
   */
  generateAlertPayload(
    issues: CannibalizationIssue[],
    siteId: string
  ): {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    issueCount: number;
    topIssues: Array<{ query: string; severity: string; impact: number }>;
  } {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const totalImpact = issues.reduce((sum, i) => sum + i.impactEstimate.monthlyLostClicks, 0);

    let alertSeverity: 'critical' | 'warning' | 'info';
    if (criticalCount > 0) {
      alertSeverity = 'critical';
    } else if (highCount > 0) {
      alertSeverity = 'warning';
    } else {
      alertSeverity = 'info';
    }

    const title = criticalCount > 0
      ? `Critical: ${criticalCount} keyword cannibalization issues detected`
      : highCount > 0
        ? `Warning: ${highCount} high-priority cannibalization issues`
        : `${issues.length} cannibalization issues detected`;

    const message = `Site ${siteId} has ${issues.length} keyword cannibalization issues. ` +
      `Estimated monthly lost clicks: ${totalImpact.toLocaleString()}. ` +
      `Breakdown: ${criticalCount} critical, ${highCount} high, ` +
      `${issues.filter(i => i.severity === 'medium').length} medium, ` +
      `${issues.filter(i => i.severity === 'low').length} low.`;

    const topIssues = [...issues]
      .sort((a, b) => b.impactEstimate.monthlyLostClicks - a.impactEstimate.monthlyLostClicks)
      .slice(0, 5)
      .map(i => ({
        query: i.query,
        severity: i.severity,
        impact: i.impactEstimate.monthlyLostClicks,
      }));

    return {
      severity: alertSeverity,
      title,
      message,
      issueCount: issues.length,
      topIssues,
    };
  }

  /**
   * Format a single issue for human-readable display.
   */
  formatIssueDescription(issue: CannibalizationIssue): string {
    const pageList = issue.pages
      .map((p, i) => `  ${i + 1}. ${p.pageUrl} (pos ${p.avgPosition.toFixed(1)}, ${p.clicks} clicks)`)
      .join('\n');

    return `Query: "${issue.query}"
Severity: ${issue.severity.toUpperCase()}
Pages (${issue.pages.length}):
${pageList}

Impact: ~${issue.impactEstimate.monthlyLostClicks} lost clicks/month (${issue.impactEstimate.confidence} confidence)

Recommendation: ${issue.recommendation.rationale}`;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let instance: CannibalizationReporter | null = null;

export function getCannibalizationReporter(): CannibalizationReporter {
  if (!instance) {
    instance = new CannibalizationReporter();
  }
  return instance;
}

export function resetCannibalizationReporter(): void {
  instance = null;
}
