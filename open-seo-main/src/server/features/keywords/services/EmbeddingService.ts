/**
 * Unified Embedding Service
 *
 * Single source of truth for all embeddings in the keyword intelligence system.
 * All embedding calls across the codebase MUST go through this service.
 *
 * Key features:
 * - Lazy model loading (doesn't load until first use)
 * - Matryoshka truncation for storage efficiency
 * - L2 normalization for cosine similarity
 * - Caching layer integration point
 * - Float32Array for memory efficiency
 *
 * @see .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md Fix 2
 * @see ../config/embeddings.ts for configuration
 */

import { createHash } from 'crypto';

import {
  EMBEDDING_CONFIG,
  getEmbeddingConfig,
  getPassagePrefix,
  getQueryPrefix,
  getStorageDim,
} from '../config/embeddings';
import type {
  BatchEmbeddingResult,
  EmbedOptions,
  EmbeddingCache,
  EmbeddingConfig,
  EmbeddingMetadata,
  EmbeddingModelProvider,
  EmbeddingResult,
} from '../types/embeddings';
import { EmbeddingModel, isNormalized, validateDimension } from '../types/embeddings';

// ============================================================================
// Default Model Provider (Stub)
// ============================================================================

/**
 * Default model provider stub.
 * In production, this would be replaced with actual ONNX/Transformers.js implementation.
 * For now, generates deterministic mock embeddings for testing.
 */
class DefaultModelProvider implements EmbeddingModelProvider {
  private _isLoaded = false;
  private readonly _nativeDim: number;
  private readonly _model: EmbeddingModel;

  constructor(model: EmbeddingModel, nativeDim: number) {
    this._model = model;
    this._nativeDim = nativeDim;
  }

  get nativeDim(): number {
    return this._nativeDim;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  async load(): Promise<void> {
    // In production: load ONNX model or initialize Transformers.js
    // For now, just mark as loaded
    this._isLoaded = true;
  }

  unload(): void {
    this._isLoaded = false;
  }

  async encode(texts: string[], normalize = true): Promise<Float32Array[]> {
    if (!this._isLoaded) {
      await this.load();
    }

    // Generate deterministic embeddings based on text hash
    // This ensures same input produces same output (required for tests)
    return texts.map((text) => {
      const embedding = this.generateDeterministicEmbedding(text);
      return normalize ? this.normalizeVector(embedding) : embedding;
    });
  }

  /**
   * Generate deterministic embedding from text.
   * Uses SHA-256 hash to seed the vector values.
   */
  private generateDeterministicEmbedding(text: string): Float32Array {
    const hash = createHash('sha256').update(text).digest();
    const embedding = new Float32Array(this._nativeDim);

    // Use hash bytes to seed embedding values
    for (let i = 0; i < this._nativeDim; i++) {
      // Cycle through hash bytes and use them to generate float values
      const byteIndex = i % hash.length;
      const nextByteIndex = (i + 1) % hash.length;

      // Combine two bytes to get more variation
      const combined = (hash[byteIndex] << 8) | hash[nextByteIndex];

      // Map to range [-1, 1]
      embedding[i] = (combined / 65535) * 2 - 1;
    }

    return embedding;
  }

  /**
   * L2 normalize a vector to unit length.
   */
  private normalizeVector(vector: Float32Array): Float32Array {
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }

    const length = Math.sqrt(sumSquares);
    if (length === 0) {
      return vector;
    }

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / length;
    }

    return normalized;
  }
}

// ============================================================================
// Unified Embedding Service
// ============================================================================

/**
 * Unified Embedding Service.
 *
 * This is the ONLY entry point for generating embeddings in the system.
 * Do not create embeddings directly with model libraries elsewhere.
 *
 * @example
 * ```typescript
 * const service = new UnifiedEmbeddingService();
 *
 * // Embed a query (automatically adds "query: " prefix)
 * const queryEmbedding = await service.embedQuery("profesionalus plaukų šampūnas");
 *
 * // Embed passages (automatically adds "passage: " prefix)
 * const passages = ["Šampūnas dažytiems plaukams", "Kondicionierius"];
 * const passageEmbeddings = await service.embedPassages(passages);
 * ```
 */
