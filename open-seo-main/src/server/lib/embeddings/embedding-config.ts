/**
 * Embedding configuration for the Keyword Intelligence System.
 *
 * Phase 83: Upgraded to jina-embeddings-v5-nano for 12x faster embeddings
 * Phase 65: Upgraded to 768-dim for GraphRAG
 * (Previously Phase 42-03: Unified Embedding Service)
 *
 * This module defines configuration constants and types for the embedding service.
 * Uses jina-embeddings-v5-nano as primary model (12x faster, 98.3% recall)
 * with 768-dim output for optimal quality in GraphRAG.
 *
 * Reference:
 * - .planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md (ADR-002)
 * - .planning/phases/83-foundation-reliability/83-01-PLAN.md
 * - AI-Writer/benchmark/results/REPORT.md (v5-nano benchmark)
 */

import {
  EmbeddingModel,
  EMBEDDING_MODEL_CONFIGS,
} from "../../features/keywords/types/embeddings";

/**
 * Supported embedding models.
 * - jina-embeddings-v5-text-nano: Primary model (12x faster, 98.3% recall)
 * - jina-embeddings-v3: Best Lithuanian quality (Cohen's kappa 0.62, AUC-ROC 0.887)
 * - multilingual-e5-base: Proven fallback with good multilingual support
 */
export type EmbeddingModelType = "jina-embeddings-v5-text-nano" | "jina-embeddings-v3" | "multilingual-e5-base";

/** Default model for new embeddings */
const DEFAULT_MODEL = EmbeddingModel.JINA_V5_NANO;
const DEFAULT_MODEL_CONFIG = EMBEDDING_MODEL_CONFIGS[DEFAULT_MODEL];

/**
 * Input for embedding generation.
 */
export interface EmbeddingInput {
  /** Text to embed */
  text: string;
  /** Type of text - affects prefix used */
  type: "query" | "passage";
}

/**
 * Output from single embedding generation.
 */
export interface EmbeddingOutput {
  /** The embedding vector (768-dim after Matryoshka truncation) */
  embedding: number[];
  /** Model used for generation */
  model: EmbeddingModel;
  /** Whether the embedding was truncated from native dimension */
  truncated: boolean;
  /** Number of tokens used in embedding */
  tokensUsed: number;
}

/**
 * Output from batch embedding generation.
 */
export interface BatchEmbeddingOutput {
  /** Array of embedding vectors (each 768-dim) */
  embeddings: number[][];
  /** Model used for generation */
  model: EmbeddingModel;
  /** Total tokens used across all embeddings */
  totalTokens: number;
}

/**
 * Configuration for Jina API response.
 */
export interface JinaEmbeddingResponse {
  model: string;
  object: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
  };
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
}

/**
 * Unified embedding configuration.
 *
 * Key decisions (per ADR-002, updated Phase 83):
 * - Model: jina-v5-nano for 12x faster embeddings (98.3% recall)
 * - Dimensions: 768 storage (optimal for GraphRAG quality)
 * - Cache: 30-day TTL for embeddings
 * - Batch: 64 texts per API call (v5 supports larger batches)
 * - Cache prefix bumped to v3 to invalidate old v3-model embeddings
 */
export const EMBEDDING_CONFIG = {
  /** Primary embedding model - v5-nano for speed (12x faster than v3) */
  model: DEFAULT_MODEL_CONFIG.model,

  /** Fallback model if primary fails */
  modelFallback: EmbeddingModel.JINA_V3,

  /** Native output dimension of v5-nano */
  nativeDim: 768,

  /** Storage dimension - v5-nano natively outputs 768-dim */
  storageDim: DEFAULT_MODEL_CONFIG.dimensions,

  /** Prefix for query embeddings (required by jina/e5 models) */
  queryPrefix: "query: ",

  /** Prefix for passage/document embeddings */
  passagePrefix: "passage: ",

  /** Jina AI API endpoint */
  jinaApiUrl: "https://api.jina.ai/v1/embeddings",

  /** Maximum texts per batch API call - v5 supports 64 */
  batchSize: DEFAULT_MODEL_CONFIG.maxBatchSize,

  /** Maximum retry attempts for API calls */
  maxRetries: 3,

  /** Base delay for exponential backoff (ms) */
  retryBaseDelay: 1000,

  /** Cache TTL for embeddings (30 days in seconds) */
  cacheTtlSeconds: 30 * 24 * 60 * 60,

  /** Redis key prefix for embedding cache - v3 to invalidate old v3-model embeddings */
  cacheKeyPrefix: "emb:v3:",

  /** Timeout for API calls in milliseconds */
  timeoutMs: 30000,

  /** Number of retries for API calls */
  retries: 2,

  /**
   * Generate API payload for v5 models.
   * v5 uses task and prompt_name parameters for asymmetric retrieval.
   */
  getApiPayload: (texts: string[], isDocument: boolean = false) => ({
    model: DEFAULT_MODEL_CONFIG.model,
    input: texts,
    task: DEFAULT_MODEL_CONFIG.apiTask,
    prompt_name: isDocument ? "document" : "query",
    dimensions: DEFAULT_MODEL_CONFIG.dimensions,
  }),
} as const;

/**
 * Export embedding dimension constant for GraphRAG schema.
 * Use this constant when defining halfvec types in database schemas.
 */
export const GRAPHRAG_EMBEDDING_DIM = 768;

/**
 * Cache key generator for embeddings.
 * Includes model version in key to invalidate cache on model change.
 */
export function getEmbeddingCacheKey(
  text: string,
  type: "query" | "passage"
): string {
  // Use a simple hash for the text to keep keys manageable
  const textHash = simpleHash(text);
  return `${EMBEDDING_CONFIG.cacheKeyPrefix}${type}:${textHash}`;
}

/**
 * Simple string hash function for cache keys.
 * Uses FNV-1a algorithm for speed and decent distribution.
 */
function simpleHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16);
}

/**
 * Environment variable name for Jina API key.
 * Must be set in .env or deployment environment.
 */
export const JINA_API_KEY_ENV = "JINA_API_KEY";

/**
 * Validate that required environment variables are set.
 * Called at service initialization.
 */
export function validateEmbeddingEnv(): void {
  const apiKey = process.env[JINA_API_KEY_ENV];
  if (!apiKey) {
    throw new Error(
      `Missing required environment variable: ${JINA_API_KEY_ENV}. ` +
        "Set it in .env or the deployment environment before starting."
    );
  }
}
