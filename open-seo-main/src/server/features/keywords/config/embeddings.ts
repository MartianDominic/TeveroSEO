/**
 * Embedding Configuration
 *
 * Single source of truth for all embedding model settings.
 * This configuration is derived from infrastructure research:
 *
 * - jina-embeddings-v3: Best Lithuanian quality (Cohen's kappa 0.62, AUC-ROC 0.887)
 * - Native 1024-dim with Matryoshka truncation to 384 for storage efficiency
 * - INT8 quantization for CPU inference (~15-25 docs/s)
 *
 * @see .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md Fix 2
 * @see docs/infra-research/cpu-only-rag-graph.md
 */

import type { EmbeddingConfig } from '../types/embeddings';
import { EmbeddingModel } from '../types/embeddings';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default embedding configuration.
 * Optimized for Lithuanian e-commerce keyword intelligence.
 *
 * Key decisions:
 * - Model: jina-v3 for best Lithuanian quality
 * - Native dim: 1024 (jina-v3 native)
 * - Storage dim: 384 (Matryoshka truncation, ~32x compression with SBQ)
 * - Prefixes: Required for E5 and jina models for optimal quality
 */
export const EMBEDDING_CONFIG: EmbeddingConfig = {
  // Primary model - best Lithuanian quality
  model: EmbeddingModel.JINA_V3,

  // Fallback model for resilience
  modelFallback: EmbeddingModel.E5_BASE,

  // Dimensions
  nativeDim: 1024, // jina-v3 native dimension
  storageDim: 384, // Matryoshka truncation for storage efficiency

  // Prefixes (required for E5 and jina models)
  queryPrefix: 'query: ',
  passagePrefix: 'passage: ',

  // Runtime settings
  batchSize: 32,
  device: 'cpu',
  quantization: 'int8', // ONNX INT8 for CPU inference
} as const;

// ============================================================================
// Alternative Configurations
// ============================================================================

/**
 * High-quality configuration with larger storage dimension.
 * Use when recall is more important than storage efficiency.
 */
export const EMBEDDING_CONFIG_HIGH_QUALITY: EmbeddingConfig = {
  ...EMBEDDING_CONFIG,
  storageDim: 768, // Higher fidelity at 2x storage cost
} as const;

/**
 * Compact configuration for memory-constrained environments.
 * Trades some quality for ~50% memory reduction.
 */
export const EMBEDDING_CONFIG_COMPACT: EmbeddingConfig = {
  ...EMBEDDING_CONFIG,
  storageDim: 256, // Smaller vectors, slight quality reduction
} as const;

/**
 * E5-based configuration.
 * Use as fallback when jina-v3 is unavailable.
 */
export const EMBEDDING_CONFIG_E5: EmbeddingConfig = {
  ...EMBEDDING_CONFIG,
  model: EmbeddingModel.E5_BASE,
  modelFallback: EmbeddingModel.JINA_V3,
  nativeDim: 768, // E5-base native dimension
  storageDim: 384,
} as const;

// ============================================================================
// Configuration Getters
// ============================================================================

/**
 * Get the current embedding configuration.
 * Reads from environment variables with fallback to defaults.
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  // Allow environment overrides
  const envModel = process.env.EMBEDDING_MODEL;
  const envStorageDim = process.env.EMBEDDING_STORAGE_DIM;
  const envDevice = process.env.EMBEDDING_DEVICE;

  return {
    ...EMBEDDING_CONFIG,
    ...(envModel && isValidModel(envModel) ? { model: envModel as EmbeddingModel } : {}),
    ...(envStorageDim && !isNaN(parseInt(envStorageDim))
      ? { storageDim: parseInt(envStorageDim) }
      : {}),
    ...(envDevice && (envDevice === 'cpu' || envDevice === 'cuda') ? { device: envDevice } : {}),
  };
}

/**
 * Get the storage dimension from config.
 * Convenience function for schema definitions.
 */
export function getStorageDim(): number {
  return getEmbeddingConfig().storageDim;
}

/**
 * Get the native dimension from config.
 * Convenience function for model loading.
 */
export function getNativeDim(): number {
  return getEmbeddingConfig().nativeDim;
}

/**
 * Get the query prefix from config.
 */
export function getQueryPrefix(): string {
  return getEmbeddingConfig().queryPrefix;
}

/**
 * Get the passage prefix from config.
 */
export function getPassagePrefix(): string {
  return getEmbeddingConfig().passagePrefix;
}

// ============================================================================
// Helpers
// ============================================================================

function isValidModel(model: string): boolean {
  return Object.values(EmbeddingModel).includes(model as EmbeddingModel);
}

// ============================================================================
// Schema Constants (for database/vector store definitions)
// ============================================================================

/**
 * Vector dimension for database schemas.
 * Use this constant in all schema definitions for consistency.
 *
 * @example
 * ```sql
 * CREATE TABLE products (
 *   embedding halfvec(${VECTOR_DIMENSION})
 * );
 * ```
 */
export const VECTOR_DIMENSION = EMBEDDING_CONFIG.storageDim;

/**
 * Model identifier for LightRAG integration.
 */
export const LIGHTRAG_EMBEDDING_MODEL = EMBEDDING_CONFIG.model;

/**
 * Embedding dimension for LightRAG configuration.
 */
export const LIGHTRAG_EMBEDDING_DIM = EMBEDDING_CONFIG.storageDim;
