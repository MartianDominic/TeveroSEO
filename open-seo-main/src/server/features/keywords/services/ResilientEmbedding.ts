/**
 * ResilientEmbedding: Embedding service with fallback cascade.
 *
 * Cascade order:
 * 1. Local ONNX model (primary - always available, no external dependency)
 * 2. Jina API (fallback - higher quality when local fails)
 * 3. Zero vectors (last resort - never throws)
 *
 * Features:
 * - Cache layer integration to avoid redundant computations
 * - Circuit breaker for external API
 * - Never throws - always returns vectors
 * - Tracks which backend produced each embedding
 */

import { CircuitBreaker } from "./CircuitBreaker";
import { createLogger } from "@/server/lib/logger";
import { jinaClient, HttpError, TimeoutError } from "@/server/lib/http-client";

const log = createLogger({ module: "ResilientEmbedding" });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EmbeddingBackend = "onnx" | "jina" | "zero";

export interface EmbeddingResult {
  /** The text that was embedded */
  text: string;
  /** The embedding vector */
  vector: number[];
  /** Vector dimension */
  dimension: number;
  /** Which backend produced this embedding */
  source: EmbeddingBackend;
  /** Whether this was a fallback/degraded result */
  isFallback: boolean;
}

export interface BatchEmbeddingResult {
  /** All embeddings in order */
  embeddings: EmbeddingResult[];
  /** Summary of backends used */
  summary: {
    total: number;
    bySource: Record<EmbeddingBackend, number>;
    cacheHits: number;
  };
}

export interface EmbeddingConfig {
  /** Embedding dimension (default: 384 for Matryoshka truncation) */
  dimension: number;
  /** Jina API key (optional - for API fallback) */
  jinaApiKey?: string;
  /** Cache implementation (optional) */
  cache?: EmbeddingCache;
  /** Circuit breaker config for Jina API */
  jinaCircuit?: { failureThreshold?: number; resetTimeout?: number };
  /** Local model path (optional - uses default if not provided) */
  localModelPath?: string;
}

/**
 * Cache interface for embedding vectors.
 */
export interface EmbeddingCache {
  get(text: string): Promise<number[] | null>;
  set(text: string, vector: number[]): Promise<void>;
  getMany(texts: string[]): Promise<Array<number[] | null>>;
  setMany(texts: string[], vectors: number[][]): Promise<void>;
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  dimension: 384,
};

// ─────────────────────────────────────────────────────────────────────────────
// Local ONNX Embedding (simulated for now - would use transformers.js or similar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Local ONNX embedding implementation.
 *
 * In production, this would use:
 * - @xenova/transformers for browser/Node.js ONNX inference
 * - sentence-transformers via Python subprocess
 * - Pre-loaded model weights
 *
 * For this implementation, we use a deterministic hash-based approach
 * that produces consistent vectors for the same input text.
 */
class LocalONNXEmbedding {
  private readonly dimension: number;
  private initialized = false;

  constructor(dimension: number) {
    this.dimension = dimension;
  }

  async initialize(): Promise<void> {
    // In production: Load ONNX model weights
    // For now: Just mark as initialized
    this.initialized = true;
    log.debug("Local ONNX embedding initialized", { dimension: this.dimension });
  }

  /**
   * Generate embeddings for texts.
   * Uses deterministic hashing to produce consistent vectors.
   */
  async encode(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return texts.map((text) => this.hashToVector(text));
  }

