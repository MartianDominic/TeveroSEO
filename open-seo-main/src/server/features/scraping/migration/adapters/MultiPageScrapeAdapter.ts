/**
 * Multi-Page Scrape Adapter
 * Phase 95-06: Consumer Migration Wiring
 *
 * Adapts multiPageScraper (prospect website scraping) to unified ScrapingService.
 * Handles batch scraping of homepage + business pages (up to 4 total).
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions, BatchScrapeResult } from "../../ScrapingService";
import type { PageAnalysis } from "@/server/lib/audit/types";
import type { BusinessLinks, MultiPageScrapeResult } from "@/server/lib/scraper/types";

// =============================================================================
// Input/Output Types
// =============================================================================

/**
 * Input for a single page scrape within multi-page context.
 */
export interface MultiPageInput {
  url: string;
  pageType: "homepage" | "product" | "about" | "services" | "contact" | "category";
}

/**
 * Output for a single page scrape (compatible with PageAnalysis).
 */
export interface MultiPageOutput {
  url: string;
  html: string;
  statusCode: number;
  title?: string;
  metaDescription?: string;
  h1s: string[];
  wordCount?: number;
  internalLinks: string[];
  externalLinks: string[];
  images: Array<{ src: string | null; alt: string | null }>;
  fetchedAt: Date;
  costCents: number;
}

/**
 * Batch input for multi-page scraping.
 */
export interface MultiPageBatchInput {
  domain: string;
  urls: string[];
  businessLinks: BusinessLinks;
}

/**
 * Batch output matching MultiPageScrapeResult structure.
 */
export interface MultiPageBatchOutput {
  homepage: PageAnalysis;
  businessLinks: BusinessLinks;
  additionalPages: PageAnalysis[];
  totalCostCents: number;
  errors: Array<{ url: string; error: string }>;
}

// =============================================================================
// Single Page Adapter
// =============================================================================

/**
 * Adapter for single page within multi-page scraping context.
 */
export const multiPageSingleAdapter: ConsumerAdapter<MultiPageInput, MultiPageOutput> = {
  feature: "prospectAnalysis",

  toScrapeOptions(input: MultiPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "prospectAnalysis",
      includeHtml: true,
      includeParsedData: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: MultiPageInput): MultiPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      statusCode: result.statusCode ?? 0,
      title: result.parsedData?.title,
      metaDescription: result.parsedData?.metaDescription,
      h1s: result.parsedData?.h1 ?? [],
      wordCount: result.parsedData?.wordCount,
      internalLinks: (result.parsedData?.internalLinks ?? []).map((l) => l.url),
      externalLinks: (result.parsedData?.externalLinks ?? []).map((l) => l.url),
      images: (result.parsedData?.images ?? []).map((i) => ({ src: i.src, alt: i.alt })),
      fetchedAt: new Date(),
      costCents: Math.round(result.estimatedCostUsd * 100),
    };
  },

  compareOutputs(legacy: MultiPageOutput, adapted: MultiPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    // Compare status codes
    if (legacy.statusCode !== adapted.statusCode) {
      differences.push({
        field: "statusCode",
        legacy: legacy.statusCode,
        new: adapted.statusCode,
      });
    }

    // Compare word count with tolerance
    const wordCountDiff = Math.abs((legacy.wordCount ?? 0) - (adapted.wordCount ?? 0));
    if (wordCountDiff > 50) {
      differences.push({
        field: "wordCount",
        legacy: legacy.wordCount,
        new: adapted.wordCount,
      });
    }

    // Compare internal link counts (allow some variance)
    const linkCountDiff = Math.abs(legacy.internalLinks.length - adapted.internalLinks.length);
    if (linkCountDiff > 5) {
      differences.push({
        field: "internalLinkCount",
        legacy: legacy.internalLinks.length,
        new: adapted.internalLinks.length,
      });
    }

    return { match: differences.length === 0, differences };
  },
};

// =============================================================================
// Batch Transformation Utilities
// =============================================================================

/**
 * Convert ScrapeResult to PageAnalysis format.
 * Used for transforming batch results to match legacy MultiPageScrapeResult.
 */
