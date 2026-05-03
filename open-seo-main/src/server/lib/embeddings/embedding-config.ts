/**
 * Embedding configuration for the Keyword Intelligence System.
 *
 * Phase 65: Upgraded to 768-dim for GraphRAG
 * (Previously Phase 42-03: Unified Embedding Service)
 *
 * This module defines configuration constants and types for the embedding service.
 * Uses jina-embeddings-v3 as primary model (best Lithuanian quality per ADR-002)
 * with Matryoshka truncation to 768-dim for optimal quality in GraphRAG.
 *
 * Reference:
 * - .planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md (ADR-002)
 * - .planning/phases/65-graphrag-foundation/65-RESEARCH.md
 */

/**
 * Supported embedding models.
 * - jina-embeddings-v3: Best Lithuanian quality (Cohen's kappa 0.62, AUC-ROC 0.887)
 * - multilingual-e5-base: Proven fallback with good multilingual support
 */
export type EmbeddingModel = "jina-embeddings-v3" | "multilingual-e5-base";

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
 * Key decisions (per ADR-002, updated Phase 65):
 * - Model: jina-v3 for best Lithuanian quality
 * - Dimensions: 768 storage (upgraded from 384 for better GraphRAG quality)
 * - Cache: 30-day TTL for embeddings
 * - Batch: 32 texts per API call
 */
export const EMBEDDING_CONFIG = {
  /** Primary embedding model - best Lithuanian quality */
  model: "jina-embeddings-v3" as const,

  /** Fallback model if primary fails */
  modelFallback: "multilingual-e5-base" as const,

  /** Native output dimension of jina-v3 */
  nativeDim: 1024,

  /** Storage dimension after Matryoshka truncation - UPGRADED from 384 for better Lithuanian quality */
  storageDim: 768,

  /** Prefix for query embeddings (required by jina/e5 models) */
  queryPrefix: "query: ",

  /** Prefix for passage/document embeddings */
  passagePrefix: "passage: ",

  /** Jina AI API endpoint */
  jinaApiUrl: "https://api.jina.ai/v1/embeddings",

  /** Maximum texts per batch API call */
  batchSize: 32,

  /** Maximum retry attempts for API calls */
  maxRetries: 3,

  /** Base delay for exponential backoff (ms) */
  retryBaseDelay: 1000,

  /** Cache TTL for embeddings (30 days in seconds) */
  cacheTtlSeconds: 30 * 24 * 60 * 60,

  /** Redis key prefix for embedding cache - v2 to invalidate old 384-dim cache */
  cacheKeyPrefix: "emb:v2:",
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
