/**
 * SEO Checks Facade
 *
 * Main entry point for running all 107 SEO checks.
 * Phase 40-04: Proxies to open-seo-main for actual check execution.
 */

import type {
  CheckOptions,
  AllChecksResult,
  CheckResult,
  ScoreResult,
} from "./types";
import {
  isValidCheckResult,
  isValidCheckResponse,
} from "./types";

/** Request timeout in milliseconds (30 seconds) */
const REQUEST_TIMEOUT_MS = 30000;

/** Configurable open-seo-main URL */
const OPEN_SEO_URL =
  process.env.OPEN_SEO_URL ??
  process.env.NEXT_PUBLIC_OPEN_SEO_URL ??
  "http://localhost:3001";


/**
 * Run all SEO checks against HTML content
 *
 * Proxies to open-seo-main which has the full 107 check implementation.
 * Returns error indicator on failure instead of silently returning empty results.
 *
 * @param html - The HTML content to analyze
 * @param url - The URL of the page
 * @param options - Check options (keyword, tiers, etc.)
 * @returns Results of all checks with overall score
 *
 * @example
 * ```typescript
 * const { results, score, error } = await runAllChecks(html, 'https://example.com', {
 *   keyword: 'seo audit',
 *   tiers: [1, 2, 3, 4],
 * });
 *
 * if (error) {
 *   console.error('Check execution failed:', error);
 * } else {
 *   console.log(`Score: ${score.score}/100`);
 *   console.log(`Gates: ${score.gates.join(', ')}`);
 * }
 * ```
 */
export async function runAllChecks(
  html: string,
  url: string,
  options: CheckOptions = {}
): Promise<AllChecksResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[SEO Checks] Check execution failed", {
        status: response.status,
        url,
        keyword: options.keyword,
        tiersRequested: options.tiers ?? [1, 2, 3, 4],
      });
      return getErrorResult(`API returned status ${response.status}`);
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (!isValidCheckResponse(data)) {
      console.error("[SEO Checks] Invalid response format from open-seo-main", {
        url,
        responseKeys: typeof data === "object" && data !== null ? Object.keys(data) : [],
      });
      return getErrorResult("Invalid response format from API");
    }

    // Validate and filter check results
    const validResults: CheckResult[] = [];
    for (const item of data.findings) {
      if (isValidCheckResult(item)) {
        validResults.push(item);
      } else {
        console.warn("Skipping invalid check result:", item);
      }
    }

    return {
      results: validResults,
      score: data.score as ScoreResult,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[SEO Checks] Request timed out", {
        timeoutMs: REQUEST_TIMEOUT_MS,
        url,
        keyword: options.keyword,
      });
      return getErrorResult("Request timed out");
    }

    console.error("[SEO Checks] Failed to run checks via open-seo-main", {
      url,
      keyword: options.keyword,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return getErrorResult(
      error instanceof Error ? error.message : "Unknown error"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get empty result for cases where checks cannot be run
 */
function getEmptyResult(): AllChecksResult {
  return {
    results: [],
    score: {
      score: 0,
      gates: [],
      breakdown: { base: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
    },
  };
}

/**
 * Get error result with sentinel score value
 */
function getErrorResult(errorMessage: string): AllChecksResult {
  return {
    results: [],
    score: {
      score: -1, // Sentinel value indicating error
      gates: ["API_UNAVAILABLE"],
      breakdown: { base: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
    },
    error: errorMessage,
  };
}

// Re-export types for convenience
export type { CheckOptions, AllChecksResult } from "./types";