export function scrapeResultToPageAnalysis(result: ScrapeResult): PageAnalysis {
  return {
    url: result.url,
    statusCode: result.statusCode ?? 200,
    redirectUrl: null, // Not available in ScrapeResult.parsedData
    responseTimeMs: result.responseTimeMs ?? 0,

    // Head metadata
    title: result.parsedData?.title ?? "",
    metaDescription: result.parsedData?.metaDescription ?? "",
    canonical: result.parsedData?.canonical ?? null,
    robotsMeta: null, // Would need to parse from HTML
    ogTitle: null, // Would need to parse from HTML
    ogDescription: null, // Would need to parse from HTML
    ogImage: null, // Would need to parse from HTML

    // Headings
    h1s: result.parsedData?.h1 ?? [],
    headingOrder: [], // Would need to parse from HTML

    // Content
    wordCount: result.parsedData?.wordCount ?? 0,

    // Images
    images: (result.parsedData?.images ?? []).map((i) => ({
      src: i.src,
      alt: i.alt,
    })),

    // Links
    internalLinks: (result.parsedData?.internalLinks ?? []).map((l) => l.url),
    externalLinks: (result.parsedData?.externalLinks ?? []).map((l) => l.url),

    // Structured data
    hasStructuredData: false, // Would need to parse from HTML

    // Hreflang
    hreflangTags: [], // Would need to parse from HTML
  };
}

/**
 * Convert BatchScrapeResult to MultiPageScrapeResult format.
 *
 * @param batchResult - Result from ScrapingService.scrapeBatch()
 * @param homepageUrl - URL of the homepage (first in batch)
 * @param businessLinks - Detected business links
 * @returns Legacy-compatible MultiPageScrapeResult
 */
export function batchResultToMultiPageResult(
  batchResult: BatchScrapeResult,
  homepageUrl: string,
  businessLinks: BusinessLinks
): MultiPageScrapeResult {
  const results = batchResult.results;
  const errors: Array<{ url: string; error: string }> = [];
  const additionalPages: PageAnalysis[] = [];

  // Find homepage result
  const homepageResult = results.find((r) => r.url === homepageUrl);
  if (!homepageResult || !homepageResult.success) {
    throw new Error(`Failed to scrape homepage: ${homepageResult?.error ?? "not found"}`);
  }

  const homepage = scrapeResultToPageAnalysis(homepageResult);

  // Process additional pages
  for (const result of results) {
    if (result.url === homepageUrl) continue; // Skip homepage

    if (result.success) {
      additionalPages.push(scrapeResultToPageAnalysis(result));
    } else {
      errors.push({
        url: result.url,
        error: result.error ?? "Unknown error",
      });
    }
  }

  return {
    homepage,
    businessLinks,
    additionalPages,
    totalCostCents: Math.round(batchResult.totalCostUsd * 100),
    errors,
  };
}

/**
 * Compare two MultiPageScrapeResult objects for shadow mode validation.
 */
export function compareMultiPageResults(
  legacy: MultiPageScrapeResult,
  adapted: MultiPageScrapeResult
): ComparisonResult {
  const differences: ComparisonResult["differences"] = [];

  // Compare homepage title
  if (legacy.homepage.title !== adapted.homepage.title) {
    differences.push({
      field: "homepage.title",
      legacy: legacy.homepage.title,
      new: adapted.homepage.title,
    });
  }

  // Compare additional page count
  if (legacy.additionalPages.length !== adapted.additionalPages.length) {
    differences.push({
      field: "additionalPagesCount",
      legacy: legacy.additionalPages.length,
      new: adapted.additionalPages.length,
    });
  }

  // Compare error count
  if (legacy.errors.length !== adapted.errors.length) {
    differences.push({
      field: "errorCount",
      legacy: legacy.errors.length,
      new: adapted.errors.length,
    });
  }

  // Compare total cost (within 10% tolerance)
  const costDiff = Math.abs(legacy.totalCostCents - adapted.totalCostCents);
  const costTolerance = Math.max(legacy.totalCostCents, adapted.totalCostCents) * 0.1;
  if (costDiff > costTolerance) {
    differences.push({
      field: "totalCostCents",
      legacy: legacy.totalCostCents,
      new: adapted.totalCostCents,
    });
  }

  return { match: differences.length === 0, differences };
}
