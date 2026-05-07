/**
 * Shadow Mode Comparators
 * Phase 95-05: Migration & Monitoring
 *
 * Comparison functions for different scraping result types.
 * Used by shadow-runner to detect differences between legacy and new implementations.
 */

import type { ScrapeResult, ParsedPageData } from "../ScrapingService";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of scraping multiple pages (prospect analysis, etc.)
 */
export interface MultiPageScrapeResult {
  homepage: {
    url: string;
    title: string;
    wordCount: number;
    internalLinks: Array<{ url: string; text?: string }>;
  };
  businessLinks: {
    products?: string;
    about?: string;
    services?: string;
    contact?: string;
  };
  additionalPages: Array<{
    url: string;
    title: string;
    wordCount: number;
  }>;
  totalCostCents: number;
  errors: Array<{ url: string; error: string }>;
}

/**
 * SERP content analysis result.
 */
export interface SerpContentAnalysis {
  commonH2s: Array<{ text: string; count: number }>;
  wordCountStats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  analyzedUrls: number;
  failedUrls: number;
}

/**
 * Generic scrape comparison result.
 */
export interface ComparisonResult {
  match: boolean;
  differences: string[];
}

// =============================================================================
// Numeric Tolerance Helpers
// =============================================================================

/**
 * Check if two numbers are within a percentage tolerance.
 */
function withinPercent(a: number, b: number, tolerancePercent: number): boolean {
  if (a === 0 && b === 0) return true;
  const max = Math.max(a, b);
  const diff = Math.abs(a - b);
  return (diff / max) * 100 <= tolerancePercent;
}

/**
 * Check if two numbers are within an absolute tolerance.
 */
