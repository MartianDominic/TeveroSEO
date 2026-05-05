/**
 * TieredEmbeddingCache: 2-tier cache with L1 (memory) and L2 (Redis).
 * Phase 83 Wave 3: Performance & Caching
 */

import { createHash } from "crypto";
import { createLogger } from "@/server/lib/logger";
import { type EmbeddingCache, InMemoryEmbeddingCache } from "./ResilientEmbedding";

const log = createLogger({ module: "TieredEmbeddingCache" });

export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  misses: number;
  hitRate: number;
}

export interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  mget(...keys: string[]): Promise<Array<string | null>>;
}

/**
 * 2-tier cache: L1 (memory) -> L2 (Redis)
 * Extends existing InMemoryEmbeddingCache with Redis persistence.
 */
export class TieredEmbeddingCache implements EmbeddingCache {
  private readonly l1: InMemoryEmbeddingCache;
  private readonly l2: RedisClient | null;
  private readonly l2TtlSeconds: number;
  private stats: CacheStats = { l1Hits: 0, l2Hits: 0, misses: 0, hitRate: 0 };

  constructor(
    redis?: RedisClient,
    l1MaxSize = 10000,
    l1TtlMs = 3600000,
    l2TtlSeconds = 30 * 24 * 60 * 60 // 30 days
  ) {
    this.l1 = new InMemoryEmbeddingCache(l1MaxSize, l1TtlMs);
    this.l2 = redis || null;
    this.l2TtlSeconds = l2TtlSeconds;
  }

  async get(text: string): Promise<number[] | null> {
    // L1: Memory (existing implementation)
    const l1Result = await this.l1.get(text);
    if (l1Result) {
      this.stats.l1Hits++;
      this.updateHitRate();
      return l1Result;
    }

    // L2: Redis
    if (this.l2) {
      try {
        const key = this.getRedisKey(text);
        const l2Result = await this.l2.get(key);
        if (l2Result) {
          this.stats.l2Hits++;
          this.updateHitRate();
          const vector = JSON.parse(l2Result) as number[];
          // Promote to L1
          await this.l1.set(text, vector);
          return vector;
        }
      } catch (error) {
        log.warn("Redis cache get failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  async set(text: string, vector: number[]): Promise<void> {
    // Write to L1
    await this.l1.set(text, vector);

    // Write to L2 (async, fire-and-forget for speed)
    if (this.l2) {
      const key = this.getRedisKey(text);
      this.l2.setex(key, this.l2TtlSeconds, JSON.stringify(vector)).catch((error) => {
        log.warn("Redis cache set failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private getRedisKey(text: string): string {
    const normalized = text.toLowerCase().trim();
    const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
    return `emb:v5:${hash}`;
  }

  async getMany(texts: string[]): Promise<Array<number[] | null>> {
    const results: Array<number[] | null> = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // Check L1 first
    for (let i = 0; i < texts.length; i++) {
      const l1Result = await this.l1.get(texts[i]);
      if (l1Result) {
        results[i] = l1Result;
        this.stats.l1Hits++;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // Check L2 for remaining
    if (this.l2 && uncachedTexts.length > 0) {
      try {
        const keys = uncachedTexts.map((t) => this.getRedisKey(t));
        const l2Results = await this.l2.mget(...keys);

        for (let j = 0; j < l2Results.length; j++) {
          if (l2Results[j]) {
            const vector = JSON.parse(l2Results[j]!) as number[];
            const originalIndex = uncachedIndices[j];
            results[originalIndex] = vector;
            this.stats.l2Hits++;
            // Promote to L1
            await this.l1.set(uncachedTexts[j], vector);
          } else {
            this.stats.misses++;
          }
        }
      } catch (error) {
        log.warn("Redis cache mget failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        // Count all uncached as misses
        this.stats.misses += uncachedTexts.length;
      }
    } else {
      this.stats.misses += uncachedTexts.length;
    }

    this.updateHitRate();
    return results;
  }

  async setMany(texts: string[], vectors: number[][]): Promise<void> {
    await Promise.all(texts.map((t, i) => this.set(t, vectors[i])));
  }

  private updateHitRate(): void {
    const total = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.l1Hits + this.stats.l2Hits) / total : 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { l1Hits: 0, l2Hits: 0, misses: 0, hitRate: 0 };
  }
}
