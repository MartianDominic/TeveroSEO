/**
 * Competitor Spy Adapter
 * Phase 95-06: Consumer Migration Wiring
 *
 * Adapts CompetitorSpyService page fetching to unified ScrapingService.
 * Note: Keyword API calls (fetchOrganicKeywords) remain direct - only HTML fetching migrates.
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";

export interface CompetitorPageInput {
  url: string;
  competitorDomain: string;
  targetKeyword?: string;
}

export interface CompetitorPageOutput {
  url: string;
  html: string;
  wordCount?: number;
  headings?: {
    h1: string[];
    h2: string[];
  };
  fetchedAt: Date;
}

export const competitorSpyAdapter: ConsumerAdapter<CompetitorPageInput, CompetitorPageOutput> = {
  feature: "competitorSpy",

  toScrapeOptions(input: CompetitorPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "competitorSpy",
      includeHtml: true,
      includeParsedData: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: CompetitorPageInput): CompetitorPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      wordCount: result.parsedData?.wordCount,
      headings: {
        h1: result.parsedData?.h1 ?? [],
        h2: result.parsedData?.h2 ?? [],
      },
      fetchedAt: new Date(),
    };
  },

  compareOutputs(legacy: CompetitorPageOutput, adapted: CompetitorPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    // Word count within 10% tolerance (different parsing)
    if (legacy.wordCount && adapted.wordCount) {
      const diff = Math.abs(legacy.wordCount - adapted.wordCount) / legacy.wordCount;
      if (diff > 0.1) {
        differences.push({
          field: "wordCount",
          legacy: legacy.wordCount,
          new: adapted.wordCount,
        });
      }
    }

    // H1 count should match
    if (legacy.headings?.h1.length !== adapted.headings?.h1.length) {
      differences.push({
        field: "h1Count",
        legacy: legacy.headings?.h1.length,
        new: adapted.headings?.h1.length,
      });
    }

    return {
      match: differences.length === 0,
      differences,
    };
  },
};