function withinAbsolute(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

// =============================================================================
// Single Page Comparators
// =============================================================================

/**
 * Compare two single-page scrape results.
 */
export function compareSingleScrape(
  legacy: ScrapeResult,
  newResult: ScrapeResult
): ComparisonResult {
  const differences: string[] = [];

  // Compare success status
  if (legacy.success !== newResult.success) {
    differences.push(
      `Success mismatch: legacy=${legacy.success}, new=${newResult.success}`
    );
  }

  // Compare status codes
  if (legacy.statusCode !== newResult.statusCode) {
    differences.push(
      `Status code mismatch: legacy=${legacy.statusCode}, new=${newResult.statusCode}`
    );
  }

  // Compare HTML presence
  const legacyHasHtml = !!legacy.html;
  const newHasHtml = !!newResult.html;
  if (legacyHasHtml !== newHasHtml) {
    differences.push(
      `HTML presence mismatch: legacy=${legacyHasHtml}, new=${newHasHtml}`
    );
  }

  // Compare HTML length (within 10% tolerance)
  if (legacy.html && newResult.html) {
    const legacyLen = legacy.html.length;
    const newLen = newResult.html.length;
    if (!withinPercent(legacyLen, newLen, 10)) {
      differences.push(
        `HTML length diff: legacy=${legacyLen}, new=${newLen} (${Math.round(
          ((newLen - legacyLen) / legacyLen) * 100
        )}%)`
      );
    }
  }

  // Compare quality metrics if available
  if (legacy.quality && newResult.quality) {
    // Word count (within 50 words or 10%)
    if (!withinAbsolute(legacy.quality.wordCount, newResult.quality.wordCount, 50) &&
        !withinPercent(legacy.quality.wordCount, newResult.quality.wordCount, 10)) {
      differences.push(
        `Word count diff: legacy=${legacy.quality.wordCount}, new=${newResult.quality.wordCount}`
      );
    }

    // Acceptable flag
    if (legacy.quality.acceptable !== newResult.quality.acceptable) {
      differences.push(
        `Acceptable mismatch: legacy=${legacy.quality.acceptable}, new=${newResult.quality.acceptable}`
      );
    }
  }

  // Compare cost (new should be cheaper or equal)
  if (newResult.estimatedCostUsd > legacy.estimatedCostUsd * 1.1) {
    // More than 10% more expensive is a concern
    differences.push(
      `Cost regression: legacy=$${legacy.estimatedCostUsd.toFixed(4)}, new=$${newResult.estimatedCostUsd.toFixed(4)}`
    );
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

// =============================================================================
// Multi-Page (Prospect Analysis) Comparators
// =============================================================================

/**
 * Compare prospect page scrape results.
 */
export function compareProspectScrape(
  legacy: MultiPageScrapeResult,
  newResult: MultiPageScrapeResult
): ComparisonResult {
  const differences: string[] = [];

  // Compare homepage title
  if (legacy.homepage.title !== newResult.homepage.title) {
    differences.push(
      `Title mismatch: "${legacy.homepage.title}" vs "${newResult.homepage.title}"`
    );
  }

  // Compare homepage word count (within 50 words)
  if (!withinAbsolute(legacy.homepage.wordCount, newResult.homepage.wordCount, 50)) {
    differences.push(
      `Word count diff: ${legacy.homepage.wordCount} vs ${newResult.homepage.wordCount}`
    );
  }

  // Compare internal link counts (within 5 links)
  const legacyLinks = legacy.homepage.internalLinks.length;
  const newLinks = newResult.homepage.internalLinks.length;
  if (!withinAbsolute(legacyLinks, newLinks, 5)) {
    differences.push(`Internal link count diff: ${legacyLinks} vs ${newLinks}`);
  }

  // Compare business link detection
  const businessCategories = ["products", "about", "services", "contact"] as const;
  for (const category of businessCategories) {
    const legacyLink = legacy.businessLinks[category];
    const newLink = newResult.businessLinks[category];

    // Both should detect or both should miss
    if ((legacyLink && !newLink) || (!legacyLink && newLink)) {
      differences.push(
        `Business link "${category}" mismatch: legacy=${legacyLink ?? "none"}, new=${newLink ?? "none"}`
      );
    }
  }

  // Compare additional pages count
  if (legacy.additionalPages.length !== newResult.additionalPages.length) {
    differences.push(
      `Additional pages count diff: ${legacy.additionalPages.length} vs ${newResult.additionalPages.length}`
    );
  }

  // Compare error counts
  if (legacy.errors.length !== newResult.errors.length) {
    differences.push(
      `Error count diff: ${legacy.errors.length} vs ${newResult.errors.length}`
    );
  }

  // Compare total cost
  const costDiff = legacy.totalCostCents - newResult.totalCostCents;
  if (costDiff !== 0) {
    differences.push(
      `Cost diff: $${(legacy.totalCostCents / 100).toFixed(4)} vs $${(
        newResult.totalCostCents / 100
      ).toFixed(4)}`
    );
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

// =============================================================================
// SERP Content Comparators
// =============================================================================

/**
 * Compare SERP content analysis results.
 */
export function compareSerpContent(
  legacy: SerpContentAnalysis,
  newResult: SerpContentAnalysis
): ComparisonResult {
  const differences: string[] = [];

  // Compare H2 counts (within 2)
  if (!withinAbsolute(legacy.commonH2s.length, newResult.commonH2s.length, 2)) {
    differences.push(
      `H2 count diff: ${legacy.commonH2s.length} vs ${newResult.commonH2s.length}`
    );
  }

  // Compare word count stats
  const stats = ["min", "max", "avg", "median"] as const;
  for (const stat of stats) {
    const legacyVal = legacy.wordCountStats[stat];
    const newVal = newResult.wordCountStats[stat];

    // Within 200 words or 20% for word counts
    if (!withinAbsolute(legacyVal, newVal, 200) &&
        !withinPercent(legacyVal, newVal, 20)) {
      differences.push(
        `Word count ${stat} diff: ${legacyVal} vs ${newVal}`
      );
    }
  }

  // Compare analyzed URL counts
  if (legacy.analyzedUrls !== newResult.analyzedUrls) {
    differences.push(
      `Analyzed URL count diff: ${legacy.analyzedUrls} vs ${newResult.analyzedUrls}`
    );
  }

  // Compare failed URL counts
  if (legacy.failedUrls !== newResult.failedUrls) {
    differences.push(
      `Failed URL count diff: ${legacy.failedUrls} vs ${newResult.failedUrls}`
    );
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

// =============================================================================
// Parsed Data Comparators
// =============================================================================

/**
 * Compare parsed page data.
 */
export function compareParsedData(
  legacy: ParsedPageData,
  newResult: ParsedPageData
): ComparisonResult {
  const differences: string[] = [];

  // Compare title
  if (legacy.title !== newResult.title) {
    differences.push(
      `Title mismatch: "${legacy.title}" vs "${newResult.title}"`
    );
  }

  // Compare meta description
  if (legacy.metaDescription !== newResult.metaDescription) {
    const legacyDesc = legacy.metaDescription?.slice(0, 50);
    const newDesc = newResult.metaDescription?.slice(0, 50);
    differences.push(
      `Meta description mismatch: "${legacyDesc}..." vs "${newDesc}..."`
    );
  }

  // Compare H1 count
  const legacyH1Count = legacy.h1?.length ?? 0;
  const newH1Count = newResult.h1?.length ?? 0;
  if (legacyH1Count !== newH1Count) {
    differences.push(`H1 count diff: ${legacyH1Count} vs ${newH1Count}`);
  }

  // Compare H2 count (within 2)
  const legacyH2Count = legacy.h2?.length ?? 0;
  const newH2Count = newResult.h2?.length ?? 0;
  if (!withinAbsolute(legacyH2Count, newH2Count, 2)) {
    differences.push(`H2 count diff: ${legacyH2Count} vs ${newH2Count}`);
  }

  // Compare canonical
  if (legacy.canonical !== newResult.canonical) {
    differences.push(
      `Canonical mismatch: "${legacy.canonical}" vs "${newResult.canonical}"`
    );
  }

  // Compare word count (within 50)
  const legacyWords = legacy.wordCount ?? 0;
  const newWords = newResult.wordCount ?? 0;
  if (!withinAbsolute(legacyWords, newWords, 50)) {
    differences.push(`Word count diff: ${legacyWords} vs ${newWords}`);
  }

  // Compare internal link count (within 5)
  const legacyInternalLinks = legacy.internalLinks?.length ?? 0;
  const newInternalLinks = newResult.internalLinks?.length ?? 0;
  if (!withinAbsolute(legacyInternalLinks, newInternalLinks, 5)) {
    differences.push(
      `Internal link count diff: ${legacyInternalLinks} vs ${newInternalLinks}`
    );
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

// =============================================================================
// Batch Result Comparators
// =============================================================================

/**
 * Compare batch scrape results.
 */
export function compareBatchResults(
  legacy: Map<string, ScrapeResult>,
  newResult: Map<string, ScrapeResult>
): ComparisonResult {
  const differences: string[] = [];

  // Compare URL counts
  if (legacy.size !== newResult.size) {
    differences.push(
      `URL count diff: legacy=${legacy.size}, new=${newResult.size}`
    );
  }

  // Compare individual results
  let successMatches = 0;
  let successMismatches = 0;

  for (const [url, legacyRes] of legacy) {
    const newRes = newResult.get(url);

    if (!newRes) {
      differences.push(`Missing URL in new results: ${url}`);
      continue;
    }

    if (legacyRes.success !== newRes.success) {
      successMismatches++;
      if (successMismatches <= 5) {
        differences.push(
          `Success mismatch for ${url}: legacy=${legacyRes.success}, new=${newRes.success}`
        );
      }
    } else {
      successMatches++;
    }
  }

  // Add summary if many mismatches
  if (successMismatches > 5) {
    differences.push(`...and ${successMismatches - 5} more success mismatches`);
  }

  // Compare aggregate success rate
  const legacySuccessRate =
    Array.from(legacy.values()).filter((r) => r.success).length / legacy.size;
  const newSuccessRate =
    Array.from(newResult.values()).filter((r) => r.success).length /
    newResult.size;

  if (!withinPercent(legacySuccessRate * 100, newSuccessRate * 100, 5)) {
    differences.push(
      `Success rate diff: legacy=${(legacySuccessRate * 100).toFixed(1)}%, new=${(
        newSuccessRate * 100
      ).toFixed(1)}%`
    );
  }

  return {
    match: differences.length === 0,
    differences,
  };
}
