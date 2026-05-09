/**
 * ResilientEmbedding: Embedding service with FAIL-FAST architecture.
 *
 * Phase 83: Fail-fast, not fail-silently
 *
 * Cascade order (quality-preserving only):
 * 1. Redis Cache (80%+ hit rate after warmup)
 * 2. Local embedding server (v5-nano via Python FastAPI)
 * 3. Jina API (v5-nano model for consistency)
 * 4. THROW EmbeddingUnavailableError (job goes to DLQ)
 *
 * REMOVED (were breaking clustering silently):
 * - LocalONNXEmbedding (hash-based stub - semantically meaningless)
 * - Zero vector fallback (complete semantic collapse)
 *
 * Features:
 * - Same model family (v5-nano) for consistency
 * - Retry with exponential backoff before fallback
 * - Circuit breakers for external services
 * - Throws on complete failure (better than garbage clusters)
 */

import { createCircuitBreaker, type CircuitBreaker } from "@/server/features/scraping/resilience/CircuitBreaker";
import { createLogger } from "@/server/lib/logger";
import { jinaClient, HttpError, TimeoutError } from "@/server/lib/http-client";
import { EMBEDDING_CONFIG } from "@/server/lib/embeddings/embedding-config";

const log = createLogger({ module: "ResilientEmbedding" });

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when all embedding backends are unavailable.
 * Job should be moved to DLQ for retry later.
 */
