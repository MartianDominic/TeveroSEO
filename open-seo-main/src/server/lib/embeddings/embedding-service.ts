/**
 * Embedding service with Jina API integration.
 *
 * Phase 65: Upgraded to 768-dim for GraphRAG
 * (Previously Phase 42-03: Unified Embedding Service)
 *
 * This module provides embedding generation using jina-embeddings-v3 with:
 * - Matryoshka truncation to 768-dim for optimal GraphRAG quality
 * - Redis caching with 30-day TTL
 * - Retry logic with exponential backoff
 * - Batch processing (32 texts per API call)
 *
 * Reference:
 * - .planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md (ADR-002)
 * - .planning/phases/65-graphrag-foundation/65-RESEARCH.md
 */

import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  EMBEDDING_CONFIG,
  JINA_API_KEY_ENV,
  getEmbeddingCacheKey,
  type EmbeddingOutput,
  type BatchEmbeddingOutput,
  type JinaEmbeddingResponse,
} from "./embedding-config";

const log = createLogger({ module: "embedding-service" });

/**
 * Embedding service with Jina API integration.
 *
 * Provides unified embedding generation for the Keyword Intelligence System.
 * Uses jina-embeddings-v3 (best Lithuanian quality) with Matryoshka truncation.
 */
export class EmbeddingService {
  private readonly apiKey: string;
  private readonly cacheEnabled: boolean;

  constructor(apiKey?: string, cacheEnabled = true) {
    this.apiKey = apiKey || process.env[JINA_API_KEY_ENV] || "";
    this.cacheEnabled = cacheEnabled;

    if (!this.apiKey) {
      log.warn("Embedding service initialized without API key - API calls will fail");
    }
  }

  /**
   * Generate embeddings for multiple passages/documents.
   *
   * @param texts Array of text passages to embed
   * @returns Batch embedding output with 384-dim vectors
   */
  async embedPassages(texts: string[]): Promise<BatchEmbeddingOutput> {
    if (texts.length === 0) {
      return { embeddings: [], model: EMBEDDING_CONFIG.model, totalTokens: 0 };
    }

    // Add passage prefix to each text
    const prefixedTexts = texts.map(
      (t) => `${EMBEDDING_CONFIG.passagePrefix}${t}`
    );

    // Check cache first
    const cacheKeys = texts.map((t) => getEmbeddingCacheKey(t, "passage"));
    const cachedResults = await this.getCachedBatch(cacheKeys);

    // Find which texts need API calls
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      if (cachedResults[i] === null) {
        uncachedIndices.push(i);
        uncachedTexts.push(prefixedTexts[i]);
      }
    }