  /**
   * Convert text to a deterministic vector via hashing.
   * This is a placeholder - real implementation would use actual model.
   */
  private hashToVector(text: string): number[] {
    const vector = new Array<number>(this.dimension);
    const normalized = text.toLowerCase().trim();

    // Use multiple hash seeds for different dimensions
    for (let i = 0; i < this.dimension; i++) {
      // Simple hash function (djb2 variant)
      let hash = 5381 + i * 33;
      for (let j = 0; j < normalized.length; j++) {
        hash = ((hash << 5) + hash) ^ normalized.charCodeAt(j);
      }
      // Normalize to [-1, 1] range
      vector[i] = (((hash >>> 0) % 20000) - 10000) / 10000;
    }

    // L2 normalize the vector
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jina API Embedding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Jina Embeddings API client.
 * Uses jina-embeddings-v3 which is best for Lithuanian (Cohen's kappa 0.62).
 * Configured with 30s timeout and automatic retries.
 */
class JinaEmbeddingAPI {
  private readonly apiKey: string;
  private readonly dimension: number;

  constructor(apiKey: string, dimension: number) {
    this.apiKey = apiKey;
    this.dimension = dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const data = await jinaClient.post<{
        data: Array<{ embedding: number[] }>;
      }>(
        "/v1/embeddings",
        {
          model: "jina-embeddings-v3",
          input: texts,
          dimensions: this.dimension,
          task: "text-matching",
          late_chunking: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000, // 30 second timeout
          retries: 2,
        },
      );

      return data.data.map((d) => d.embedding);
    } catch (error) {
      if (error instanceof HttpError) {
        throw new Error(`Jina API error: ${error.status} - ${error.body.slice(0, 200)}`);
      }
      if (error instanceof TimeoutError) {
        throw new Error(`Jina API timeout after ${error.timeoutMs}ms`);
      }
      throw error;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ResilientEmbedding
// ─────────────────────────────────────────────────────────────────────────────

export class ResilientEmbedding {
  private readonly local: LocalONNXEmbedding;
  private readonly jina: JinaEmbeddingAPI | null;
  private readonly cache: EmbeddingCache | null;
  private readonly dimension: number;

  private readonly jinaCircuit: CircuitBreaker;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    this.dimension = fullConfig.dimension;

    // Local model is always available
    this.local = new LocalONNXEmbedding(this.dimension);

    // Jina API is optional (requires API key)
    this.jina = fullConfig.jinaApiKey ? new JinaEmbeddingAPI(fullConfig.jinaApiKey, this.dimension) : null;

    // Cache is optional
    this.cache = fullConfig.cache || null;

    // Circuit breaker for Jina API
    this.jinaCircuit = new CircuitBreaker({
      name: "jina-embedding",
      failureThreshold: fullConfig.jinaCircuit?.failureThreshold ?? 3,
      resetTimeout: fullConfig.jinaCircuit?.resetTimeout ?? 60000,
    });
  }

  /**
   * Generate embedding for a single text.
   * Never throws - returns zero vector as last resort.
   *
   * @param text - Text to embed
   * @returns Embedding result with source indicator
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results.embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts.
   * Never throws - returns zero vectors for failed items.
   *
   * @param texts - Texts to embed
   * @returns Batch embedding result with summary
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const results: EmbeddingResult[] = [];
    const summary = {
      total: texts.length,
      bySource: { onnx: 0, jina: 0, zero: 0 } as Record<EmbeddingBackend, number>,
      cacheHits: 0,
    };

    // Check cache first
    let cachedVectors: Array<number[] | null> = [];
    if (this.cache) {
      try {
        cachedVectors = await this.cache.getMany(texts);
        summary.cacheHits = cachedVectors.filter((v) => v !== null).length;
      } catch (error) {
        log.warn("Cache lookup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        cachedVectors = texts.map(() => null);
      }
    } else {
      cachedVectors = texts.map(() => null);
    }

    // Separate cached and uncached texts
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      if (cachedVectors[i] !== null) {
        results[i] = {
          text: texts[i],
          vector: cachedVectors[i]!,
          dimension: this.dimension,
          source: "onnx", // Assume cached vectors came from primary source
          isFallback: false,
        };
        summary.bySource.onnx++;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // Process uncached texts
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await this.generateEmbeddings(uncachedTexts, summary);

      // Map back to original indices
      for (let j = 0; j < uncachedIndices.length; j++) {
        const originalIndex = uncachedIndices[j];
        results[originalIndex] = newEmbeddings[j];
      }

      // Cache new embeddings
      if (this.cache) {
        try {
          await this.cache.setMany(
            uncachedTexts,
            newEmbeddings.map((e) => e.vector),
          );
        } catch (error) {
          log.warn("Cache write failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { embeddings: results, summary };
  }

  /**
   * Generate embeddings using fallback cascade.
   * Local ONNX -> Jina API -> Zero vectors
   */
  private async generateEmbeddings(
    texts: string[],
    summary: { bySource: Record<EmbeddingBackend, number> },
  ): Promise<EmbeddingResult[]> {
    // Try local ONNX first (always available)
    try {
      const vectors = await this.local.encode(texts);
      summary.bySource.onnx += texts.length;

      log.debug("Local ONNX embedding succeeded", {
        count: texts.length,
        dimension: this.dimension,
      });

      return texts.map((text, i) => ({
        text,
        vector: vectors[i],
        dimension: this.dimension,
        source: "onnx" as EmbeddingBackend,
        isFallback: false,
      }));
    } catch (localError) {
      log.warn("Local ONNX embedding failed, trying Jina API", {
        error: localError instanceof Error ? localError.message : String(localError),
      });
    }

    // Fallback to Jina API
    if (this.jina && this.jinaCircuit.allowsRequest) {
      try {
        const vectors = await this.jina.embed(texts);
        this.jinaCircuit.recordSuccess();
        summary.bySource.jina += texts.length;

        log.info("Jina API fallback succeeded", {
          count: texts.length,
          dimension: this.dimension,
        });

        return texts.map((text, i) => ({
          text,
          vector: vectors[i],
          dimension: this.dimension,
          source: "jina" as EmbeddingBackend,
          isFallback: true,
        }));
      } catch (jinaError) {
        this.jinaCircuit.recordFailure();
        log.warn("Jina API embedding failed, using zero vectors", {
          error: jinaError instanceof Error ? jinaError.message : String(jinaError),
          circuitState: this.jinaCircuit.currentState,
        });
      }
    } else if (this.jina && !this.jinaCircuit.allowsRequest) {
      log.debug("Jina circuit open, skipping to zero vectors", {
        circuitState: this.jinaCircuit.currentState,
      });
    }

    // Last resort: zero vectors
    log.warn("All embedding backends failed, returning zero vectors", {
      count: texts.length,
      dimension: this.dimension,
    });

    summary.bySource.zero += texts.length;

    return texts.map((text) => ({
      text,
      vector: new Array(this.dimension).fill(0),
      dimension: this.dimension,
      source: "zero" as EmbeddingBackend,
      isFallback: true,
    }));
  }

  /**
   * Get current circuit breaker state for monitoring.
   */
  getCircuitState(): string {
    return this.jinaCircuit.currentState;
  }

  /**
   * Reset circuit breaker (for testing/recovery).
   */
  resetCircuit(): void {
    this.jinaCircuit.reset();
    log.info("Jina embedding circuit reset");
  }

  /**
   * Get embedding dimension.
   */
  getDimension(): number {
    return this.dimension;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple in-memory cache for embeddings using LRU eviction.
 * Uses Map insertion order for O(1) eviction instead of O(n) timestamp search.
 * For production, use Redis or similar.
 */
export class InMemoryEmbeddingCache implements EmbeddingCache {
  // Map maintains insertion order in JS, enabling O(1) LRU eviction
  private readonly cache = new Map<string, { vector: number[]; timestamp: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 10000, ttlMs = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private getCacheKey(text: string): string {
    // Simple hash of normalized text
    const normalized = text.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
  }

  private isExpired(entry: { timestamp: number } | undefined): boolean {
    if (!entry) return true;
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  async get(text: string): Promise<number[] | null> {
    const key = this.getCacheKey(text);
    const entry = this.cache.get(key);

    if (!entry || this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used) - O(1) operation
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.vector;
  }

  async set(text: string, vector: number[]): Promise<void> {
    const key = this.getCacheKey(text);

    // Delete first to update position if key exists
    this.cache.delete(key);

    // Evict oldest (first entry in Map) if at capacity - O(1) operation
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { vector, timestamp: Date.now() });
  }

  async getMany(texts: string[]): Promise<Array<number[] | null>> {
    return Promise.all(texts.map((t) => this.get(t)));
  }

  async setMany(texts: string[], vectors: number[][]): Promise<void> {
    for (let i = 0; i < texts.length; i++) {
      await this.set(texts[i], vectors[i]);
    }
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ResilientEmbedding with environment-based configuration.
 */
export function createResilientEmbedding(cache?: EmbeddingCache): ResilientEmbedding {
  return new ResilientEmbedding({
    dimension: 384,
    jinaApiKey: process.env.JINA_API_KEY,
    cache: cache || new InMemoryEmbeddingCache(),
  });
}
