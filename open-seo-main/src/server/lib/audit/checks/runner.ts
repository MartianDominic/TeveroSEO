/**
 * Check runner for SEO checks.
 * Phase 32: 107 SEO Checks Implementation
 */
import * as cheerio from "cheerio";
import type { CheckResult, CheckContext, RunChecksOptions, CheckTier } from "./types";
import { getChecksByTier, getAllChecks } from "./registry";

/** Maximum HTML size to parse (5MB - DoS mitigation per threat model T-32-02) */
const MAX_HTML_SIZE = 5 * 1024 * 1024;

/**
 * Run all registered checks against HTML content.
 * Uses a shared Cheerio instance to avoid re-parsing.
 */
export async function runChecks(
  html: string,
  url: string,
  options: RunChecksOptions = {}
): Promise<CheckResult[]> {
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
  };

  // Get checks to run
  const tiers = options.tiers ?? ([1, 2, 3, 4] as CheckTier[]);
  const checks = tiers.flatMap((tier) => getChecksByTier(tier));

  // Run all checks
  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      const result = await check.run(ctx);
      results.push(result);
    } catch (error) {
      // Check failed to run - record as error
      results.push({
        checkId: check.id,
        passed: false,
        severity: "high",
        message: `Check error: ${error instanceof Error ? error.message : "Unknown error"}`,
        autoEditable: false,
      });
    }
  }

  return results;
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
