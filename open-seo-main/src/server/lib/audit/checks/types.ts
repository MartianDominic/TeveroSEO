/**
 * Type definitions for SEO check system.
 * Phase 32: 107 SEO Checks Implementation
 */
import type { CheerioAPI } from "cheerio";
import type { PageAnalysis } from "../types";

/** Severity levels for check results */
export type CheckSeverity = "critical" | "high" | "medium" | "low" | "info";

/** Check tiers: 1=DOM/regex, 2=calculation, 3=API, 4=crawl */
export type CheckTier = 1 | 2 | 3 | 4;

/** Categories for organizing checks */
export type CheckCategory =
  | "html-signals"
  | "heading-structure"
  | "title-meta"
  | "url-structure"
  | "content-structure"
  | "image-basics"
  | "internal-links"
  | "external-links"
  | "schema-basics"
  | "technical-basics"
  | "eeat-signals"
  | "content-quality"
  | "anchor-analysis"
  | "schema-completeness"
  | "freshness"
  | "mobile"
  | "cwv"
  | "entity-nlp"
  | "backlinks"
  | "engagement"
  | "architecture"
  | "differentiation";

/**
 * Extended page analysis data for Tier 2+ checks.
 * Fields may be populated by additional analysis passes.
 */
export interface ExtendedPageAnalysis extends PageAnalysis {
  /** Query type classification (informational, transactional, etc.) */
  queryType?: "informational" | "transactional" | "commercial" | "navigational";
  /** Whether content is YMYL (Your Money Your Life) */
  isYmyl?: boolean;
  /** Sitemap lastmod date for this URL */
  sitemapLastmod?: string;
  /** Content hash for change detection */
  contentHash?: string;
  /** Previous content hash (from last crawl) */
  previousContentHash?: string;
  /** Previous dateModified value (from last crawl) */
  previousDateModified?: string;
}

/**
 * Context passed to each check function.
 * Contains parsed DOM, raw HTML, URL, and optional analysis data.
 */
export interface CheckContext {
  /** Cheerio API instance (shared across all checks - no re-parsing) */
  $: CheerioAPI;
  /** Raw HTML string */
  html: string;
  /** Page URL being checked */
  url: string;
  /** Target keyword for keyword-based checks (optional) */
  keyword?: string;
  /** Pre-computed page analysis data (may include extended fields) */
  pageAnalysis?: PageAnalysis | ExtendedPageAnalysis;
  /** Site-wide context for Tier 4 checks */
  siteContext?: SiteContext;
}

/**
 * Site-wide context for Tier 4 crawl-based checks.
 */
export interface SiteContext {
  /** Total pages in site */
  totalPages: number;
  /** Internal link graph */
  linkGraph?: Map<string, string[]>;
  /** Page click depths from homepage */
  clickDepths?: Map<string, number>;
}

/**
 * Result returned by a check function.
 */
export interface CheckResult {
  /** Check ID (e.g., "T1-01") */
  checkId: string;
  /** Whether the check passed */
  passed: boolean;
  /** Severity of the issue (if failed) */
  severity: CheckSeverity;
  /** Human-readable message explaining the result */
  message: string;
  /** Additional details (values found, thresholds, etc.) */
  details?: Record<string, unknown>;
  /** Whether this issue can be auto-fixed */
  autoEditable: boolean;
  /** Recipe/instructions for auto-fix (if autoEditable) */
  editRecipe?: string;
}

/**
 * Definition of a single SEO check.
 */
export interface CheckDefinition {
  /** Unique check ID (e.g., "T1-01") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Tier: 1=DOM, 2=calc, 3=API, 4=crawl */
  tier: CheckTier;
  /** Category for grouping */
  category: CheckCategory;
  /** Severity when check fails */
  severity: CheckSeverity;
  /** Whether this issue can be auto-fixed */
  autoEditable: boolean;
  /** Recipe/instructions for auto-fix (if autoEditable) */
  editRecipe?: string;
  /** The check function */
  run: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
}

/**
 * Score breakdown structure.
 */
export interface ScoreBreakdown {
  /** Base score (60 points for fundamentals) */
  base: number;
  /** Tier 1 contribution (max 20 points) */
  tier1: number;
  /** Tier 2 contribution (max 10 points) */
  tier2: number;
  /** Tier 3 contribution (max 10 points) */
  tier3: number;
}

/**
 * Result from score calculation.
 */
export interface ScoreResult {
  /** Final score (0-100) */
  score: number;
  /** Applied hard gates (e.g., "noindex", "cwv-poor") */
  gates: string[];
  /** Score breakdown by tier */
  breakdown: ScoreBreakdown;
}

/**
 * Options for running checks.
 */
export interface RunChecksOptions {
  /** Which tiers to run (default: all) */
  tiers?: CheckTier[];
  /** Target keyword for keyword checks */
  keyword?: string;
  /** Pre-computed page analysis */
  pageAnalysis?: PageAnalysis;
  /** Site context for Tier 4 checks */
  siteContext?: SiteContext;
}
