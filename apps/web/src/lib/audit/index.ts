/**
 * SEO Audit Module
 *
 * Main entry point for the 107 SEO checks system.
 *
 * @example
 * ```typescript
 * import {
 *   runAllChecks,
 *   createCheckService,
 *   createInMemoryFindingsRepository,
 * } from '@/lib/audit';
 *
 * // Quick check (no persistence)
 * const { results, score } = await runAllChecks(html, url, { keyword });
 *
 * // Full workflow with persistence
 * const repository = createInMemoryFindingsRepository();
 * const service = createCheckService(repository);
 * const { score, resultCount } = await service.runPageChecks({
 *   auditId: 'audit-1',
 *   pageId: 'page-1',
 *   url: 'https://example.com',
 *   html: '<html>...</html>',
 *   keyword: 'seo audit',
 * });
 * ```
 */

// Checks module
export {
  runAllChecks,
  runChecks,
  parseHtml,
  calculateOnPageScore,
  getScoreGrade,
  getScoreColor,
  CHECK_DEFINITIONS,
  getCheckById,
  getChecksByTier,
  getChecksByCategory,
  getTierFromCheckId,
  CHECK_COUNTS,
} from "./checks";

export type {
  CheckSeverity,
  CheckTier,
  CheckCategory,
  CheckResult,
  ScoreResult,
  ScoreBreakdown,
  PageAnalysis,
  SiteContext,
  CheckOptions,
  CheckDefinition,
  AllChecksResult,
} from "./checks";

// Repositories
export {
  createInMemoryFindingsRepository,
  createApiFindingsRepository,
} from "./repositories";

export type { FindingsRepository, AuditFinding } from "./repositories";

// Services
export { createCheckService } from "./services";

export type {
  CheckService,
  RunPageChecksParams,
  PageDefinition,
  PageCheckResult,
  AuditScoreResult,
} from "./services";
