/**
 * SEO Checks Facade
 *
 * Main entry point for running all 107 SEO checks.
 * Combines the check runner and scoring modules.
 */

import type { CheckOptions, AllChecksResult } from "./types";
import { runChecks } from "./runner";
import { calculateOnPageScore } from "./scoring";

/**
 * Run all SEO checks against HTML content
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
  // Run all checks (or filtered by tier)
  const results = runChecks(html, url, options);

  // Calculate overall score
  const score = calculateOnPageScore(results);

  return {
    results,
    score,
  };
}

// Re-export types for convenience
export type { CheckOptions, AllChecksResult } from "./types";
