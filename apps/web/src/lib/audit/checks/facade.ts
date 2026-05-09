/**
 * SEO Checks Facade
 *
 * Main entry point for running all 107 SEO checks.
 * Phase 40-04: Proxies to open-seo-main for actual check execution.
 */

import * as crypto from "crypto";

import { logger } from '@/lib/logger';

import {
  isValidCheckResult,
  isValidCheckResponse,
} from "./types";

import type {
  CheckOptions,
  AllChecksResult,
  CheckResult,
  ScoreResult,
} from "./types";
/**
 * Request timeout in milliseconds (120 seconds).
 * FIX H-COMM-04: Increased from 30s to 120s because audits can take 5+ minutes.
 * For very long audits, consider implementing a polling pattern instead.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Get Open SEO URL from centralized env (validated at startup).
 * Using dynamic import to avoid module initialization issues.
 */
async function getOpenSeoUrlAsync(): Promise<string> {
  const { getOpenSeoUrl } = await import("@/lib/env");
  return getOpenSeoUrl();
}

/** Internal API key for service-to-service auth */
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Generate internal auth headers for service-to-service calls.
 * FIX H-COMM-02: Added HMAC signing for cross-service authentication.
 */
function getInternalAuthHeaders(body: string): HeadersInit {
  if (!INTERNAL_API_KEY) {
    // In development, auth may be optional
    return { "Content-Type": "application/json" };
  }

  const timestamp = Date.now();
  const message = `${timestamp}.${body}`;
  const signature = crypto
    .createHmac("sha256", INTERNAL_API_KEY)
    .update(message)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Internal-Timestamp": timestamp.toString(),
    "X-Internal-Signature": signature,
  };
}


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
 *   logger.error('Check execution failed', error instanceof Error ? error : { error: String(error) });
 * } else {
 *   logger.debug(`Score: ${score.score}/100`);
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
    // Get URL from centralized env (validated at startup)
    const openSeoUrl = await getOpenSeoUrlAsync();

    const requestBody = JSON.stringify({
      html,
      url,
      keyword: options.keyword,
      tiers: options.tiers ?? [1, 2, 3, 4],
    });

    const response = await fetch(`${openSeoUrl}/api/audit/run-checks`, {
      method: "POST",
      headers: getInternalAuthHeaders(requestBody),
      body: requestBody,
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
        logger.warn("Skipping invalid check result:", { detail: item });
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
