/**
 * Content Briefs Adapter
 * Phase 95-06: Consumer Migration Wiring
 * ADAPT-02: Wired to routeRequest for single-URL scraping
 *
 * Adapts content brief page scraping to use unified ScrapingService.
 *
 * Usage:
 * - For single URLs: use scrapeBriefPage() helper
 * - For batch URLs: Use routeBatchRequest with custom transformer
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import { routeRequest } from "../MigrationRouter";

export interface BriefPageInput {
  url: string;
  keyword: string;
  serpRank: number;
}

export interface BriefPageOutput {
  url: string;
  html: string;
  title?: string;
  h1?: string;
  h2s: string[];
  wordCount?: number;
  internalLinks: number;
  externalLinks: number;
  fetchedAt: Date;
}

export const contentBriefsAdapter: ConsumerAdapter<BriefPageInput, BriefPageOutput> = {
  feature: "contentBriefs",

  toScrapeOptions(input: BriefPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "contentBriefs",
      includeHtml: true,
      includeParsedData: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: BriefPageInput): BriefPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      title: result.parsedData?.title,
      h1: result.parsedData?.h1?.[0],
      h2s: result.parsedData?.h2 ?? [],
      wordCount: result.parsedData?.wordCount,
      internalLinks: result.parsedData?.internalLinks?.length ?? 0,
      externalLinks: result.parsedData?.externalLinks?.length ?? 0,
      fetchedAt: new Date(),
    };
  },

  compareOutputs(legacy: BriefPageOutput, adapted: BriefPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    if (legacy.h2s.length !== adapted.h2s.length) {
      differences.push({
        field: "h2Count",
        legacy: legacy.h2s.length,
        new: adapted.h2s.length,
      });
    }

    return { match: differences.length === 0, differences };
  },
};

// =============================================================================
// ADAPT-02: Helper function for single-URL scraping via adapter pattern
// =============================================================================

/**
 * Scrape a single brief page URL using the adapter pattern.
 * Routes through MigrationRouter for gradual rollout.
 *
 * @param input - URL, keyword, and SERP rank to scrape
 * @param legacyFn - Legacy scraper function for fallback
 * @returns Scraped page in BriefPageOutput format
 *
 * @example
 * ```typescript
 * const page = await scrapeBriefPage(
 *   { url: 'https://example.com', keyword: 'seo tips', serpRank: 1 },
 *   async () => legacyFetcher.fetch(url)
 * );
 * ```
 */
export async function scrapeBriefPage(
  input: BriefPageInput,
  legacyFn: () => Promise<BriefPageOutput>
): Promise<BriefPageOutput> {
  return routeRequest<BriefPageOutput, BriefPageInput>({
    feature: "contentBriefs",
    input,
    adapter: contentBriefsAdapter,
    legacyFn,
    asyncShadow: true, // Non-blocking shadow mode for performance
  });
}
