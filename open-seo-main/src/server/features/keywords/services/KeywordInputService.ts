/**
 * KeywordInputService
 *
 * Unified orchestrator for all 5 keyword entry points.
 * Maps entry points to source types, normalizes, deduplicates,
 * and optionally enriches keywords.
 */

import { nanoid } from "nanoid";
import {
  keywordDeduplicator,
  normalizeKeyword,
} from "./KeywordDeduplicator";
import {
  keywordEnrichmentService,
  type EnrichmentResult,
} from "./KeywordEnrichmentService";
import type {
  ProspectKeywordInsert,
  KeywordSource,
} from "@/db/prospect-keyword-schema";

/**
 * Entry points for keyword input.
 * Each maps to a specific source type for tracking.
 */
export type KeywordEntryPoint =
  | "quick_check"
  | "csv_import"
  | "full_discovery"
  | "gap_analysis"
  | "competitor_spy"
  | "manual";

export interface AddKeywordsInput {
  prospectId: string;
  entryPoint: KeywordEntryPoint;
  keywords: Array<{
    keyword: string;
    searchVolume?: number;
    keywordDifficulty?: number;
    cpc?: number;
    competition?: number;
    currentPosition?: number;
    currentUrl?: string;
    sourceMetadata?: Record<string, unknown>;
  }>;
  autoEnrich?: boolean;
}

export interface AddKeywordsResult {
  inserted: number;
  merged: number;
  skipped: number;
  enrichment?: EnrichmentResult;
  keywordIds: string[];
}

// Map entry points to source types
const ENTRY_POINT_TO_SOURCE: Record<KeywordEntryPoint, KeywordSource> = {
  quick_check: "quick_check",
  csv_import: "csv_upload",
  full_discovery: "dataforseo",
  gap_analysis: "competitor_gap",
  competitor_spy: "competitor_gap",
  manual: "manual",
};

export class KeywordInputService {
  /**
   * Add keywords from any entry point.
   * - Maps entry point to source type
   * - Normalizes and deduplicates
   * - Optionally enriches via DataForSEO
   */
  async addKeywords(input: AddKeywordsInput): Promise<AddKeywordsResult> {
    const source = ENTRY_POINT_TO_SOURCE[input.entryPoint];
    const keywordIds: string[] = [];

    // Prepare keyword records
    const records: ProspectKeywordInsert[] = input.keywords.map((kw) => {
      const id = `kw_${nanoid(12)}`;
      keywordIds.push(id);

      return {
        id,
        prospectId: input.prospectId,
        keyword: kw.keyword,
        normalizedKeyword: normalizeKeyword(kw.keyword),
        source,
        sourceMetadata: kw.sourceMetadata,
        searchVolume: kw.searchVolume ?? null,
        keywordDifficulty: kw.keywordDifficulty ?? null,
        cpc: kw.cpc ?? null,
        competition: kw.competition ?? null,
        currentPosition: kw.currentPosition ?? null,
        currentUrl: kw.currentUrl ?? null,
        enrichmentStatus: kw.searchVolume !== undefined ? "skipped" : "pending",
      };
    });

    // Deduplicate and insert
    const dedupeResult = await keywordDeduplicator.deduplicateAndInsert(
      input.prospectId,
      records
    );

    const result: AddKeywordsResult = {
      inserted: dedupeResult.inserted,
      merged: dedupeResult.merged,
      skipped: dedupeResult.skipped,
      keywordIds,
    };

    // Optionally enrich
    if (input.autoEnrich === true) {
      const needsEnrichment = keywordIds.filter(
        (_, i) => input.keywords[i].searchVolume === undefined
      );

      if (needsEnrichment.length > 0) {
        result.enrichment =
          await keywordEnrichmentService.enrichBatch(needsEnrichment);
      }
    }

    return result;
  }
}

export const keywordInputService = new KeywordInputService();
