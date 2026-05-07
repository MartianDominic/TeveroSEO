/**
 * Content Briefs Adapter
 * Phase 95-06: Consumer Migration Wiring
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";

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
