/**
 * Reranker client for calling AI-Writer's BGE reranker endpoint.
 *
 * Phase 73-03: Retrieval Quality Enhancement
 *
 * This client provides access to the cross-encoder reranking service
 * hosted in AI-Writer for +3-8 recall@10 improvement.
 *
 * Reference:
 * - .planning/phases/73-infrastructure-optimization/73-03-PLAN.md
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "reranker-client" });

/**
 * Request body for the rerank endpoint.
 */
export interface RerankRequest {
  /** Search query to rank candidates against */
  query: string;
  /** List of candidate documents with text fields */
  candidates: Array<Record<string, unknown>>;
  /** Key in candidate dicts containing text to score */
  textKey?: string;
  /** Number of top results to return */
  topK?: number;
}

/**
 * Response from the rerank endpoint.
 */
export interface RerankResponse {
  /** Reranked candidates with rerank_score field */
  results: Array<Record<string, unknown> & { rerank_score: number }>;
  /** Time taken for reranking in milliseconds */
  latency_ms: number;
  /** Name of the reranker model used */
  model: string;
}

/**
 * Options for the reranker client.
 */
export interface RerankerClientOptions {
  /** Base URL for AI-Writer API (default: from env) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 2) */
  maxRetries?: number;
}

/**
 * Default configuration for the reranker client.
 */
const DEFAULT_OPTIONS: Required<RerankerClientOptions> = {
  baseUrl: process.env.AI_WRITER_URL || process.env.AIWRITER_INTERNAL_URL || "http://localhost:8000",
  timeout: 30000,
  maxRetries: 2,
};

/**
 * Rerank candidates using AI-Writer's BGE reranker service.
 *
 * This function calls the /api/embeddings/rerank endpoint to score
 * query-candidate pairs using a cross-encoder model.
 *
 * @param query - Search query to rank candidates against
 * @param candidates - Array of candidate objects with text content
 * @param topK - Number of top results to return (default: 10)
 * @param textKey - Key in candidates containing text (default: "text")
 * @param options - Client configuration options
 * @returns Reranked candidates with rerank_score field
 *
 * @example
 * ```typescript
 * const results = await rerankCandidates(
 *   "laptop computer",
 *   [
 *     { id: "1", text: "desktop PC", score: 0.8 },
 *     { id: "2", text: "laptop notebook", score: 0.7 },
 *   ],
 *   10
 * );
 * // results[0] will have highest rerank_score
 * ```
 */
export async function rerankCandidates<T extends Record<string, unknown>>(
  query: string,
  candidates: T[],
  topK: number = 10,
  textKey: string = "text",
  options: RerankerClientOptions = {}
): Promise<Array<T & { rerank_score: number }>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!candidates.length) {
    return [];
  }

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(`${opts.baseUrl}/api/embeddings/rerank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          candidates,
          text_key: textKey,
          top_k: topK,
        }),
        signal: AbortSignal.timeout(opts.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reranker API error: ${response.status} ${errorText}`);
      }

      const data: RerankResponse = await response.json();

      log.debug("Reranked candidates", {
        candidateCount: candidates.length,
        resultCount: data.results.length,
        latencyMs: data.latency_ms,
        totalMs: Date.now() - startTime,
      });

      return data.results as Array<T & { rerank_score: number }>;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < opts.maxRetries) {
        log.warn(`Reranker request failed, retrying (${attempt + 1}/${opts.maxRetries})`, {
          error: lastError.message,
        });
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  log.error("Reranker request failed after all retries", {
    error: lastError?.message,
    candidates: candidates.length,
  });

  throw lastError || new Error("Reranker request failed");
}

/**
 * Check if the reranker service is available.
 *
 * @param options - Client configuration options
 * @returns True if the service is healthy
 */
export async function isRerankerAvailable(
  options: RerankerClientOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const response = await fetch(`${opts.baseUrl}/api/embeddings/rerank/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
}

/**
 * Warm up the reranker model by triggering model loading.
 *
 * Call this on service startup to avoid cold start latency
 * on the first real request.
 *
 * @param options - Client configuration options
 * @returns Warmup result with latency
 */
export async function warmupReranker(
  options: RerankerClientOptions = {}
): Promise<{ status: string; latency_ms: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const response = await fetch(`${opts.baseUrl}/api/embeddings/rerank/warmup`, {
    method: "POST",
    signal: AbortSignal.timeout(60000), // Model loading can take time
  });

  if (!response.ok) {
    throw new Error(`Warmup failed: ${response.status}`);
  }

  return response.json();
}