export class UnifiedEmbeddingService {
  private readonly config: EmbeddingConfig;
  private modelProvider: EmbeddingModelProvider | null = null;
  private cache: EmbeddingCache | null = null;

  constructor(config?: EmbeddingConfig, modelProvider?: EmbeddingModelProvider) {
    this.config = config ?? getEmbeddingConfig();

    if (modelProvider) {
      this.modelProvider = modelProvider;
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Embed passages/documents for storage.
   *
   * @param texts - Array of texts to embed
   * @param options - Optional settings (truncate, model override)
   * @returns Array of Float32Array embeddings
   */
  async embedPassages(texts: string[], options?: EmbedOptions): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    const truncate = options?.truncate ?? true;

    // Add passage prefix to all texts
    const prefixedTexts = texts.map((text) => `${this.config.passagePrefix}${text}`);

    // Process in batches
    const embeddings = await this.embedBatch(prefixedTexts);

    // Truncate if requested
    if (truncate) {
      return embeddings.map((emb) => this.truncateVector(emb, this.config.storageDim));
    }

    return embeddings;
  }

  /**
   * Embed a single query for search.
   *
   * @param text - Query text to embed
   * @param options - Optional settings (truncate, model override)
   * @returns Float32Array embedding
   */
  async embedQuery(text: string, options?: EmbedOptions): Promise<Float32Array> {
    const truncate = options?.truncate ?? true;

    // Add query prefix
    const prefixedText = `${this.config.queryPrefix}${text}`;

    // Get embedding
    const embeddings = await this.embedBatch([prefixedText]);
    let embedding = embeddings[0];

    // Truncate if requested
    if (truncate) {
      embedding = this.truncateVector(embedding, this.config.storageDim);
    }

    return embedding;
  }

  /**
   * Embed passages with full result metadata.
   */
  async embedPassagesWithMetadata(
    texts: string[],
    options?: EmbedOptions
  ): Promise<BatchEmbeddingResult> {
    const startTime = performance.now();
    const truncate = options?.truncate ?? true;

    const vectors = await this.embedPassages(texts, options);

    const processingTimeMs = performance.now() - startTime;

    const metadata: EmbeddingMetadata = {
      model: this.config.model,
      originalDim: this.config.nativeDim,
      finalDim: truncate ? this.config.storageDim : this.config.nativeDim,
      truncated: truncate,
      normalized: true,
      processingTimeMs,
      createdAt: new Date(),
    };

    return {
      vectors,
      metadata,
      count: texts.length,
    };
  }

  /**
   * Embed a query with full result metadata.
   */
  async embedQueryWithMetadata(text: string, options?: EmbedOptions): Promise<EmbeddingResult> {
    const startTime = performance.now();
    const truncate = options?.truncate ?? true;

    const vector = await this.embedQuery(text, options);

    const processingTimeMs = performance.now() - startTime;

    const metadata: EmbeddingMetadata = {
      model: this.config.model,
      originalDim: this.config.nativeDim,
      finalDim: truncate ? this.config.storageDim : this.config.nativeDim,
      truncated: truncate,
      normalized: true,
      processingTimeMs,
      createdAt: new Date(),
    };

    return {
      vector,
      metadata,
    };
  }

  /**
   * Set the caching layer for embeddings.
   * Call this to enable caching before any embed operations.
   */
  setCache(cache: EmbeddingCache): void {
    this.cache = cache;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): EmbeddingConfig {
    return this.config;
  }

  /**
   * Check if the model is currently loaded.
   */
  isModelLoaded(): boolean {
    return this.modelProvider?.isLoaded ?? false;
  }

  /**
   * Explicitly load the model.
   * Normally not needed as model loads lazily on first embed call.
   */
  async loadModel(): Promise<void> {
    const provider = this.getOrCreateProvider();
    await provider.load();
  }

  /**
   * Unload the model to free memory.
   */
  unloadModel(): void {
    if (this.modelProvider) {
      this.modelProvider.unload();
    }
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Process texts in batches.
   */
  private async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const provider = this.getOrCreateProvider();

    // Check cache first
    if (this.cache) {
      const hashes = texts.map((t) => this.hashText(t));
      const cached = await this.cache.getMany(hashes);

      // Find uncached texts
      const uncachedIndices: number[] = [];
      const uncachedTexts: string[] = [];

      cached.forEach((vec, idx) => {
        if (vec === null) {
          uncachedIndices.push(idx);
          uncachedTexts.push(texts[idx]);
        }
      });

      // Embed uncached texts
      if (uncachedTexts.length > 0) {
        const newEmbeddings = await this.embedBatchInternal(provider, uncachedTexts);

        // Store in cache
        const cacheEntries = newEmbeddings.map((vec, idx) => ({
          hash: hashes[uncachedIndices[idx]],
          vector: vec,
        }));
        await this.cache.setMany(cacheEntries);

        // Merge results
        uncachedIndices.forEach((originalIdx, newIdx) => {
          cached[originalIdx] = newEmbeddings[newIdx];
        });
      }

      return cached as Float32Array[];
    }

    return this.embedBatchInternal(provider, texts);
  }

  /**
   * Internal batch embedding with batching logic.
   */
  private async embedBatchInternal(
    provider: EmbeddingModelProvider,
    texts: string[]
  ): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchEmbeddings = await provider.encode(batch, true);
      results.push(...batchEmbeddings);
    }

