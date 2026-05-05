/**
 * Embedding service exports.
 *
 * Phase 42-03: Unified Embedding Service
 *
 * This module provides a unified interface for generating embeddings
 * using jina-embeddings-v3 with Matryoshka truncation to 384-dim.
 */

// Configuration and types
export {
  EMBEDDING_CONFIG,
  JINA_API_KEY_ENV,
  getEmbeddingCacheKey,
  validateEmbeddingEnv,
  type EmbeddingModelType,
  type EmbeddingInput,
  type EmbeddingOutput,
  type BatchEmbeddingOutput,
  type JinaEmbeddingResponse,
} from "./embedding-config";

// Re-export from types for convenience
export { EmbeddingModel, EMBEDDING_MODEL_CONFIGS } from "../../features/keywords/types/embeddings";

// Service
export {
  EmbeddingService,
  getEmbeddingService,
  embedPassages,
  embedQuery,
} from "./embedding-service";
