/**
 * Keyword Services Barrel Export
 *
 * Re-exports all keyword-related services and utilities.
 */

// Deduplicator
export {
  KeywordDeduplicator,
  keywordDeduplicator,
  normalizeKeyword,
  type DeduplicationResult,
} from "./KeywordDeduplicator";

// Enrichment
export {
  KeywordEnrichmentService,
  keywordEnrichmentService,
  CACHE_PREFIX,
  CACHE_TTL_SECONDS,
  BATCH_SIZE,
  COST_PER_KEYWORD_CENTS,
  type EnrichmentResult,
} from "./KeywordEnrichmentService";

// Input orchestrator
export {
  KeywordInputService,
  keywordInputService,
  type KeywordEntryPoint,
  type AddKeywordsInput,
  type AddKeywordsResult,
} from "./KeywordInputService";

// Quick Check (no-workspace keyword validation)
export {
  QuickCheckService,
  quickCheckService,
  type QuickCheckKeyword,
  type QuickCheckResult,
  type ShareableResult,
} from "./QuickCheckService";

// Competitor Spy (keyword extraction)
export {
  CompetitorSpyService,
  competitorSpyService,
  type CompetitorKeyword,
  type CompetitorSpyResult,
} from "./CompetitorSpyService";

// Column detection
export {
  ColumnDetector,
  columnDetector,
  type DetectedFormat,
  type ColumnMapping,
  type CsvColumnDetection,
} from "./ColumnDetector";

// CSV import
export {
  CsvImportService,
  csvImportService,
  type CsvImportOptions,
  type CsvImportResult,
  type CsvPreviewResult,
} from "./CsvImportService";

// Quick Win Detection (Phase 43-04)
export {
  QuickWinDetector,
  quickWinDetector,
  DEFAULT_QUICK_WIN_CRITERIA,
  type QuickWinCriteria,
  type QuickWinResult,
} from "./QuickWinDetector";

// Prioritization (Phase 43-04)
export {
  PrioritizationService,
  prioritizationService,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type ScoreWeights,
  type TierThresholds,
  type PrioritizationResult,
} from "./PrioritizationService";

// Coverage Calculator (Phase 93-03)
export {
  CoverageCalculator,
  coverageCalculator,
  type CoverageSummary,
  type TierCoverage,
  type CoverageLevel,
} from "./CoverageCalculator";