    return results;
  }

  /**
   * Get or create the model provider (lazy loading).
   */
  private getOrCreateProvider(): EmbeddingModelProvider {
    if (!this.modelProvider) {
      this.modelProvider = new DefaultModelProvider(this.config.model, this.config.nativeDim);
    }
    return this.modelProvider;
  }

  /**
   * Truncate vector to target dimension using Matryoshka truncation.
   * Simply takes the first N dimensions.
   */
  private truncateVector(vector: Float32Array, targetDim: number): Float32Array {
    if (vector.length <= targetDim) {
      return vector;
    }

    const truncated = new Float32Array(targetDim);
    for (let i = 0; i < targetDim; i++) {
      truncated[i] = vector[i];
    }

    // Re-normalize after truncation
    return this.normalizeVector(truncated);
  }

  /**
   * L2 normalize a vector.
   */
  private normalizeVector(vector: Float32Array): Float32Array {
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }

    const length = Math.sqrt(sumSquares);
    if (length === 0) {
      return vector;
    }

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / length;
    }

    return normalized;
  }

  /**
   * Hash text for cache key.
   */
  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: UnifiedEmbeddingService | null = null;

/**
 * Get the singleton embedding service instance.
 * Use this for application-wide embedding operations.
 */
export function getEmbeddingService(): UnifiedEmbeddingService {
  if (!_instance) {
    _instance = new UnifiedEmbeddingService();
  }
  return _instance;
}

/**
 * Reset the singleton instance.
 * Useful for testing.
 */
export function resetEmbeddingService(): void {
  if (_instance) {
    _instance.unloadModel();
  }
  _instance = null;
}

// ============================================================================
// LightRAG Integration
// ============================================================================

/**
 * Adapter function for LightRAG embedding integration.
 * Use this when initializing LightRAG to ensure consistent embeddings.
 *
 * @example
 * ```typescript
 * import { lightragEmbeddingFunc } from './EmbeddingService';
 *
 * const rag = LightRAG({
 *   working_dir: './lightrag',
 *   embedding_func: lightragEmbeddingFunc,
 *   embedding_dim: EMBEDDING_CONFIG.storageDim,
 * });
 * ```
 */
export async function lightragEmbeddingFunc(texts: string[]): Promise<number[][]> {
  const service = getEmbeddingService();
  const embeddings = await service.embedPassages(texts, { truncate: true });

  // LightRAG expects number[][] not Float32Array[]
  return embeddings.map((emb) => Array.from(emb));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute cosine similarity between two vectors.
 * Both vectors must be normalized for this to be accurate.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  return dotProduct;
}

/**
 * Find top-k most similar vectors.
 */
export function findTopK(
  query: Float32Array,
  candidates: Float32Array[],
  k: number
): Array<{ index: number; similarity: number }> {
  const similarities = candidates.map((vec, index) => ({
    index,
    similarity: cosineSimilarity(query, vec),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, k);
}
