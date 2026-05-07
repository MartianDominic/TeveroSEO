/**
 * CwvCache Unit Tests
 * Phase 95-07: Core Web Vitals Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CwvCache } from '../CwvCache';
import type { CwvMetrics } from '../types';

// Mock Redis
const createMockRedis = () => ({
  get: vi.fn(),
  setex: vi.fn(),
  mget: vi.fn(),
  del: vi.fn(),
});

describe('CwvCache', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if Redis is missing', () => {
      expect(() => new CwvCache({ redis: null as any })).toThrow(
        'Redis instance is required'
      );
    });

    it('should create cache with default TTLs', () => {
      const cache = new CwvCache({ redis: mockRedis as any });
      expect(cache).toBeDefined();
    });

    it('should accept custom TTLs', () => {
      const cache = new CwvCache({
        redis: mockRedis as any,
        cruxTtl: 3600,
        psiTtl: 1800,
      });
      expect(cache).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return cached origin-level data', async () => {
      const metrics: CwvMetrics = {
        source: 'crux',
        fetchedAt: new Date(),
        lcp: 2000,
        inp: 150,
        cls: 0.05,
        lcpRating: 'good',
        inpRating: 'good',
        clsRating: 'good',
      };

      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ ...metrics, fetchedAt: metrics.fetchedAt.toISOString() })
      );

      const cache = new CwvCache({ redis: mockRedis as any });
      const result = await cache.get('https://example.com/page');

      expect(result).toBeDefined();
      expect(result?.source).toBe('crux');
      expect(result?.lcp).toBe(2000);
      expect(mockRedis.get).toHaveBeenCalledWith('cwv:origin:https://example.com');
    });

    it('should fallback to URL-level cache', async () => {
      const metrics: CwvMetrics = {
        source: 'psi',
        fetchedAt: new Date(),
        lcp: 2500,
        cls: 0.1,
        performanceScore: 85,
        lcpRating: 'good',
        inpRating: 'poor',
        clsRating: 'good',
      };

      mockRedis.get
        .mockResolvedValueOnce(null) // Origin miss
        .mockResolvedValueOnce(
          JSON.stringify({ ...metrics, fetchedAt: metrics.fetchedAt.toISOString() })
        ); // URL hit

      const cache = new CwvCache({ redis: mockRedis as any });
      const result = await cache.get('https://example.com/page');

      expect(result).toBeDefined();
      expect(result?.source).toBe('psi');
      expect(mockRedis.get).toHaveBeenCalledTimes(2);
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const cache = new CwvCache({ redis: mockRedis as any });
      const result = await cache.get('https://example.com/page');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store CrUX data at origin level with 24h TTL', async () => {
      const metrics: CwvMetrics = {
        source: 'crux',
        fetchedAt: new Date(),
        lcp: 2000,
        inp: 150,
        cls: 0.05,
        lcpRating: 'good',
        inpRating: 'good',
        clsRating: 'good',
      };

      const cache = new CwvCache({ redis: mockRedis as any });
      await cache.set('https://example.com/page', metrics);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cwv:origin:https://example.com',
        24 * 60 * 60, // 24 hours
        expect.any(String)
      );
    });

    it('should store PSI data at URL level with 1h TTL', async () => {
      const metrics: CwvMetrics = {
        source: 'psi',
        fetchedAt: new Date(),
        lcp: 2500,
        cls: 0.1,
        performanceScore: 85,
        lcpRating: 'good',
        inpRating: 'poor',
        clsRating: 'good',
      };

      const cache = new CwvCache({ redis: mockRedis as any });
      await cache.set('https://example.com/page', metrics);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('cwv:url:'),
        60 * 60, // 1 hour
        expect.any(String)
      );
    });

    it('should not cache unavailable data', async () => {
      const metrics: CwvMetrics = {
        source: 'unavailable',
        fetchedAt: new Date(),
        lcpRating: 'poor',
        inpRating: 'poor',
        clsRating: 'poor',
      };

      const cache = new CwvCache({ redis: mockRedis as any });
      await cache.set('https://example.com/page', metrics);

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('mget', () => {
    it('should batch fetch from origin-level cache', async () => {
      const metrics: CwvMetrics = {
        source: 'crux',
        fetchedAt: new Date(),
        lcp: 2000,
        inp: 150,
        cls: 0.05,
        lcpRating: 'good',
        inpRating: 'good',
        clsRating: 'good',
      };

      const serialized = JSON.stringify({
        ...metrics,
        fetchedAt: metrics.fetchedAt.toISOString(),
      });

      mockRedis.mget.mockResolvedValueOnce([serialized, null]);

      const cache = new CwvCache({ redis: mockRedis as any });
      const result = await cache.mget([
        'https://example.com/page1',
        'https://other.com/page',
      ]);

      expect(result.size).toBe(1);
      expect(result.get('https://example.com/page1')).toBeDefined();
      expect(mockRedis.mget).toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const cache = new CwvCache({ redis: mockRedis as any });
      const result = await cache.mget([]);

      expect(result.size).toBe(0);
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should delete both origin and URL keys', async () => {
      const cache = new CwvCache({ redis: mockRedis as any });
      await cache.invalidate('https://example.com/page');

      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith('cwv:origin:https://example.com');
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('cwv:url:'));
    });
  });
});
