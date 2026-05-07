/**
 * KeywordDeduplicator
 *
 * Normalizes keywords and deduplicates across sources.
 * Handles Lithuanian diacritics and maintains data quality.
 */

import { db } from "@/db";
import {
  prospectKeywords,
  type ProspectKeywordInsert,
} from "@/db/prospect-keyword-schema";
import { eq, and, inArray, or, isNull, ne } from "drizzle-orm";

/**
 * Normalize a keyword for deduplication:
 * - Lowercase
 * - Trim whitespace
 * - Remove diacritics (Lithuanian: ą→a, č→c, ė→e, etc.)
 * - Collapse multiple spaces
 */
export function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacritics
    .replace(/\s+/g, " "); // Collapse spaces
}

export interface DeduplicationResult {
  inserted: number;
  merged: number;
  skipped: number;
}

/**
 * Result of pre-research deduplication.
 * Returns arrays for both new and duplicate keywords for UI display.
 */
export interface PreResearchDeduplicationResult {
  new: string[];       // Keywords to send to DataForSEO
  duplicate: string[]; // Keywords already in corpus (skipped)
}

export class KeywordDeduplicator {
  /**
   * Deduplicate keywords BEFORE calling DataForSEO API.
   * CRITICAL: This method MUST be called before any research API call.
   *
   * Per 93-RESEARCH.md:
   * - Returns new keywords to research (not in corpus)
   * - Returns duplicate keywords (already researched)
   * - Handles intra-batch duplicates
   * - Excludes tier='excluded' keywords from consideration
   */
  async deduplicateBeforeResearch(
    prospectId: string,
    keywords: string[]
  ): Promise<PreResearchDeduplicationResult> {
    if (keywords.length === 0) {
      return { new: [], duplicate: [] };
    }

    // Normalize all input keywords
    const normalizedInputs = keywords.map(kw => ({
      original: kw,
      normalized: normalizeKeyword(kw),
    }));

    // Get all normalized values for batch query
    const normalizedValues = normalizedInputs.map(k => k.normalized);

    // Query existing keywords for this prospect
    // Exclude tier='excluded' per 93-RESEARCH.md pitfall #3
    const existing = await db
      .select({ normalizedKeyword: prospectKeywords.normalizedKeyword })
      .from(prospectKeywords)
      .where(
        and(
          eq(prospectKeywords.prospectId, prospectId),
          inArray(prospectKeywords.normalizedKeyword, normalizedValues),
          // Exclude ignored/excluded keywords from deduplication check
          or(
            isNull(prospectKeywords.tier),
            ne(prospectKeywords.tier, 'excluded')
          )
        )
      );

    const existingSet = new Set(existing.map(r => r.normalizedKeyword));

    // Track seen normalized values to handle intra-batch duplicates
    const seenInBatch = new Set<string>();
    const newKeywords: string[] = [];
    const duplicateKeywords: string[] = [];

    for (const { original, normalized } of normalizedInputs) {
      if (existingSet.has(normalized) || seenInBatch.has(normalized)) {
        duplicateKeywords.push(original);
      } else {
        newKeywords.push(original);
        seenInBatch.add(normalized);
      }
    }

    return {
      new: newKeywords,
      duplicate: duplicateKeywords,
    };
  }

  /**
   * Deduplicate and insert keywords for a prospect.
   * - Normalizes all keywords
   * - Checks for existing keywords by normalized form (batch prefetch)
   * - Merges metrics if existing has lower quality
   * - Inserts new keywords (batch insert)
   */
  async deduplicateAndInsert(
    prospectId: string,
    keywords: ProspectKeywordInsert[]
  ): Promise<DeduplicationResult> {
    const result: DeduplicationResult = {
      inserted: 0,
      merged: 0,
      skipped: 0,
    };

    if (keywords.length === 0) {
      return result;
    }

    // Normalize all keywords upfront
    const normalizedKeywords = keywords.map((kw) => ({
      ...kw,
      normalizedKeyword: normalizeKeyword(kw.keyword),
    }));

    // Batch prefetch: Get all existing keywords in one query
    const normalizedValues = normalizedKeywords.map((k) => k.normalizedKeyword);
    const existingKeywords = await db
      .select()
      .from(prospectKeywords)
      .where(
        and(
          eq(prospectKeywords.prospectId, prospectId),
          inArray(prospectKeywords.normalizedKeyword, normalizedValues)
        )
      );

    // Build lookup map for O(1) access
    const existingMap = new Map(
      existingKeywords.map((k) => [k.normalizedKeyword, k])
    );

    // Separate into inserts, merges, and skips
    const toInsert: Array<ProspectKeywordInsert & { normalizedKeyword: string }> = [];
    const toMerge: Array<{
      id: string;
      searchVolume: number | null;
      keywordDifficulty: number | null;
      cpc: number | null;
      competition: number | null;
    }> = [];

    for (const kw of normalizedKeywords) {
      const existing = existingMap.get(kw.normalizedKeyword);

      if (existing) {
        // Merge if new has better metrics
        const shouldMerge =
          (kw.searchVolume != null && existing.searchVolume == null) ||
          (kw.searchVolume != null &&
            existing.searchVolume != null &&
            kw.searchVolume > existing.searchVolume);

        if (shouldMerge) {
          toMerge.push({
            id: existing.id,
            searchVolume: kw.searchVolume ?? existing.searchVolume,
            keywordDifficulty: kw.keywordDifficulty ?? existing.keywordDifficulty,
            cpc: kw.cpc ?? existing.cpc,
            competition: kw.competition ?? existing.competition,
          });
        } else {
          result.skipped++;
        }
      } else {
        toInsert.push(kw);
      }
    }

    // Batch insert new keywords
    if (toInsert.length > 0) {
      await db.insert(prospectKeywords).values(toInsert);
      result.inserted = toInsert.length;
    }

    // Batch update merged keywords - use parallel updates in chunks
    if (toMerge.length > 0) {
      const updatedAt = new Date();
      const CHUNK_SIZE = 100;

      for (let i = 0; i < toMerge.length; i += CHUNK_SIZE) {
        const chunk = toMerge.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map((kw) =>
            db
              .update(prospectKeywords)
              .set({
                searchVolume: kw.searchVolume,
                keywordDifficulty: kw.keywordDifficulty,
                cpc: kw.cpc,
                competition: kw.competition,
                updatedAt,
              })
              .where(eq(prospectKeywords.id, kw.id))
          )
        );
      }
      result.merged = toMerge.length;
    }

    return result;
  }
}

export const keywordDeduplicator = new KeywordDeduplicator();
