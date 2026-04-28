/**
 * SEO Check Types
 * Ported from open-seo-main/src/server/lib/audit/checks/types.ts
 *
 * These types define the structure for the 107 SEO checks system.
 */

/**
 * Check severity levels - determines impact on overall score
 */
export type CheckSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Check tiers - grouped by priority/complexity
 * T1: Critical on-page (title, meta, H1) - 27 checks
 * T2: Content quality (word count, readability) - 25 checks
 * T3: Technical SEO (links, images, schema) - 30 checks
 * T4: Advanced (performance, mobile, security) - 25 checks
 */
export type CheckTier = 1 | 2 | 3 | 4;

/**
 * Check category for grouping in UI
 */
export type CheckCategory =
  | "title"
  | "meta"
  | "headings"
  | "content"
  | "links"
  | "images"
  | "schema"
  | "technical"
  | "performance"
  | "mobile"
  | "security"
  | "accessibility";

/**
 * Result of a single SEO check
 */
export interface CheckResult {
  /** Unique identifier for the check (e.g., "T1-01", "T2-15") */
  checkId: string;
  /** Whether the check passed */
  passed: boolean;
  /** Severity if failed */
  severity: CheckSeverity;
  /** Human-readable message explaining the result */
  message: string;
  /** Optional additional details */
  details?: Record<string, unknown>;
  /** Whether this issue can be auto-fixed */
  autoEditable: boolean;
  /** Recipe ID for auto-fix if applicable */
  editRecipe?: string;
  /** Tier of this check (1-4) */
  tier?: CheckTier;
}

/**
 * Score breakdown by tier
 *
 * Supports two scoring models:
 * 1. New model (base + tier1-3): base=60 + tier contributions (max 100)
 * 2. Legacy model (tier1-4): percentage scores per tier
 *
 * The new model is preferred. Legacy tier4 is optional for backward compat.
 */
export interface ScoreBreakdown {
  /** Base score for fundamentals (60 points in new scoring model) */
  base?: number;
  /** Tier 1 score/contribution */
  tier1: number;
  /** Tier 2 score/contribution */
  tier2: number;
  /** Tier 3 score/contribution */
  tier3: number;
  /** Tier 4 score (legacy, optional - new model uses gates instead) */
  tier4?: number;
}

/**
 * Overall score result with gates
 */
export interface ScoreResult {
  /** Overall SEO score 0-100 */
  score: number;
  /** List of blocking gates (e.g., "missing-title", "no-h1") */
  gates: string[];
  /** Score breakdown by tier */
  breakdown: ScoreBreakdown;
}

/**
 * Page analysis data extracted from HTML
 */
export interface PageAnalysis {
  title?: string;
  metaDescription?: string;
  h1?: string[];
  h2?: string[];
  wordCount?: number;
  images?: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  links?: Array<{
    href: string;
    text: string;
    isExternal: boolean;
  }>;
  schema?: Record<string, unknown>[];
}

/**
 * Site-wide context for cross-page checks
 */
export interface SiteContext {
  domain: string;
  totalPages: number;
  robotsTxt?: string;
  sitemapXml?: string;
}

/**
 * Options for running checks
 */
export interface CheckOptions {
  /** Target keyword for keyword-based checks */
  keyword?: string;
  /** Which tiers to run (default: all) */
  tiers?: CheckTier[];
  /** Pre-parsed page analysis */
  pageAnalysis?: PageAnalysis;
  /** Site-wide context */
  siteContext?: SiteContext;
}

/**
 * Check definition - metadata about a check
 */
export interface CheckDefinition {
  id: string;
  name: string;
  description: string;
  tier: CheckTier;
  category: CheckCategory;
  severity: CheckSeverity;
  autoEditable: boolean;
  editRecipe?: string;
}

/**
 * Result of runAllChecks facade
 */
export interface AllChecksResult {
  results: CheckResult[];
  score: ScoreResult;
  /** Error message if API call failed */
  error?: string;
}

// -----------------------------------------------------------------------------
// Type Guards for Runtime Validation
// -----------------------------------------------------------------------------

/**
 * Type guard to validate ScoreBreakdown structure at runtime
 * Supports both new model (base + tier1-3) and legacy model (tier1-4)
 */
export function isValidScoreBreakdown(obj: unknown): obj is ScoreBreakdown {
  if (!obj || typeof obj !== "object") return false;
  const b = obj as Record<string, unknown>;
  // Required fields: tier1, tier2, tier3
  if (typeof b.tier1 !== "number") return false;
  if (typeof b.tier2 !== "number") return false;
  if (typeof b.tier3 !== "number") return false;
  // Optional fields: base, tier4
  if (b.base !== undefined && typeof b.base !== "number") return false;
  if (b.tier4 !== undefined && typeof b.tier4 !== "number") return false;
  return true;
}

/**
 * Type guard to validate ScoreResult structure at runtime
 */
export function isValidScoreResult(obj: unknown): obj is ScoreResult {
  if (!obj || typeof obj !== "object") return false;
  const s = obj as Record<string, unknown>;
  if (typeof s.score !== "number") return false;
  if (!Array.isArray(s.gates)) return false;
  if (!s.breakdown || typeof s.breakdown !== "object") return false;
  return isValidScoreBreakdown(s.breakdown);
}

/**
 * Type guard to validate CheckResult structure at runtime
 */
export function isValidCheckResult(obj: unknown): obj is CheckResult {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Record<string, unknown>;
  if (typeof r.checkId !== "string") return false;
  if (typeof r.passed !== "boolean") return false;
  if (typeof r.severity !== "string") return false;
  if (typeof r.message !== "string") return false;
  // autoEditable is required
  if (typeof r.autoEditable !== "boolean") return false;
  // Validate severity is one of allowed values
  const validSeverities: string[] = ["critical", "high", "medium", "low", "info"];
  if (!validSeverities.includes(r.severity as string)) return false;
  // Optional fields
  if (r.tier !== undefined) {
    if (typeof r.tier !== "number") {
      return false;
    }
    // Now TypeScript knows r.tier is a number
    if (![1, 2, 3, 4].includes(r.tier)) {
      return false;
    }
  }
  if (r.editRecipe !== undefined && typeof r.editRecipe !== "string") {
    return false;
  }
  if (r.details !== undefined && (typeof r.details !== "object" || r.details === null)) {
    return false;
  }
  return true;
}

/**
 * Type guard to validate API response structure with findings and score
 */
export function isValidCheckResponse(
  obj: unknown
): obj is { findings: CheckResult[]; score: ScoreResult } {
  if (!obj || typeof obj !== "object") return false;
  const response = obj as Record<string, unknown>;

  // Must have findings array
  if (!Array.isArray(response.findings)) return false;

  // Validate each finding
  for (const finding of response.findings) {
    if (!isValidCheckResult(finding)) return false;
  }

  // Must have valid score
  if (!isValidScoreResult(response.score)) return false;

  return true;
}

/**
 * Type guard to validate AllChecksResult structure at runtime
 */
export function isValidAllChecksResult(obj: unknown): obj is AllChecksResult {
  if (!obj || typeof obj !== "object") return false;
  const result = obj as Record<string, unknown>;

  // Must have results array
  if (!Array.isArray(result.results)) return false;

  // Validate each result
  for (const r of result.results) {
    if (!isValidCheckResult(r)) return false;
  }

  // Must have valid score
  if (!isValidScoreResult(result.score)) return false;

  // Error is optional string
  if (result.error !== undefined && typeof result.error !== "string") {
    return false;
  }

  return true;
}
