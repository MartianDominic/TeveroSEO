/**
 * Consumer Adapter Types
 * Phase 95-06: Consumer Migration Wiring
 *
 * Define interfaces for adapting legacy consumers to unified ScrapingService.
 */

import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import type { ScrapingFeature } from "../../config";

/**
 * Legacy scraper function signature.
 */
export type LegacyScraper<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

/**
 * Adapter that bridges legacy consumer to ScrapingService.
 */
export interface ConsumerAdapter<TInput, TLegacyOutput, TNewOutput = ScrapeResult> {
  /** Feature name for flag lookup */
  feature: ScrapingFeature;

  /** Convert legacy input to ScrapingService options */
  toScrapeOptions(input: TInput): ScrapeOptions & { url: string };

  /** Convert ScrapeResult to legacy output format */
  toConsumerOutput(result: TNewOutput, input: TInput): TLegacyOutput;

  /** Compare outputs for shadow mode logging */
  compareOutputs(legacy: TLegacyOutput, adapted: TLegacyOutput): ComparisonResult;
}

export interface ComparisonResult {
  match: boolean;
  differences: Array<{
    field: string;
    legacy: unknown;
    new: unknown;
  }>;
}