    // Fetch uncached embeddings from API in batches
    const newEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < uncachedTexts.length; i += EMBEDDING_CONFIG.batchSize) {
      const batch = uncachedTexts.slice(i, i + EMBEDDING_CONFIG.batchSize);
      const response = await this.callJinaApi(batch);

      // Process response - may need truncation
      for (const item of response.embeddings) {
        newEmbeddings.push(item);
      }
      totalTokens += response.totalTokens;
    }

    // Cache new embeddings
    if (this.cacheEnabled && newEmbeddings.length > 0) {
      await this.cacheBatch(
        uncachedIndices.map((i) => cacheKeys[i]),
        newEmbeddings
      );
    }

    // Merge cached and new embeddings in original order
    const finalEmbeddings: number[][] = [];
    let newIdx = 0;

    for (let i = 0; i < texts.length; i++) {
      if (cachedResults[i] !== null) {
        finalEmbeddings.push(cachedResults[i] as number[]);
      } else {
        finalEmbeddings.push(newEmbeddings[newIdx++]);
      }
    }

    return {
      embeddings: finalEmbeddings,
      model: EMBEDDING_CONFIG.model,
      totalTokens,
    };
  }

  /**
   * Generate embedding for a single query.
   *
   * @param text Query text to embed
   * @returns Single embedding output with 384-dim vector
   */
  async embedQuery(text: string): Promise<EmbeddingOutput> {
    // Add query prefix
    const prefixedText = `${EMBEDDING_CONFIG.queryPrefix}${text}`;

    // Check cache first
    const cacheKey = getEmbeddingCacheKey(text, "query");
    const cached = await this.getCached(cacheKey);

    if (cached !== null) {
      return {
        embedding: cached,
        model: EMBEDDING_CONFIG.model,
        truncated: false,
        tokensUsed: 0,
      };
    }

    // Fetch from API
    const response = await this.callJinaApi([prefixedText]);
    const embedding = response.embeddings[0];

    // Cache the result
    if (this.cacheEnabled) {
      await this.cache(cacheKey, embedding);
    }

    return {
      embedding,
      model: EMBEDDING_CONFIG.model,
      truncated: response.wasTruncated,
      tokensUsed: response.totalTokens,
    };
  }

  /**
   * Call Jina API with retry logic.
   *
   * @param texts Array of texts to embed (already prefixed)
   * @returns Batch embedding response with truncation info
   */
  private async callJinaApi(
    texts: string[]
  ): Promise<BatchEmbeddingOutput & { wasTruncated: boolean }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < EMBEDDING_CONFIG.maxRetries; attempt++) {
      try {
        const response = await fetch(EMBEDDING_CONFIG.jinaApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: `jinaai/${EMBEDDING_CONFIG.model}`,
            input: texts,
            dimensions: EMBEDDING_CONFIG.storageDim,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Jina API error: ${response.status} ${response.statusText}`
          );
        }

        const data: JinaEmbeddingResponse = await response.json();

        // Sort by index and extract embeddings
        const sortedData = data.data.sort((a, b) => a.index - b.index);
        const embeddings = sortedData.map((item) => {
          // Apply Matryoshka truncation if API returned native dimension
          if (item.embedding.length > EMBEDDING_CONFIG.storageDim) {
            return item.embedding.slice(0, EMBEDDING_CONFIG.storageDim);
          }
          return item.embedding;
        });

        // Check if any embedding was truncated
        const wasTruncated = data.data.some(
          (item) => item.embedding.length > EMBEDDING_CONFIG.storageDim
        );

        return {
          embeddings,
          model: EMBEDDING_CONFIG.model,
          totalTokens: data.usage.total_tokens,
          wasTruncated,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(
          `Jina API call failed (attempt ${attempt + 1}/${EMBEDDING_CONFIG.maxRetries})`,
          { error: lastError.message }
        );

        // Exponential backoff before retry
        if (attempt < EMBEDDING_CONFIG.maxRetries - 1) {
          const delay =
            EMBEDDING_CONFIG.retryBaseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error("Jina API call failed after all retries");
  }

  /**
   * Get cached embedding batch.
   */
  private async getCachedBatch(keys: string[]): Promise<(number[] | null)[]> {
    if (!this.cacheEnabled) {
      return keys.map(() => null);
    }

    try {
      const results = await redis.mget(...keys);
      return results.map((r) => (r ? JSON.parse(r) : null));
    } catch (error) {
      log.warn("Cache batch read failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return keys.map(() => null);
    }
  }

  /**
   * Get single cached embedding.
   */
  private async getCached(key: string): Promise<number[] | null> {
    if (!this.cacheEnabled) {
      return null;
    }

    try {
      const result = await redis.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      log.warn("Cache read failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache a batch of embeddings.
   */
  private async cacheBatch(
    keys: string[],
    embeddings: number[][]
  ): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      const pipeline = redis.pipeline();
      for (let i = 0; i < keys.length; i++) {
        pipeline.set(
          keys[i],
          JSON.stringify(embeddings[i]),
          "EX",
          EMBEDDING_CONFIG.cacheTtlSeconds
        );
      }
      await pipeline.exec();
    } catch (error) {
      log.warn("Cache batch write failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cache a single embedding.
   */
  private async cache(key: string, embedding: number[]): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      await redis.set(
        key,
        JSON.stringify(embedding),
        "EX",
        EMBEDDING_CONFIG.cacheTtlSeconds
      );
    } catch (error) {
      log.warn("Cache write failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get the singleton embedding service instance.
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

/**
 * Embed multiple passages using the singleton service.
 */
export async function embedPassages(
  texts: string[]
): Promise<BatchEmbeddingOutput> {
  return getEmbeddingService().embedPassages(texts);
}

/**
 * Embed a single query using the singleton service.
 */
export async function embedQuery(text: string): Promise<EmbeddingOutput> {
  return getEmbeddingService().embedQuery(text);
}
