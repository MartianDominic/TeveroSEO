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
import { eq, and } from "drizzle-orm";

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
   * - Checks for existing keywords by normalized form
   * - Merges metrics if existing has lower quality
   * - Inserts new keywords
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

    for (const kw of keywords) {
      const normalized = normalizeKeyword(kw.keyword);

      // Check if exists
      const existing = await db
        .select()
        .from(prospectKeywords)
        .where(
          and(
            eq(prospectKeywords.prospectId, prospectId),
            eq(prospectKeywords.normalizedKeyword, normalized)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const existingKw = existing[0];

        // Merge if new has better metrics
        const shouldMerge =
          (kw.searchVolume !== null && existingKw.searchVolume === null) ||
          (kw.searchVolume !== null &&
            existingKw.searchVolume !== null &&
            kw.searchVolume > existingKw.searchVolume);

        if (shouldMerge) {
          await db
            .update(prospectKeywords)
            .set({
              searchVolume: kw.searchVolume ?? existingKw.searchVolume,
              keywordDifficulty:
                kw.keywordDifficulty ?? existingKw.keywordDifficulty,
              cpc: kw.cpc ?? existingKw.cpc,
              competition: kw.competition ?? existingKw.competition,
              updatedAt: new Date(),
            })
            .where(eq(prospectKeywords.id, existingKw.id));
          result.merged++;
        } else {
          result.skipped++;
        }
      } else {
        // Insert new
        await db.insert(prospectKeywords).values({
          ...kw,
          normalizedKeyword: normalized,
        });
        result.inserted++;
      }
    }

    return result;
  }
}

export const keywordDeduplicator = new KeywordDeduplicator();
