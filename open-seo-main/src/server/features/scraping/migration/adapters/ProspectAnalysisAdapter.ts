/**
 * Prospect Analysis Adapter
 * Phase 95-06: Consumer Migration Wiring
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";

export interface ProspectPageInput {
  url: string;
  prospectId: string;
  pageType: "homepage" | "about" | "services" | "contact";
}

export interface ProspectPageOutput {
  url: string;
  html: string;
  businessInfo?: {
    companyName?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  technologies?: string[];
  wordCount?: number;
  fetchedAt: Date;
}

export const prospectAnalysisAdapter: ConsumerAdapter<ProspectPageInput, ProspectPageOutput> = {
  feature: "prospectAnalysis",

  toScrapeOptions(input: ProspectPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "prospectAnalysis",
      includeHtml: true,
      includeParsedData: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: ProspectPageInput): ProspectPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      wordCount: result.parsedData?.wordCount,
      fetchedAt: new Date(),
    };
  },

  compareOutputs(legacy: ProspectPageOutput, adapted: ProspectPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    if (Math.abs((legacy.wordCount ?? 0) - (adapted.wordCount ?? 0)) > 50) {
      differences.push({
        field: "wordCount",
        legacy: legacy.wordCount,
        new: adapted.wordCount,
      });
    }

    return { match: differences.length === 0, differences };
  },
};
