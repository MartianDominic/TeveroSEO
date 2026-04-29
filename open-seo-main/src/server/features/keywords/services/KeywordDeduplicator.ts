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
import { eq, and, inArray } from "drizzle-orm";

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

export class KeywordDeduplicator {
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
