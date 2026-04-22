/**
 * Check Service
 *
 * Orchestrates SEO check execution and persistence.
 * Uses runAllChecks facade and FindingsRepository.
 */

import type { ScoreResult, CheckSeverity } from "../checks/types";
import { runAllChecks } from "../checks";
import type { FindingsRepository, AuditFinding } from "../repositories";

/**
 * Parameters for running checks on a single page
 */
export interface RunPageChecksParams {
  auditId: string;
  pageId: string;
  url: string;
  html: string;
  keyword?: string;
}

/**
 * Page definition for batch check execution
 */
export interface PageDefinition {
  pageId: string;
  url: string;
  html: string;
}

/**
 * Result of running checks on a page
 */
export interface PageCheckResult {
  score: ScoreResult;
  resultCount: number;
}

/**
 * Aggregated audit score
 */
export interface AuditScoreResult {
  averageScore: number;
  byPage: Map<string, number>;
  bySeverity: Record<CheckSeverity, number>;
}

/**
 * Check service interface
 */
export interface CheckService {
  /**
   * Run all checks on a single page and persist results
   */
  runPageChecks(params: RunPageChecksParams): Promise<PageCheckResult>;

  /**
   * Run checks on all pages in an audit
   */
  runAuditChecks(
    auditId: string,
    pages: PageDefinition[],
    keyword?: string
  ): Promise<Map<string, ScoreResult>>;

  /**
   * Get aggregated score for an audit
   */
  getAuditScore(auditId: string): Promise<AuditScoreResult>;

  /**
   * Clear all findings for an audit
   */
  clearAuditFindings(auditId: string): Promise<void>;
}

/**
 * Default implementation of CheckService
 */
class DefaultCheckService implements CheckService {
  constructor(private readonly findingsRepository: FindingsRepository) {}

  async runPageChecks(params: RunPageChecksParams): Promise<PageCheckResult> {
    const { auditId, pageId, url, html, keyword } = params;

    // Run all checks
    const { results, score } = await runAllChecks(html, url, { keyword });

    // Persist findings
    await this.findingsRepository.insertFindings(auditId, pageId, results);

    return {
      score,
      resultCount: results.length,
    };
  }

  async runAuditChecks(
    auditId: string,
    pages: PageDefinition[],
    keyword?: string
  ): Promise<Map<string, ScoreResult>> {
    const scores = new Map<string, ScoreResult>();

    for (const page of pages) {
      const { score } = await this.runPageChecks({
        auditId,
        pageId: page.pageId,
        url: page.url,
        html: page.html,
        keyword,
      });

      scores.set(page.pageId, score);
    }

    return scores;
  }

  async getAuditScore(auditId: string): Promise<AuditScoreResult> {
    const findings = await this.findingsRepository.getFindingsByAudit(auditId);

    if (findings.length === 0) {
      return {
        averageScore: 0,
        byPage: new Map(),
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
      };
    }

    // Group findings by page
    const findingsByPage = new Map<string, AuditFinding[]>();
    for (const finding of findings) {
      const pageFindings = findingsByPage.get(finding.pageId) || [];
      pageFindings.push(finding);
      findingsByPage.set(finding.pageId, pageFindings);
    }

    // Calculate score per page
    const byPage = new Map<string, number>();
    for (const [pageId, pageFindings] of findingsByPage) {
      const passedCount = pageFindings.filter((f) => f.passed).length;
      const score = Math.round((passedCount / pageFindings.length) * 100);
      byPage.set(pageId, score);
    }

    // Calculate average score
    const scores = Array.from(byPage.values());
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    // Count failed findings by severity
    const failedFindings = findings.filter((f) => !f.passed);
    const bySeverity: Record<CheckSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const finding of failedFindings) {
      bySeverity[finding.severity]++;
    }

    return {
      averageScore,
      byPage,
      bySeverity,
    };
  }

  async clearAuditFindings(auditId: string): Promise<void> {
    await this.findingsRepository.deleteFindingsByAudit(auditId);
  }
}

/**
 * Create a CheckService instance
 */
export function createCheckService(
  findingsRepository: FindingsRepository
): CheckService {
  return new DefaultCheckService(findingsRepository);
}