export class EmbeddingUnavailableError extends Error {
  readonly code = "EMBEDDING_UNAVAILABLE";
  readonly retryable = true;

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "EmbeddingUnavailableError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EmbeddingBackend = "cache" | "local" | "jina";

export interface EmbeddingResult {
  text: string;
  vector: number[];
  dimension: number;
  source: EmbeddingBackend;
  isFallback: boolean;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  summary: {
    total: number;
    bySource: Record<EmbeddingBackend, number>;
    cacheHits: number;
  };
}

export interface EmbeddingConfig {
  dimension: number;
  jinaApiKey?: string;
  cache?: EmbeddingCache;
  jinaCircuit?: { failureThreshold?: number; resetTimeout?: number };
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface EmbeddingCache {
  get(text: string): Promise<number[] | null>;
  set(text: string, vector: number[]): Promise<void>;
  getMany(texts: string[]): Promise<Array<number[] | null>>;
  setMany(texts: string[], vectors: number[][]): Promise<void>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
};

const DEFAULT_CONFIG: EmbeddingConfig = {
  dimension: EMBEDDING_CONFIG.storageDim,
  retryConfig: DEFAULT_RETRY_CONFIG,
};

// ─────────────────────────────────────────────────────────────────────────────
// Retry Helper
// ─────────────────────────────────────────────────────────────────────────────

const RETRYABLE_ERRORS = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "503", "429", "500", "502", "504"];

function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof HttpError) {
    return error.status >= 500 || error.status === 429;
  }
  if (error instanceof Error) {
    return RETRYABLE_ERRORS.some((code) => error.message.includes(code));
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Embedding Server Client (Python FastAPI with v5-nano)
// ─────────────────────────────────────────────────────────────────────────────

class LocalEmbeddingClient {
  private readonly serverUrl: string;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private readonly healthCheckInterval: number = 30000;

  constructor(serverUrl: string = process.env.EMBEDDING_SERVER_URL || "http://localhost:8001") {
    this.serverUrl = serverUrl;
  }

  async embed(texts: string[], isDocument: boolean = false): Promise<number[][]> {
    const response = await fetch(`${this.serverUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts,
        batch_size: EMBEDDING_CONFIG.batchSize,
        is_document: isDocument,
      }),
      signal: AbortSignal.timeout(EMBEDDING_CONFIG.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Embedding server error: ${response.status}`);
    }

    const data = (await response.json()) as { embeddings: number[][] };
    return data.embeddings;
  }

  async healthCheck(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }

    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      this.isHealthy = response.ok;
    } catch (error) {
      // Health check failed - server unavailable or network issue
      // This is expected when local embedding server is not running
      log.debug("Local embedding server health check failed", {
        serverUrl: this.serverUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      this.isHealthy = false;
    }

    this.lastHealthCheck = now;
    return this.isHealthy;
  }

  resetHealthCheck(): void {
    this.lastHealthCheck = 0;
    this.isHealthy = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jina API Embedding (v5-nano model for consistency)
// ─────────────────────────────────────────────────────────────────────────────

class JinaEmbeddingAPI {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(texts: string[], isDocument: boolean = false): Promise<number[][]> {
    const payload = EMBEDDING_CONFIG.getApiPayload(texts, isDocument);

    const data = await jinaClient.post<{
      data: Array<{ embedding: number[] }>;
    }>("/v1/embeddings", payload, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      timeout: EMBEDDING_CONFIG.timeoutMs,
      retries: 0, // We handle retries ourselves
    });

    return data.data.map((d) => d.embedding);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ResilientEmbedding (Fail-Fast Architecture)
// ─────────────────────────────────────────────────────────────────────────────

export class ResilientEmbedding {
  private readonly localServer: LocalEmbeddingClient;
  private readonly jina: JinaEmbeddingAPI | null;
  private readonly cache: EmbeddingCache | null;
  private readonly dimension: number;
  private readonly retryConfig: RetryConfig;

  private readonly jinaCircuit: CircuitBreaker;
  private readonly localServerCircuit: CircuitBreaker;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    this.dimension = fullConfig.dimension;
    this.retryConfig = fullConfig.retryConfig ?? DEFAULT_RETRY_CONFIG;

    this.localServer = new LocalEmbeddingClient();
    this.jina = fullConfig.jinaApiKey ? new JinaEmbeddingAPI(fullConfig.jinaApiKey) : null;
    this.cache = fullConfig.cache || null;

    // Circuit breaker: 5 failures in sliding window, 60s reset
    this.jinaCircuit = createCircuitBreaker("jina-embedding", {
      failureThreshold: fullConfig.jinaCircuit?.failureThreshold ?? 5,
      timeout: fullConfig.jinaCircuit?.resetTimeout ?? 60000,
    });

    this.localServerCircuit = createCircuitBreaker("local-embedding-server", {
      failureThreshold: 5,
      timeout: 30000,
    });
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results.embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const results: EmbeddingResult[] = [];
    const summary = {
      total: texts.length,
      bySource: { cache: 0, local: 0, jina: 0 } as Record<EmbeddingBackend, number>,
      cacheHits: 0,
    };

    // Check cache first
    let cachedVectors: Array<number[] | null> = [];
    if (this.cache) {
      try {
        cachedVectors = await this.cache.getMany(texts);
        summary.cacheHits = cachedVectors.filter((v) => v !== null).length;
        summary.bySource.cache = summary.cacheHits;
      } catch (error) {
        log.warn("Cache lookup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        cachedVectors = texts.map(() => null);
      }
    } else {
      cachedVectors = texts.map(() => null);
    }

    // Separate cached and uncached
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      if (cachedVectors[i] !== null) {
        results[i] = {
          text: texts[i],
          vector: cachedVectors[i]!,
          dimension: this.dimension,
          source: "cache",
          isFallback: false,
        };
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // Generate embeddings for uncached texts (FAIL-FAST)
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await this.generateEmbeddings(uncachedTexts, summary);

      for (let j = 0; j < uncachedIndices.length; j++) {
        results[uncachedIndices[j]] = newEmbeddings[j];
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
   * Generate embeddings using fail-fast cascade.
   * Local Server (v5-nano) -> Jina API (v5-nano) -> THROW
   *
   * NEVER returns garbage vectors. Throws instead.
   */
  private async generateEmbeddings(
    texts: string[],
    summary: { bySource: Record<EmbeddingBackend, number> },
  ): Promise<EmbeddingResult[]> {
    const errors: Error[] = [];

    // Try 1: Local embedding server with retry
    if (this.localServerCircuit.allowsRequest) {
      const isHealthy = await this.localServer.healthCheck();
      if (isHealthy) {
        try {
          const vectors = await this.embedWithRetry(texts, "local");
          this.localServerCircuit.recordSuccess();
          summary.bySource.local += texts.length;

          log.debug("Local embedding server succeeded", {
            count: texts.length,
            dimension: this.dimension,
          });

          return texts.map((text, i) => ({
            text,
            vector: vectors[i],
            dimension: this.dimension,
            source: "local" as EmbeddingBackend,
            isFallback: false,
          }));
        } catch (error) {
          this.localServerCircuit.recordFailure();
          errors.push(error instanceof Error ? error : new Error(String(error)));
          log.warn("Local embedding server failed after retries", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        log.debug("Local server unhealthy, skipping to Jina API");
      }
    } else {
      log.debug("Local server circuit open, skipping to Jina API");
    }

    // Try 2: Jina API with retry (same v5-nano model for consistency)
    if (this.jina && this.jinaCircuit.allowsRequest) {
      try {
        const vectors = await this.embedWithRetry(texts, "jina");
        this.jinaCircuit.recordSuccess();
        summary.bySource.jina += texts.length;

        log.info("Jina API succeeded", {
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
      } catch (error) {
        this.jinaCircuit.recordFailure();
        errors.push(error instanceof Error ? error : new Error(String(error)));
        log.warn("Jina API failed after retries", {
          error: error instanceof Error ? error.message : String(error),
          circuitState: this.jinaCircuit.currentState,
        });
      }
    } else if (!this.jina) {
      errors.push(new Error("No Jina API key configured"));
    } else {
      errors.push(new Error("Jina circuit breaker open"));
    }

    // FAIL-FAST: Throw instead of returning garbage
    throw new EmbeddingUnavailableError(
      "All embedding backends unavailable. Job will be retried.",
      {
        textCount: texts.length,
        localCircuitState: this.localServerCircuit.currentState,
        jinaCircuitState: this.jinaCircuit.currentState,
        errors: errors.map((e) => e.message),
      },
    );
  }

  /**
   * Embed with exponential backoff retry.
   */
  private async embedWithRetry(texts: string[], backend: "local" | "jina"): Promise<number[][]> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        if (backend === "local") {
          return await this.localServer.embed(texts);
        } else {
          return await this.jina!.embed(texts);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!isRetryable(error) || attempt === this.retryConfig.maxAttempts) {
          throw lastError;
        }

        const delay = getBackoffDelay(attempt, this.retryConfig);
        log.debug(`${backend} embed retry ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`, {
          error: lastError.message,
        });
        await sleep(delay);
      }
    }

    throw lastError ?? new Error("Retry exhausted");
  }

  getCircuitState(): { local: string; jina: string } {
    return {
      local: this.localServerCircuit.currentState,
      jina: this.jinaCircuit.currentState,
    };
  }

  resetCircuits(): void {
    this.jinaCircuit.reset();
    this.localServerCircuit.reset();
    log.info("Embedding circuits reset");
  }

  getDimension(): number {
    return this.dimension;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache implementation
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryEmbeddingCache implements EmbeddingCache {
  private readonly cache = new Map<string, { vector: number[]; timestamp: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 10000, ttlMs = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private getCacheKey(text: string): string {
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

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.vector;
  }

  async set(text: string, vector: number[]): Promise<void> {
    const key = this.getCacheKey(text);
    this.cache.delete(key);

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

  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory function
// ─────────────────────────────────────────────────────────────────────────────

export function createResilientEmbedding(cache?: EmbeddingCache): ResilientEmbedding {
  return new ResilientEmbedding({
    dimension: EMBEDDING_CONFIG.storageDim,
    jinaApiKey: process.env.JINA_API_KEY,
    cache: cache || new InMemoryEmbeddingCache(),
  });
}
