/**
 * Type definitions for SEO check system.
 * Phase 32: 107 SEO Checks Implementation
 * Phase 92: Tier 5 Content Quality Intelligence
 * Phase 100: JSON-based SEO data extraction (migration support)
 */
import type { CheerioAPI } from "cheerio";
import type { PageAnalysis } from "../types";
import type { Vertical } from "@/server/features/onpage-mastery/types";
import type { SEOExtractionResult } from "@/server/features/scraping/ScraplingClient";

/** Severity levels for check results */
export type CheckSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Check tiers with scoring weights (see scoring.ts):
 * - Tier 1: DOM/regex checks (68 total, 0.3 pts each, max 20 pts)
 * - Tier 2: Calculation checks (21 total, 0.5 pts each, max 10 pts)
 * - Tier 3: API-based checks (13 total, 0.8 pts each, max 6 pts)
 * - Tier 4: Crawl-based checks (7 total, 0.4 pts each, max 4 pts)
 * - Tier 5: Content Quality Intelligence (13 total, opt-in, blocking capable)
 */
export type CheckTier = 1 | 2 | 3 | 4 | 5;

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
  | "differentiation"
  // Tier 5 categories (Phase 92)
  | "quality-gates"
  | "writing-quality"
  | "voice-tone";

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
  /** HTTP response headers (optional, for X-Robots-Tag check) - FIX-13 */
  responseHeaders?: Record<string, string>;
  // Tier 5 fields (Phase 92)
  /** Vertical classification for Tier 5 quality checks */
  vertical?: Vertical;
  /** SERP competitor content for information gain checks */
  serpContent?: string[];
  /** Client ID for voice consistency checks */
  clientId?: string;
}

/**
 * JSON-based context for Phase 100 checks.
 * Uses pre-extracted SEO data from Scrapling service instead of Cheerio parsing.
 * This allows checks to run against structured JSON - no DOM traversal needed.
 */
export interface SEODataContext {
  /** Pre-extracted SEO data from Scrapling service */
  data: SEOExtractionResult;
  /** Page URL being checked */
  url: string;
  /** Target keyword for keyword-based checks (optional) */
  keyword?: string;
  /** Pre-computed page analysis data (may include extended fields) */
  pageAnalysis?: PageAnalysis | ExtendedPageAnalysis;
  /** Site-wide context for Tier 4 checks */
  siteContext?: SiteContext;
  /** HTTP response headers (optional, for X-Robots-Tag check) */
  responseHeaders?: Record<string, string>;
  /** Vertical classification for Tier 5 quality checks */
  vertical?: Vertical;
  /** SERP competitor content for information gain checks */
  serpContent?: string[];
  /** Client ID for voice consistency checks */
  clientId?: string;
}

/**
 * Union type for migration period - checks can accept either context type.
 * Phase 100: Allows gradual migration from Cheerio to JSON-based checks.
 */
export type AnyCheckContext = CheckContext | SEODataContext;

/**
 * Type guard to determine if context is JSON-based (SEODataContext).
 * Returns true if the context has 'data' field and lacks '$' (Cheerio) field.
 */
export function isSEODataContext(ctx: AnyCheckContext): ctx is SEODataContext {
  return "data" in ctx && !("$" in ctx);
}

/**
 * Type guard to determine if context is Cheerio-based (CheckContext).
 * Returns true if the context has '$' (Cheerio) field.
 */
export function isCheerioContext(ctx: AnyCheckContext): ctx is CheckContext {
  return "$" in ctx;
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
  /** Tier 5: If true and check failed, blocks publication */
  blocking?: boolean;
}

/**
 * Definition of a single SEO check.
 */
export interface CheckDefinition {
  /** Unique check ID (e.g., "T1-01") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Tier: 1=DOM, 2=calc, 3=API, 4=crawl, 5=quality */
  tier: CheckTier;
  /** Category for grouping */
  category: CheckCategory;
  /** Severity when check fails */
  severity: CheckSeverity;
  /** Whether this issue can be auto-fixed */
  autoEditable: boolean;
  /** Recipe/instructions for auto-fix (if autoEditable) */
  editRecipe?: string;
  /** Tier 5: If true and check failed, blocks publication */
  blocking?: boolean;
  /**
   * The check function (Cheerio-based, legacy).
   * Use this for checks that require DOM traversal.
   */
  run: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
  /**
   * Phase 100: JSON-based check function.
   * When provided, runner will prefer this over `run` when SEODataContext is available.
   * This enables gradual migration - checks can support both during transition.
   */
  runV2?: (ctx: SEODataContext) => CheckResult | Promise<CheckResult>;
  /**
   * Phase 100: Indicates this check has been fully migrated to JSON-based.
   * When true, the check ONLY supports runV2 and will skip if Cheerio context provided.
   * Default: false (supports both during migration)
   */
  v2Only?: boolean;
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
  /** Tier 3 contribution (max 6 points, normalized) */
  tier3: number;
  /** Tier 4 contribution (max 4 points) */
  tier4?: number;
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
  /**
   * Phase 100: Pre-extracted SEO data from Scrapling service.
   * When provided, checks with runV2 will use JSON-based extraction.
   */
  seoData?: SEOExtractionResult;
  /**
   * Phase 100: Force use of legacy Cheerio-based checks even if seoData provided.
   * Useful for debugging/comparison during migration.
   */
  forceLegacy?: boolean;
}
