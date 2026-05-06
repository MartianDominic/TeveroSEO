/**
 * Embedding Quantization Utilities
 * Phase 86-08: Storage Optimization
 *
 * Provides utilities for halfvec (FP16) quantization with pgvector.
 * Requires pgvector 0.5.0+ for halfvec support.
 */

/**
 * Expected embedding dimension for jina-v5-text-nano.
 */
export const EMBEDDING_DIM = 768;

/**
 * Convert FP32 array to halfvec string format for pgvector.
 * pgvector expects: '[0.1,0.2,0.3,...]'
 *
 * Note: The actual FP16 conversion happens in PostgreSQL when
 * casting to halfvec type. This function just formats for insertion.
 */
export function toHalfvec(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Parse halfvec string from pgvector to number array.
 * Input format: '[0.1,0.2,0.3,...]'
 */
export function fromHalfvec(halfvec: string): number[] {
  const cleaned = halfvec.replace(/[\[\]]/g, '');
  if (cleaned.length === 0) return [];
  return cleaned.split(',').map(Number);
}

/**
 * Validate embedding for pgvector storage.
 *
 * Checks:
 * - Correct dimension (768 for jina-v5-text-nano)
 * - No NaN or Infinity values (crash pgvector)
 * - Values in normalized range [-1, 1]
 *
 * @param embedding - The embedding vector to validate
 * @param expectedDim - Expected dimension (default: 768)
 * @returns true if valid, false otherwise
 */
export function validateEmbedding(
  embedding: number[],
  expectedDim: number = EMBEDDING_DIM
): boolean {
  // Check type
  if (!Array.isArray(embedding)) return false;

  // Check dimension
  if (embedding.length !== expectedDim) return false;

  // Check each value
  for (const v of embedding) {
    // Must be a number
    if (typeof v !== 'number') return false;

    // No NaN or Infinity (would crash pgvector)
    if (!Number.isFinite(v)) return false;

    // Normalized embeddings should be in [-1, 1]
    // Using 1.01 to allow for floating point imprecision
    if (v < -1.01 || v > 1.01) return false;
  }

  return true;
}

/**
 * Estimate storage size for embeddings.
 *
 * @param count - Number of vectors
 * @param dimensions - Dimensions per vector
 * @param format - Storage format: 'fp32', 'fp16', or 'sbq'
 * @returns Estimated storage in bytes and formatted string
 */
export function estimateStorageSize(
  count: number,
  dimensions: number,
  format: 'fp32' | 'fp16' | 'sbq'
): { bytes: number; formatted: string } {
  let bytesPerVector: number;

  switch (format) {
    case 'fp32':
      bytesPerVector = dimensions * 4;
      break;
    case 'fp16':
      bytesPerVector = dimensions * 2;
      break;
    case 'sbq':
      // Scalar Binary Quantization: 1 bit per dimension + overhead
      bytesPerVector = Math.ceil(dimensions / 8) + 16;
      break;
  }

  const totalBytes = count * bytesPerVector;

  return {
    bytes: totalBytes,
    formatted: formatBytes(totalBytes),
  };
}

/**
 * Format bytes as human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Compute cosine similarity between two embeddings.
 * Used for testing quantization accuracy.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
