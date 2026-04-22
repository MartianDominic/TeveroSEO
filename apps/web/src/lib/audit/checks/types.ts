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
}

/**
 * Score breakdown by tier
 */
export interface ScoreBreakdown {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
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
}
