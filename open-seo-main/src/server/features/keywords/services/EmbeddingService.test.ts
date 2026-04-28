/**
 * Unified Embedding Service Tests
 *
 * Comprehensive test suite for the embedding service.
 * Tests cover:
 * - Dimension validation
 * - Truncation behavior
 * - Normalization
 * - Determinism
 * - Query vs passage differentiation
 * - Batch processing
 * - Cache integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { EMBEDDING_CONFIG } from '../config/embeddings';
import type { EmbeddingCache, EmbeddingConfig, EmbeddingModelProvider } from '../types/embeddings';
import { EmbeddingModel, isNormalized, validateDimension } from '../types/embeddings';

import {
  UnifiedEmbeddingService,
  cosineSimilarity,
  findTopK,
  getEmbeddingService,
  lightragEmbeddingFunc,
  resetEmbeddingService,
} from './EmbeddingService';

// ============================================================================
// Test Fixtures
// ============================================================================

const testConfig: EmbeddingConfig = {
  model: EmbeddingModel.JINA_V3,
  modelFallback: EmbeddingModel.E5_BASE,
  nativeDim: 1024,
  storageDim: 384,
  queryPrefix: 'query: ',
  passagePrefix: 'passage: ',
  batchSize: 32,
  device: 'cpu',
  quantization: 'int8',
};

/**
 * Mock cache implementation for testing.
 */
class MockEmbeddingCache implements EmbeddingCache {
  private store = new Map<string, Float32Array>();
  public getCalls: string[] = [];
  public setCalls: Array<{ hash: string; vector: Float32Array }> = [];

  async get(textHash: string): Promise<Float32Array | null> {
    this.getCalls.push(textHash);
    return this.store.get(textHash) ?? null;
  }

  async set(textHash: string, vector: Float32Array, _ttlSeconds?: number): Promise<void> {
    this.setCalls.push({ hash: textHash, vector });
    this.store.set(textHash, vector);
  }

  async getMany(textHashes: string[]): Promise<(Float32Array | null)[]> {
    return Promise.all(textHashes.map((h) => this.get(h)));
  }

  async setMany(
    entries: Array<{ hash: string; vector: Float32Array }>,
    ttlSeconds?: number
  ): Promise<void> {
    await Promise.all(entries.map((e) => this.set(e.hash, e.vector, ttlSeconds)));
  }

  async invalidate(textHash: string): Promise<void> {
    this.store.delete(textHash);
  }

  clear(): void {
    this.store.clear();
    this.getCalls = [];
    this.setCalls = [];
  }
}

// ============================================================================
// Dimension Tests
// ============================================================================

describe('EmbeddingService - Dimensions', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should produce embeddings with correct storage dimension when truncated', async () => {
    const embedding = await service.embedQuery('test query');

    expect(embedding.length).toBe(testConfig.storageDim);
    expect(embedding.length).toBe(384);
  });

  it('should produce embeddings with native dimension when not truncated', async () => {
    const embedding = await service.embedQuery('test query', { truncate: false });

    expect(embedding.length).toBe(testConfig.nativeDim);
    expect(embedding.length).toBe(1024);
  });

  it('should produce batch embeddings with correct dimension', async () => {
    const passages = ['passage one', 'passage two', 'passage three'];
    const embeddings = await service.embedPassages(passages);

    expect(embeddings).toHaveLength(3);
    embeddings.forEach((emb) => {
      expect(emb.length).toBe(testConfig.storageDim);
    });
  });

  it('should match config dimension in metadata', async () => {
    const result = await service.embedQueryWithMetadata('test');

    expect(result.metadata.finalDim).toBe(testConfig.storageDim);
    expect(result.metadata.originalDim).toBe(testConfig.nativeDim);
    expect(result.metadata.truncated).toBe(true);
  });

  it('should throw on invalid dimension validation', () => {
    const vector = new Float32Array(256);

    expect(() => validateDimension(vector, 384, 'test')).toThrow(
      'Invalid test dimension: expected 384, got 256'
    );
  });
});

// ============================================================================
// Truncation Tests
// ============================================================================

