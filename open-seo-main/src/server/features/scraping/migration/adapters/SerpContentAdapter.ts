/**
 * SERP Content Adapter
 * Phase 95-06: Consumer Migration Wiring
 *
 * Adapts SerpContentAnalyzer to use unified ScrapingService.
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";

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
