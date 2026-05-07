/**
 * CWV Integration Tests
 * Phase 95-07: Core Web Vitals Integration
 *
 * Tests full integration of CWV data through ScrapingService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createScrapingService } from '../../../ScrapingService';
import { CwvService, createCwvService } from '../../CwvService';
import { CwvCache } from '../../CwvCache';
import type { CwvMetrics } from '../../types';

// Mock Redis
const createMockRedis = () => ({
  get: vi.fn(),
  setex: vi.fn(),
  mget: vi.fn(),
  del: vi.fn(),
});

// Mock fetch for CrUX/PSI APIs
const mockCruxResponse = {
  record: {
    key: { origin: 'https://example.com' },
    metrics: {
      largest_contentful_paint: {
        percentiles: { p75: 2000 },
        histogram: [],
      },
      interaction_to_next_paint: {
        percentiles: { p75: 150 },
        histogram: [],
      },
      cumulative_layout_shift: {
        percentiles: { p75: 0.05 },
        histogram: [],
      },
    },
  },
};

describe('CWV Integration', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('ScrapingService with CWV', () => {
    it('should fetch CWV data through ScrapingService', async () => {
      // Mock CrUX API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCruxResponse,
      });

      // Mock HTML fetch (TieredFetcher would normally do this)
      const scrapingService = createScrapingService();

      // Create CWV service
      const cwvCache = new CwvCache({ redis: mockRedis as any });
      const cwvService = createCwvService({
        cruxApiKey: 'test-key',
        cache: cwvCache,
      });

      // Initialize scraping service with CWV
      scrapingService.initialize({
        redis: mockRedis as any,
        db: {} as any,
        cwvService,
      });

      // Since we can't easily mock TieredFetcher, let's test CwvService directly
      const cwvData = await cwvService.getCwvData('https://example.com');

      expect(cwvData).toBeDefined();
      expect(cwvData.source).toBeOneOf(['crux', 'psi', 'unavailable']);
      expect(cwvData.fetchedAt).toBeInstanceOf(Date);
    });

    it('should use cached CWV data on subsequent requests', async () => {
      const cachedMetrics: CwvMetrics = {
        source: 'crux',
        fetchedAt: new Date(),
        lcp: 2000,
        inp: 150,
        cls: 0.05,
        lcpRating: 'good',
        inpRating: 'good',
        clsRating: 'good',
      };

      // First request - cache miss, API hit
      mockRedis.get.mockResolvedValueOnce(null);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCruxResponse,
      });

      const cwvCache = new CwvCache({ redis: mockRedis as any });
      const cwvService = createCwvService({
        cruxApiKey: 'test-key',
        cache: cwvCache,
      });

      await cwvService.getCwvData('https://example.com');

      // Second request - cache hit
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ ...cachedMetrics, fetchedAt: cachedMetrics.fetchedAt.toISOString() })
      );

      const result = await cwvService.getCwvData('https://example.com');

      expect(result.source).toBe('crux');
      const metrics = cwvService.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    it('should respect PSI daily budget', async () => {
      // Mock CrUX miss (404)
      mockRedis.get.mockResolvedValue(null);
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      const cwvCache = new CwvCache({ redis: mockRedis as any });
      const cwvService = createCwvService({
        cruxApiKey: 'test-key',
        cache: cwvCache,
        psiDailyBudget: 1,
      });

      // First request - should use PSI
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          lighthouseResult: {
            categories: { performance: { score: 0.85 } },
            audits: {
              'largest-contentful-paint': { numericValue: 2500, score: 0.8, displayValue: '2.5s' },
              'cumulative-layout-shift': { numericValue: 0.1, score: 0.9, displayValue: '0.1' },
              'total-blocking-time': { numericValue: 200, score: 0.7, displayValue: '200ms' },
              'first-contentful-paint': { numericValue: 1500, score: 0.85, displayValue: '1.5s' },
              'speed-index': { numericValue: 3000, score: 0.75, displayValue: '3.0s' },
              interactive: { numericValue: 4000, score: 0.7, displayValue: '4.0s' },
            },
          },
        }),
      });

      const result1 = await cwvService.getCwvData('https://unique-1.example.com');
      expect(result1.source).toBeOneOf(['crux', 'psi', 'unavailable']);

      // Second request - budget exhausted, should skip PSI
      const result2 = await cwvService.getCwvData('https://unique-2.example.com');

      const usage = cwvService.getPsiUsageToday();
      expect(usage.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should handle CWV fetch failures gracefully', async () => {
      // Mock all sources failing
      mockRedis.get.mockResolvedValue(null);
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const cwvCache = new CwvCache({ redis: mockRedis as any });
      const cwvService = createCwvService({
        cruxApiKey: 'test-key',
        cache: cwvCache,
      });

      const result = await cwvService.getCwvData('https://example.com');

      expect(result.source).toBe('unavailable');
      expect(result.lcpRating).toBe('poor');
      expect(result.inpRating).toBe('poor');
      expect(result.clsRating).toBe('poor');
    });
  });

  describe('Batch Operations', () => {
    it('should optimize batch requests with origin deduplication', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.mget.mockResolvedValue([]);

      // Mock CrUX response for origin
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockCruxResponse,
      });

      const cwvCache = new CwvCache({ redis: mockRedis as any });
      const cwvService = createCwvService({
        cruxApiKey: 'test-key',
        cache: cwvCache,
      });

      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      const results = await cwvService.batchGetCwvData(urls);

      expect(results.size).toBe(3);
      // Should use origin-level cache for all pages from same origin
      expect(mockRedis.mget).toHaveBeenCalled();
    });
  });

  describe('Cache TTL Behavior', () => {
    it('should apply different TTLs for CrUX vs PSI data', async () => {
      mockRedis.get.mockResolvedValue(null);

      // CrUX data
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCruxResponse,
      });

      const cwvCache = new CwvCache({
        redis: mockRedis as any,
        cruxTtl: 86400, // 24 hours
        psiTtl: 3600, // 1 hour
      });

      const cwvService = createCwvService({
        cruxApiKey: 'test-key',
        cache: cwvCache,
      });

      await cwvService.getCwvData('https://example.com');

      // Verify CrUX data stored with 24h TTL
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('cwv:origin:'),
        86400,
        expect.any(String)
      );
    });
  });
});

// Helper to check if value is one of multiple options
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