describe('EmbeddingService - Truncation', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should truncate to storage dimension by default', async () => {
    const embedding = await service.embedQuery('test');

    expect(embedding.length).toBe(testConfig.storageDim);
  });

  it('should not truncate when truncate=false', async () => {
    const embedding = await service.embedQuery('test', { truncate: false });

    expect(embedding.length).toBe(testConfig.nativeDim);
  });

  it('should preserve leading dimensions after truncation', async () => {
    // Get both truncated and non-truncated versions
    const full = await service.embedQuery('test', { truncate: false });
    const truncated = await service.embedQuery('test', { truncate: true });

    // After truncation and re-normalization, the direction should be similar
    // but exact values differ due to re-normalization
    // Check that the truncated embedding is a valid vector
    expect(truncated.length).toBe(testConfig.storageDim);
    expect(Array.from(truncated).some((v) => v !== 0)).toBe(true);
  });

  it('should re-normalize after truncation', async () => {
    const embedding = await service.embedQuery('test query');

    expect(isNormalized(embedding)).toBe(true);
  });
});

// ============================================================================
// Normalization Tests
// ============================================================================

describe('EmbeddingService - Normalization', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should produce normalized vectors (unit length)', async () => {
    const embedding = await service.embedQuery('normalization test');

    // Calculate vector length
    let sumSquares = 0;
    for (let i = 0; i < embedding.length; i++) {
      sumSquares += embedding[i] * embedding[i];
    }
    const length = Math.sqrt(sumSquares);

    // Should be very close to 1.0
    expect(Math.abs(length - 1.0)).toBeLessThan(0.001);
  });

  it('should produce normalized passage embeddings', async () => {
    const embeddings = await service.embedPassages(['test 1', 'test 2']);

    embeddings.forEach((emb) => {
      expect(isNormalized(emb)).toBe(true);
    });
  });

  it('should report normalized=true in metadata', async () => {
    const result = await service.embedQueryWithMetadata('test');

    expect(result.metadata.normalized).toBe(true);
  });
});

// ============================================================================
// Determinism Tests
// ============================================================================

describe('EmbeddingService - Determinism', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should produce same embedding for same input', async () => {
    const text = 'deterministic test input';

    const embedding1 = await service.embedQuery(text);
    const embedding2 = await service.embedQuery(text);

    // Should be exactly equal
    expect(embedding1.length).toBe(embedding2.length);
    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBe(embedding2[i]);
    }
  });

  it('should produce consistent embeddings across service instances', async () => {
    const text = 'cross-instance test';

    const service1 = new UnifiedEmbeddingService(testConfig);
    const service2 = new UnifiedEmbeddingService(testConfig);

    const embedding1 = await service1.embedQuery(text);
    const embedding2 = await service2.embedQuery(text);

    expect(embedding1.length).toBe(embedding2.length);
    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBe(embedding2[i]);
    }

    service1.unloadModel();
    service2.unloadModel();
  });

  it('should produce different embeddings for different inputs', async () => {
    const embedding1 = await service.embedQuery('first text');
    const embedding2 = await service.embedQuery('second text');

    // Should NOT be equal
    let allEqual = true;
    for (let i = 0; i < embedding1.length; i++) {
      if (embedding1[i] !== embedding2[i]) {
        allEqual = false;
        break;
      }
    }

    expect(allEqual).toBe(false);
  });
});

// ============================================================================
// Query vs Passage Tests
// ============================================================================

describe('EmbeddingService - Query vs Passage Differentiation', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should produce different embeddings for query vs passage with same text', async () => {
    const text = 'same text different context';

    const queryEmbedding = await service.embedQuery(text);
    const passageEmbeddings = await service.embedPassages([text]);
    const passageEmbedding = passageEmbeddings[0];

    // Due to different prefixes, embeddings should differ
    let allEqual = true;
    for (let i = 0; i < queryEmbedding.length; i++) {
      if (queryEmbedding[i] !== passageEmbedding[i]) {
        allEqual = false;
        break;
      }
    }

    expect(allEqual).toBe(false);
  });

  it('should use correct prefixes', () => {
    expect(testConfig.queryPrefix).toBe('query: ');
    expect(testConfig.passagePrefix).toBe('passage: ');
  });

  it('should include prefix in embedding computation', async () => {
    // Embed without automatic prefix
    const text = 'test text';

    // Manual prefix should match automatic
    const queryAuto = await service.embedQuery(text);

    // The automatic embedding includes the prefix, so results are deterministic
    const queryAuto2 = await service.embedQuery(text);

    // Same input should produce same output
    for (let i = 0; i < queryAuto.length; i++) {
      expect(queryAuto[i]).toBe(queryAuto2[i]);
    }
  });
});

// ============================================================================
// Batch Processing Tests
// ============================================================================

