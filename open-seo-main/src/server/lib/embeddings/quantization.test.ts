import { describe, it, expect } from 'vitest';
import {
  toHalfvec,
  fromHalfvec,
  validateEmbedding,
  estimateStorageSize,
} from './quantization';

describe('quantization utilities', () => {
  describe('toHalfvec', () => {
    it('should format embedding as pgvector string', () => {
      const embedding = [0.1, 0.2, 0.3];
      const result = toHalfvec(embedding);
      expect(result).toBe('[0.1,0.2,0.3]');
    });

    it('should handle negative values', () => {
      const embedding = [-0.5, 0.0, 0.5];
      const result = toHalfvec(embedding);
      expect(result).toBe('[-0.5,0,0.5]');
    });
  });

  describe('fromHalfvec', () => {
    it('should parse pgvector string to array', () => {
      const halfvec = '[0.1,0.2,0.3]';
      const result = fromHalfvec(halfvec);
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle negative values', () => {
      const halfvec = '[-0.5,0,0.5]';
      const result = fromHalfvec(halfvec);
      expect(result).toEqual([-0.5, 0, 0.5]);
    });
  });

  describe('validateEmbedding', () => {
    it('should accept valid 768-dim embedding', () => {
      const embedding = Array(768).fill(0.1);
      expect(validateEmbedding(embedding)).toBe(true);
    });

    it('should reject wrong dimension', () => {
      const embedding = Array(512).fill(0.1);
      expect(validateEmbedding(embedding)).toBe(false);
    });

    it('should reject NaN values', () => {
      const embedding = Array(768).fill(0.1);
      embedding[0] = NaN;
      expect(validateEmbedding(embedding)).toBe(false);
    });

    it('should reject Infinity values', () => {
      const embedding = Array(768).fill(0.1);
      embedding[0] = Infinity;
      expect(validateEmbedding(embedding)).toBe(false);
    });

    it('should reject values outside [-1, 1] range', () => {
      const embedding = Array(768).fill(0.1);
      embedding[0] = 1.5;
      expect(validateEmbedding(embedding)).toBe(false);
    });
  });

  describe('estimateStorageSize', () => {
    it('should calculate FP32 storage correctly', () => {
      const result = estimateStorageSize(1000, 768, 'fp32');
      expect(result.bytes).toBe(1000 * 768 * 4);
      expect(result.formatted).toBe('2.9 MB');
    });

    it('should calculate FP16 storage correctly', () => {
      const result = estimateStorageSize(1000, 768, 'fp16');
      expect(result.bytes).toBe(1000 * 768 * 2);
      expect(result.formatted).toBe('1.5 MB');
    });

    it('should calculate SBQ storage correctly', () => {
      const result = estimateStorageSize(1000, 768, 'sbq');
      // SBQ: ceil(768/8) + 16 overhead per vector
      expect(result.bytes).toBe(1000 * (Math.ceil(768 / 8) + 16));
    });
  });
});
