/**
 * Embedding Types
 *
 * TypeScript interfaces for the Unified Embedding Service.
 * Single source of truth for all embedding operations in the keyword intelligence system.
 *
 * Key decisions from infrastructure research:
 * - jina-embeddings-v3 is best for Lithuanian (Cohen's kappa 0.62, AUC-ROC 0.887)
 * - Matryoshka truncation allows flexible dimension reduction
 * - Float32Array for memory efficiency
 *
 * @see ../../config/embeddings.ts for configuration
 * @see .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md Fix 2
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Supported embedding models.
 * Primary model is jina-v3, fallback is multilingual-e5-base.
 */
export enum EmbeddingModel {
  /** Primary model - best Lithuanian quality (Cohen's kappa 0.62) */
  JINA_V3 = 'jinaai/jina-embeddings-v3',
  /** Fallback model - good multilingual support */
  E5_BASE = 'intfloat/multilingual-e5-base',
}

/**
 * Type of text being embedded.
 * Different prefixes are required for optimal results.
 */
export enum EmbeddingType {
  /** Search queries - uses "query: " prefix */
  QUERY = 'query',
  /** Documents/passages - uses "passage: " prefix */
  PASSAGE = 'passage',
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the embedding service.
 * All dimension and model settings are centralized here.
 */
export interface EmbeddingConfig {
  /** Primary embedding model identifier */
  readonly model: EmbeddingModel;

  /** Fallback model if primary fails */
  readonly modelFallback: EmbeddingModel;

  /** Native dimension of the primary model (jina-v3 = 1024) */
  readonly nativeDim: number;

  /** Storage dimension after Matryoshka truncation */
  readonly storageDim: number;

  /** Prefix for query embeddings (required for E5/jina models) */
  readonly queryPrefix: string;

  /** Prefix for passage/document embeddings */
  readonly passagePrefix: string;

  /** Batch size for bulk embedding operations */
  readonly batchSize: number;

  /** Device for inference (cpu or cuda) */
  readonly device: 'cpu' | 'cuda';

  /** Quantization type for CPU inference */
  readonly quantization: 'none' | 'int8' | 'fp16';
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Metadata about an embedding operation.
 */
export interface EmbeddingMetadata {
  /** Model used for this embedding */
  readonly model: EmbeddingModel;

  /** Original dimension before truncation */
  readonly originalDim: number;

  /** Final dimension after truncation (if applied) */
  readonly finalDim: number;

  /** Whether truncation was applied */
  readonly truncated: boolean;

  /** Whether the vector is normalized */
  readonly normalized: boolean;

  /** Processing time in milliseconds */
  readonly processingTimeMs: number;

  /** Timestamp of embedding creation */
  readonly createdAt: Date;
}

/**
 * Result of a single embedding operation.
 */
export interface EmbeddingResult {
  /** The embedding vector (Float32Array for memory efficiency) */
  readonly vector: Float32Array;

  /** Metadata about the embedding */
  readonly metadata: EmbeddingMetadata;
}

/**
 * Result of a batch embedding operation.
 */
export interface BatchEmbeddingResult {
  /** Array of embedding vectors */
  readonly vectors: Float32Array[];

  /** Shared metadata for the batch */
  readonly metadata: EmbeddingMetadata;

  /** Number of items in the batch */
  readonly count: number;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Options for embedding operations.
 */
export interface EmbedOptions {
  /** Whether to truncate to storage dimension (default: true) */
  truncate?: boolean;

  /** Override the default model */
  model?: EmbeddingModel;
}

/**
 * Cache interface for embedding caching layer.
 * Implementations can use Redis, in-memory, or other backends.
 */
export interface EmbeddingCache {
  /** Get a cached embedding by text hash */
  get(textHash: string): Promise<Float32Array | null>;

  /** Set a cached embedding */
  set(textHash: string, vector: Float32Array, ttlSeconds?: number): Promise<void>;

  /** Get multiple cached embeddings */
  getMany(textHashes: string[]): Promise<(Float32Array | null)[]>;

  /** Set multiple cached embeddings */
  setMany(entries: Array<{ hash: string; vector: Float32Array }>, ttlSeconds?: number): Promise<void>;

  /** Invalidate a cached embedding */
  invalidate(textHash: string): Promise<void>;
}

/**
 * Interface for the embedding model provider.
 * Abstracts the actual embedding model implementation.
 */
export interface EmbeddingModelProvider {
  /** Encode texts to embeddings */
  encode(texts: string[], normalize?: boolean): Promise<Float32Array[]>;

  /** Get the native dimension of the model */
  readonly nativeDim: number;

  /** Whether the model is loaded */
  readonly isLoaded: boolean;

  /** Load the model (lazy loading) */
  load(): Promise<void>;

  /** Unload the model to free memory */
  unload(): void;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a vector has the expected dimension.
 * @throws Error if dimension does not match
 */
export function validateDimension(vector: Float32Array, expectedDim: number, name = 'vector'): void {
  if (vector.length !== expectedDim) {
    throw new Error(
      `Invalid ${name} dimension: expected ${expectedDim}, got ${vector.length}. ` +
        `Ensure all embeddings use the same configuration.`
    );
  }
}

/**
 * Validates that a vector is normalized (unit length).
 * @returns true if normalized (length ~= 1.0 within tolerance)
 */
export function isNormalized(vector: Float32Array, tolerance = 0.001): boolean {
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSquares += vector[i] * vector[i];
  }
  const length = Math.sqrt(sumSquares);
  return Math.abs(length - 1.0) < tolerance;
}

/**
 * Type guard for EmbeddingModel enum.
 */
export function isValidEmbeddingModel(value: string): value is EmbeddingModel {
  return Object.values(EmbeddingModel).includes(value as EmbeddingModel);
}

/**
 * Type guard for EmbeddingConfig.
 */
export function isValidEmbeddingConfig(obj: unknown): obj is EmbeddingConfig {
  if (!obj || typeof obj !== 'object') return false;

  const config = obj as Record<string, unknown>;

  return (
    typeof config.model === 'string' &&
    isValidEmbeddingModel(config.model) &&
    typeof config.modelFallback === 'string' &&
    isValidEmbeddingModel(config.modelFallback) &&
    typeof config.nativeDim === 'number' &&
    config.nativeDim > 0 &&
    typeof config.storageDim === 'number' &&
    config.storageDim > 0 &&
    config.storageDim <= config.nativeDim &&
    typeof config.queryPrefix === 'string' &&
    typeof config.passagePrefix === 'string' &&
    typeof config.batchSize === 'number' &&
    config.batchSize > 0 &&
    (config.device === 'cpu' || config.device === 'cuda') &&
    (config.quantization === 'none' || config.quantization === 'int8' || config.quantization === 'fp16')
  );
}