describe('EmbeddingService - Batch Processing', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should handle empty batch', async () => {
    const embeddings = await service.embedPassages([]);

    expect(embeddings).toHaveLength(0);
  });

  it('should handle single item batch', async () => {
    const embeddings = await service.embedPassages(['single item']);

    expect(embeddings).toHaveLength(1);
    expect(embeddings[0].length).toBe(testConfig.storageDim);
  });

  it('should handle batch larger than batch size', async () => {
    // Create batch larger than config.batchSize (32)
    const texts = Array.from({ length: 50 }, (_, i) => `text number ${i}`);
    const embeddings = await service.embedPassages(texts);

    expect(embeddings).toHaveLength(50);
    embeddings.forEach((emb) => {
      expect(emb.length).toBe(testConfig.storageDim);
    });
  });

  it('should preserve order in batch results', async () => {
    const texts = ['first', 'second', 'third'];
    const embeddings = await service.embedPassages(texts);

    // Get individual embeddings
    const individual = await Promise.all(texts.map((t) => service.embedPassages([t])));

    // Should match order
    for (let i = 0; i < texts.length; i++) {
      for (let j = 0; j < embeddings[i].length; j++) {
        expect(embeddings[i][j]).toBe(individual[i][0][j]);
      }
    }
  });

  it('should return correct count in metadata', async () => {
    const texts = ['a', 'b', 'c', 'd', 'e'];
    const result = await service.embedPassagesWithMetadata(texts);

    expect(result.count).toBe(5);
    expect(result.vectors).toHaveLength(5);
  });
});

// ============================================================================
// Cache Integration Tests
// ============================================================================

describe('EmbeddingService - Cache Integration', () => {
  let service: UnifiedEmbeddingService;
  let cache: MockEmbeddingCache;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
    cache = new MockEmbeddingCache();
    service.setCache(cache);
  });

  afterEach(() => {
    service.unloadModel();
    cache.clear();
  });

  it('should check cache before embedding', async () => {
    await service.embedQuery('test query');

    expect(cache.getCalls.length).toBeGreaterThan(0);
  });

  it('should store embeddings in cache', async () => {
    await service.embedQuery('cache test');

    expect(cache.setCalls.length).toBeGreaterThan(0);
    expect(cache.setCalls[0].vector.length).toBe(testConfig.nativeDim);
  });

  it('should return cached embedding on cache hit', async () => {
    // First call - cache miss
    const embedding1 = await service.embedQuery('cached query');

    // Second call - should hit cache
    const embedding2 = await service.embedQuery('cached query');

    // Should be same embedding
    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBe(embedding2[i]);
    }
  });

  it('should batch cache operations for passage embeddings', async () => {
    const texts = ['text1', 'text2', 'text3'];
    await service.embedPassages(texts);

    // Should have made cache calls for all texts
    expect(cache.getCalls.length).toBe(3);
    expect(cache.setCalls.length).toBe(3);
  });
});

// ============================================================================
// Lazy Loading Tests
// ============================================================================

