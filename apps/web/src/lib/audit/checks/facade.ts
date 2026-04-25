/**
 * SEO Checks Facade
 *
 * Main entry point for running all 107 SEO checks.
 * Phase 40-04: Proxies to open-seo-main for actual check execution.
 */

import type { CheckOptions, AllChecksResult, CheckResult, ScoreResult } from "./types";

const OPEN_SEO_URL = process.env.OPEN_SEO_URL ?? "http://localhost:3001";

/**
 * Run all SEO checks against HTML content
 *
 * Proxies to open-seo-main which has the full 107 check implementation.
 * Falls back to empty results on error to avoid blocking.
 *
 * @param html - The HTML content to analyze
 * @param url - The URL of the page
 * @param options - Check options (keyword, tiers, etc.)
 * @returns Results of all checks with overall score
 *
 * @example
 * ```typescript
 * const { results, score } = await runAllChecks(html, 'https://example.com', {
 *   keyword: 'seo audit',
 *   tiers: [1, 2, 3, 4],
 * });
 *
 * console.log(`Score: ${score.score}/100`);
 * console.log(`Gates: ${score.gates.join(', ')}`);
 * ```
 */
export async function runAllChecks(
  html: string,
  url: string,
  options: CheckOptions = {}
): Promise<AllChecksResult> {
  try {
    const response = await fetch(`${OPEN_SEO_URL}/api/audit/run-checks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        url,
        keyword: options.keyword,
        tiers: options.tiers ?? [1, 2, 3, 4],
      }),
    });

    if (!response.ok) {
      console.error(`Check execution failed: ${response.status}`);
      return getEmptyResult();
    }

    const data = await response.json();

    return {
      results: data.findings as CheckResult[],
      score: data.score as ScoreResult,
    };
  } catch (error) {
    console.error("Failed to run checks via open-seo-main:", error);
    return getEmptyResult();
  }
}

function getEmptyResult(): AllChecksResult {
  return {
    results: [],
    score: {
      score: 0,
      gates: [],
      breakdown: { tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
    },
  };
}

// Re-export types for convenience
export type { CheckOptions, AllChecksResult } from "./types";
