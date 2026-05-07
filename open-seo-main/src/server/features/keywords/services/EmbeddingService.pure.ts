/**
 * Pure Embedding Utilities - Browser-Safe
 *
 * These functions are pure math with no Node.js dependencies.
 * Extracted from EmbeddingService.ts to allow browser-safe imports.
 *
 * For the full EmbeddingService with crypto-based caching:
 * @see ./EmbeddingService.ts (server-only)
 */

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
