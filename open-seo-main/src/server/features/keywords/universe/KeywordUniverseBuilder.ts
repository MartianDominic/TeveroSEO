/**
 * KeywordUniverseBuilder: Expands seed keywords into 150-300 candidates.
 *
 * Uses DataForSEO APIs:
 * - autocomplete: Quick suggestions
 * - keywordIdeas: Related keywords with volume
 * - relatedKeywords: Semantic variations
 */

import { createLogger } from "@/server/lib/logger";

/**
 * Normalize a keyword for deduplication:
 * - Lowercase
 * - Trim whitespace
 * - Remove diacritics (Lithuanian: a->a, c->c, e->e, etc.)
 * - Collapse multiple spaces
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacritics
    .replace(/\s+/g, " "); // Collapse spaces
}

const log = createLogger({ module: "KeywordUniverseBuilder" });

export interface DataForSEOAutocomplete {
  keywords(keyword: string, options?: { location_code?: number }): Promise<{ keywords: string[] }>;
  keywordIdeas(keyword: string, options?: { location_code?: number; limit?: number }): Promise<{ keywords: { keyword: string; search_volume?: number }[] }>;
  relatedKeywords(keyword: string, options?: { location_code?: number; limit?: number }): Promise<{ keywords: { keyword: string; search_volume?: number }[] }>;
}

export interface UniverseBuilderConfig {
  maxKeywordsPerSeed?: number;
  locationCode?: number;
  concurrency?: number;
}

const DEFAULT_CONFIG: Required<UniverseBuilderConfig> = {
  maxKeywordsPerSeed: 30,
  locationCode: 2440, // Lithuania
  concurrency: 3,
};

/**
 * Simple concurrency limiter (replaces p-limit dependency).
 */
function createLimiter(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (running < concurrency && queue.length > 0) {
      running++;
      const fn = queue.shift()!;
      fn();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const run = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          running--;
          next();
        }
      };
      queue.push(run);
      next();
    });
  };
}

export class KeywordUniverseBuilder {
  private dataForSEO: DataForSEOAutocomplete;
  private config: Required<UniverseBuilderConfig>;

  constructor(dataForSEO: DataForSEOAutocomplete, config?: UniverseBuilderConfig) {
    this.dataForSEO = dataForSEO;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async expand(seeds: string[], domain?: string): Promise<string[]> {
    if (seeds.length === 0) {
      return [];
    }

    const limit = createLimiter(this.config.concurrency);
    const allKeywords: string[] = [...seeds];

    log.info("Starting keyword expansion", { seedCount: seeds.length, domain });

    // Process seeds in parallel with concurrency limit
    const expansions = await Promise.all(
      seeds.map((seed) =>
        limit(async () => {
          try {
            return await this.expandSeed(seed);
          } catch (error) {
            log.warn("Failed to expand seed", { seed, error: error instanceof Error ? error.message : String(error) });
            return [];
          }
        })
      )
    );

    for (const expanded of expansions) {
      allKeywords.push(...expanded);
    }

    // Deduplicate using normalizeKeyword
    const unique = this.deduplicate(allKeywords);

    log.info("Keyword expansion complete", {
      seeds: seeds.length,
      raw: allKeywords.length,
      unique: unique.length,
    });

    return unique;
  }

  private async expandSeed(seed: string): Promise<string[]> {
    const results: string[] = [];

    // Autocomplete suggestions
    try {
      const autocomplete = await this.dataForSEO.keywords(seed, {
        location_code: this.config.locationCode,
      });
      results.push(...autocomplete.keywords.slice(0, 10));
    } catch {
      log.debug("Autocomplete failed for seed", { seed });
    }

    // Keyword ideas
    try {
      const ideas = await this.dataForSEO.keywordIdeas(seed, {
        location_code: this.config.locationCode,
        limit: this.config.maxKeywordsPerSeed,
      });
      results.push(...ideas.keywords.map((k) => k.keyword));
    } catch {
      log.debug("Keyword ideas failed for seed", { seed });
    }

    // Related keywords
    try {
      const related = await this.dataForSEO.relatedKeywords(seed, {
        location_code: this.config.locationCode,
        limit: 10,
      });
      results.push(...related.keywords.map((k) => k.keyword));
    } catch {
      log.debug("Related keywords failed for seed", { seed });
    }

    return results;
  }

  /**
   * Deduplicate keywords using normalization.
   */
  deduplicate(keywords: string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const keyword of keywords) {
      const normalized = normalizeKeyword(keyword);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(keyword);
      }
    }

    return unique;
  }
}

export function createKeywordUniverseBuilder(
  dataForSEO: DataForSEOAutocomplete,
  config?: UniverseBuilderConfig
): KeywordUniverseBuilder {
  return new KeywordUniverseBuilder(dataForSEO, config);
}