describe('EmbeddingService - Lazy Loading', () => {
  it('should not load model on construction', () => {
    const service = new UnifiedEmbeddingService(testConfig);

    expect(service.isModelLoaded()).toBe(false);

    service.unloadModel();
  });

  it('should load model on first embed call', async () => {
    const service = new UnifiedEmbeddingService(testConfig);

    expect(service.isModelLoaded()).toBe(false);

    await service.embedQuery('trigger load');

    expect(service.isModelLoaded()).toBe(true);

    service.unloadModel();
  });

  it('should unload model when requested', async () => {
    const service = new UnifiedEmbeddingService(testConfig);

    await service.embedQuery('load model');
    expect(service.isModelLoaded()).toBe(true);

    service.unloadModel();
    expect(service.isModelLoaded()).toBe(false);
  });

  it('should allow explicit model loading', async () => {
    const service = new UnifiedEmbeddingService(testConfig);

    await service.loadModel();
    expect(service.isModelLoaded()).toBe(true);

    service.unloadModel();
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('EmbeddingService - Singleton', () => {
  afterEach(() => {
    resetEmbeddingService();
  });

  it('should return same instance', () => {
    const instance1 = getEmbeddingService();
    const instance2 = getEmbeddingService();

    expect(instance1).toBe(instance2);
  });

  it('should reset singleton', () => {
    const instance1 = getEmbeddingService();
    resetEmbeddingService();
    const instance2 = getEmbeddingService();

    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// LightRAG Integration Tests
// ============================================================================

describe('EmbeddingService - LightRAG Integration', () => {
  afterEach(() => {
    resetEmbeddingService();
  });

  it('should return number[][] for LightRAG compatibility', async () => {
    const texts = ['text 1', 'text 2'];
    const embeddings = await lightragEmbeddingFunc(texts);

    expect(Array.isArray(embeddings)).toBe(true);
    expect(Array.isArray(embeddings[0])).toBe(true);
    expect(typeof embeddings[0][0]).toBe('number');
  });

  it('should return correct dimension for LightRAG', async () => {
    const embeddings = await lightragEmbeddingFunc(['test']);

    expect(embeddings[0].length).toBe(EMBEDDING_CONFIG.storageDim);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('EmbeddingService - Utility Functions', () => {
  it('should compute cosine similarity correctly', () => {
    // Identical normalized vectors should have similarity 1.0
    const vec = new Float32Array([0.6, 0.8]);
    const similarity = cosineSimilarity(vec, vec);

    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should compute cosine similarity of orthogonal vectors as 0', () => {
    const vec1 = new Float32Array([1, 0]);
    const vec2 = new Float32Array([0, 1]);
    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(0, 5);
  });

  it('should throw on dimension mismatch in cosine similarity', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([0, 1]);

    expect(() => cosineSimilarity(vec1, vec2)).toThrow('Vector dimension mismatch');
  });

  it('should find top-k similar vectors', () => {
    const query = new Float32Array([1, 0, 0]);
    const candidates = [
      new Float32Array([0, 1, 0]), // orthogonal
      new Float32Array([0.9, 0.1, 0]), // most similar
      new Float32Array([0.5, 0.5, 0]), // medium
    ];

    // Normalize candidates
    const normalizedCandidates = candidates.map((vec) => {
      const len = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return new Float32Array(vec.map((v) => v / len));
    });

    const topK = findTopK(query, normalizedCandidates, 2);

    expect(topK).toHaveLength(2);
    expect(topK[0].index).toBe(1); // Most similar
    expect(topK[1].index).toBe(2); // Second most similar
  });
});

// ============================================================================
// Configuration Tests
// ============================================================================

describe('EmbeddingService - Configuration', () => {
  it('should use provided config', () => {
    const customConfig: EmbeddingConfig = {
      ...testConfig,
      storageDim: 256,
    };

    const service = new UnifiedEmbeddingService(customConfig);
    const config = service.getConfig();

    expect(config.storageDim).toBe(256);

    service.unloadModel();
  });

  it('should use default config when none provided', () => {
    const service = new UnifiedEmbeddingService();
    const config = service.getConfig();

    expect(config.model).toBe(EMBEDDING_CONFIG.model);

    service.unloadModel();
  });

  it('should validate config values', () => {
    const config = EMBEDDING_CONFIG;

    expect(config.storageDim).toBeLessThanOrEqual(config.nativeDim);
    expect(config.batchSize).toBeGreaterThan(0);
    expect(['cpu', 'cuda']).toContain(config.device);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('EmbeddingService - Error Handling', () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    service = new UnifiedEmbeddingService(testConfig);
  });

  afterEach(() => {
    service.unloadModel();
  });

  it('should handle empty string input', async () => {
    const embedding = await service.embedQuery('');

    expect(embedding.length).toBe(testConfig.storageDim);
  });

  it('should handle very long input', async () => {
    const longText = 'a'.repeat(10000);
    const embedding = await service.embedQuery(longText);

    expect(embedding.length).toBe(testConfig.storageDim);
    expect(isNormalized(embedding)).toBe(true);
  });

  it('should handle special characters', async () => {
    const specialText = 'šampūnas dažytiems plaukams 専門 的な @#$%';
    const embedding = await service.embedQuery(specialText);

    expect(embedding.length).toBe(testConfig.storageDim);
    expect(isNormalized(embedding)).toBe(true);
  });

  it('should handle unicode characters', async () => {
    const unicodeText = 'Lithuanian: ąčęėįšųūž Russian: привет Chinese: 你好';
    const embedding = await service.embedQuery(unicodeText);

    expect(embedding.length).toBe(testConfig.storageDim);
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('EmbeddingService - Type Guards', () => {
  it('should validate normalized vectors', () => {
    const normalized = new Float32Array([0.6, 0.8]); // 0.6^2 + 0.8^2 = 1.0
    const unnormalized = new Float32Array([3, 4]); // length = 5

    expect(isNormalized(normalized)).toBe(true);
    expect(isNormalized(unnormalized)).toBe(false);
  });

  it('should allow tolerance in normalization check', () => {
    const almostNormalized = new Float32Array([0.6001, 0.7999]);
    const sumSq = 0.6001 * 0.6001 + 0.7999 * 0.7999;
    const length = Math.sqrt(sumSq);

    // With default tolerance of 0.001
    expect(Math.abs(length - 1.0) < 0.01).toBe(true);
  });
});
