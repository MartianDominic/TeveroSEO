/**
 * Check runner for SEO checks.
 * Phase 32: 107 SEO Checks Implementation
 */
import * as cheerio from "cheerio";
import type { CheckResult, CheckContext, RunChecksOptions, CheckTier } from "./types";
import { getChecksByTier, getAllChecks } from "./registry";

/** Maximum HTML size to parse (5MB - DoS mitigation per threat model T-32-02) */
const MAX_HTML_SIZE = 5 * 1024 * 1024;

/** Default timeout for individual checks (30 seconds) */
const DEFAULT_CHECK_TIMEOUT_MS = 30_000;

/** Maximum timeout for all checks combined (5 minutes) */
const MAX_TOTAL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Validate URL format before running audit.
 * @throws Error if URL is invalid
 */
function validateUrl(url: string): URL {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Invalid URL protocol: ${parsed.protocol}. Only http and https are allowed.`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid URL protocol")) {
      throw error;
    }
    throw new Error(`Invalid URL format: ${url}`);
  }
}

/**
 * Run a single check with timeout protection.
 */
async function runCheckWithTimeout(
  check: { id: string; run: (ctx: CheckContext) => CheckResult | Promise<CheckResult> },
  ctx: CheckContext,
  timeoutMs: number
): Promise<CheckResult> {
  return Promise.race([
    Promise.resolve(check.run(ctx)),
    new Promise<CheckResult>((_, reject) =>
      setTimeout(() => reject(new Error(`Check ${check.id} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Deduplicate check results by checkId + element combination.
 * When duplicates exist, keeps the first occurrence.
 */
function deduplicateResults(results: CheckResult[]): CheckResult[] {
  const seen = new Map<string, CheckResult>();

  for (const result of results) {
    // Create a unique key from checkId and element (if present in details)
    const details = result.details as { element?: string; selector?: string } | undefined;
    const elementKey = details?.element ?? details?.selector ?? "";
    const key = `${result.checkId}:${elementKey}`;

    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * Extended options for running checks with timeout configuration.
 */
export interface ExtendedRunChecksOptions extends RunChecksOptions {
  /** Timeout per individual check in milliseconds (default: 30000) */
  checkTimeoutMs?: number;
  /** Total timeout for all checks in milliseconds (default: 300000) */
  totalTimeoutMs?: number;
  /** Whether to deduplicate results (default: true) */
  deduplicate?: boolean;
  /** HTTP response headers for X-Robots-Tag check - FIX-13 (HIGH-SEO-04) */
  responseHeaders?: Record<string, string>;
}

/**
 * Run all registered checks against HTML content.
 * Uses a shared Cheerio instance to avoid re-parsing.
 *
 * @throws Error if URL is invalid or HTML exceeds size limit
 */
export async function runChecks(
  html: string,
  url: string,
  options: ExtendedRunChecksOptions = {}
): Promise<CheckResult[]> {
  // Validate URL format before processing
  validateUrl(url);

  // DoS mitigation: limit HTML size
  if (html.length > MAX_HTML_SIZE) {
    throw new Error(`HTML exceeds maximum size of ${MAX_HTML_SIZE} bytes`);
  }

  // Parse HTML once, share across all checks
  const $ = cheerio.load(html);

  // Build context
  const ctx: CheckContext = {
    $,
    html,
    url,
    keyword: options.keyword,
    pageAnalysis: options.pageAnalysis,
    siteContext: options.siteContext,
    responseHeaders: options.responseHeaders, // FIX-13 (HIGH-SEO-04): Pass headers for X-Robots-Tag check
  };

  // Get checks to run
  const tiers = options.tiers ?? ([1, 2, 3, 4] as CheckTier[]);
  const checks = tiers.flatMap((tier) => getChecksByTier(tier));

  // Configure timeouts
  const checkTimeoutMs = options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
  const totalTimeoutMs = options.totalTimeoutMs ?? MAX_TOTAL_TIMEOUT_MS;
  const startTime = Date.now();

  // Run all checks with timeout protection
  const results: CheckResult[] = [];
  for (const check of checks) {
    // Check total timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= totalTimeoutMs) {
      // Record remaining checks as timed out
      results.push({
        checkId: check.id,
        passed: false,
        severity: "info",
        message: `Check skipped: total audit timeout exceeded (${totalTimeoutMs}ms)`,
        details: { skipped: true, reason: "Total timeout exceeded" },
        autoEditable: false,
      });
      continue;
    }

    try {
      const result = await runCheckWithTimeout(check, ctx, checkTimeoutMs);
      results.push(result);
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes("timed out");
      // Map error severity based on error type
      // Timeouts get "info" severity (not a real failure), other errors get "medium"
      results.push({
        checkId: check.id,
        passed: false,
        severity: isTimeout ? "info" : "medium",
        message: `Check error: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: isTimeout ? { skipped: true, reason: "Timeout" } : undefined,
        autoEditable: false,
      });
    }
  }

  // Deduplicate results by default
  const shouldDeduplicate = options.deduplicate ?? true;
  return shouldDeduplicate ? deduplicateResults(results) : results;
}

/**
 * Run only Tier 1 checks (DOM/regex - instant).
 */
export async function runTier1Checks(
  html: string,
  url: string,
  keyword?: string
): Promise<CheckResult[]> {
  return runChecks(html, url, { tiers: [1], keyword });
}

/**
 * Run only Tier 2 checks (calculation - light compute).
 */
export async function runTier2Checks(
  html: string,
  url: string,
  keyword?: string
): Promise<CheckResult[]> {
  return runChecks(html, url, { tiers: [2], keyword });
}

/**
 * Run Tier 1 and 2 checks (no external dependencies).
 */
export async function runLocalChecks(
  html: string,
  url: string,
  keyword?: string
): Promise<CheckResult[]> {
  return runChecks(html, url, { tiers: [1, 2], keyword });
}

/**
 * Run only Tier 3 checks (API-based - CrUX, GSC, GA4).
 * These checks gracefully skip when API data is unavailable.
 */
export async function runTier3Checks(
  html: string,
  url: string,
  keyword?: string
): Promise<CheckResult[]> {
  return runChecks(html, url, { tiers: [3], keyword });
}

/**
 * Run only Tier 4 checks (crawl-based - site architecture).
 * Requires SiteContext with link graph and click depths.
 */
export async function runTier4Checks(
  html: string,
  url: string,
  siteContext: import("./types").SiteContext,
  keyword?: string
): Promise<CheckResult[]> {
  return runChecks(html, url, { tiers: [4], keyword, siteContext });
}
