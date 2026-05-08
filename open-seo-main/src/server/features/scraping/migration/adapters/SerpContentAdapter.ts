/**
 * SERP Content Adapter
 * Phase 95-06: Consumer Migration Wiring
 * ADAPT-01: Wired to routeRequest for single-URL scraping
 *
 * Adapts SerpContentAnalyzer to use unified ScrapingService.
 *
 * Usage:
 * - For single URLs: use scrapeSerpContent() helper
 * - For batch URLs: SerpContentAnalyzer.analyzeSerpContent() uses routeBatchRequest directly
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import { routeRequest } from "../MigrationRouter";

export interface SerpContentInput {
  url: string;
  keyword: string;
  serpPosition?: number;
}

export interface SerpContentOutput {
  url: string;
  html: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount?: number;
  fetchedAt: Date;
}

export const serpContentAdapter: ConsumerAdapter<SerpContentInput, SerpContentOutput> = {
  feature: "serpContent",

  toScrapeOptions(input: SerpContentInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "serpContent",
      includeHtml: true,
      includeParsedData: true,
      // SERP content pages are typically simple HTML
      maxTier: "dfs_js", // Don't escalate to browser for SERP content
    };
  },

  toConsumerOutput(result: ScrapeResult, input: SerpContentInput): SerpContentOutput {
    return {
      url: input.url,
      html: result.html ?? "",
      title: result.parsedData?.title,
      metaDescription: result.parsedData?.metaDescription,
      h1: result.parsedData?.h1?.[0],
      wordCount: result.parsedData?.wordCount,
      fetchedAt: new Date(),
    };
  },

  compareOutputs(legacy: SerpContentOutput, adapted: SerpContentOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    if (legacy.wordCount !== adapted.wordCount) {
      differences.push({
        field: "wordCount",
        legacy: legacy.wordCount,
        new: adapted.wordCount,
      });
    }

    // Title comparison (normalize whitespace)
    const legacyTitle = legacy.title?.trim().toLowerCase();
    const adaptedTitle = adapted.title?.trim().toLowerCase();
    if (legacyTitle !== adaptedTitle) {
      differences.push({
        field: "title",
        legacy: legacy.title,
        new: adapted.title,
      });
    }

    return {
      match: differences.length === 0,
      differences,
    };
  },
};

// =============================================================================
// ADAPT-01: Helper function for single-URL scraping via adapter pattern
// =============================================================================

/**
 * Scrape a single SERP content URL using the adapter pattern.
 * Routes through MigrationRouter for gradual rollout.
 *
 * @param input - URL and keyword to scrape
 * @param legacyFn - Legacy scraper function for fallback
 * @returns Scraped content in SerpContentOutput format
 *
 * @example
 * ```typescript
 * const content = await scrapeSerpContent(
 *   { url: 'https://example.com', keyword: 'seo tips' },
 *   async () => legacyFetcher.fetch(url)
 * );
 * ```
 */
export async function scrapeSerpContent(
  input: SerpContentInput,
  legacyFn: () => Promise<SerpContentOutput>
): Promise<SerpContentOutput> {
  return routeRequest<SerpContentOutput, SerpContentInput>({
    feature: "serpContent",
    input,
    adapter: serpContentAdapter,
    legacyFn,
    asyncShadow: true, // Non-blocking shadow mode for performance
  });
}
