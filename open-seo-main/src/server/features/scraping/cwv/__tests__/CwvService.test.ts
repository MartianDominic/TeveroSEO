/**
 * CwvService Unit Tests
 * Phase 95-07: Core Web Vitals Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CwvService } from '../CwvService';
import { CruxClient } from '../CruxClient';
import { PsiClient } from '../PsiClient';
import { CwvCache } from '../CwvCache';
import type { CwvMetrics } from '../types';

// Mock clients
vi.mock('../CruxClient');
vi.mock('../PsiClient');
vi.mock('../CwvCache');

describe('CwvService', () => {
  let mockCruxClient: any;
  let mockPsiClient: any;
  let mockCache: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCruxClient = {
      queryOrigin: vi.fn(),
      queryUrl: vi.fn(),
      extractMetrics: vi.fn(),
    };

    mockPsiClient = {
      analyze: vi.fn(),
      extractMetrics: vi.fn(),
      hasFieldData: vi.fn(),
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      mget: vi.fn(),
      invalidate: vi.fn(),
    };
  });

  describe('getCwvData', () => {
    it('should return cached data when available', async () => {
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

      mockCache.get.mockResolvedValueOnce(cachedMetrics);

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const result = await service.getCwvData('https://example.com');

      expect(result).toEqual(cachedMetrics);
      expect(mockCache.get).toHaveBeenCalledWith('https://example.com');
      expect(mockCruxClient.queryOrigin).not.toHaveBeenCalled();
    });

    it('should try CrUX origin on cache miss', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockCruxClient.queryOrigin.mockResolvedValueOnce({ record: { metrics: {} } });
      mockCruxClient.extractMetrics.mockReturnValueOnce({
        lcp: 2000,
        inp: 150,
        cls: 0.05,
        lcpRating: 'good',
        inpRating: 'good',
        clsRating: 'good',
      });

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const result = await service.getCwvData('https://example.com/page');

      expect(result.source).toBe('crux');
      expect(mockCruxClient.queryOrigin).toHaveBeenCalledWith('https://example.com');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should try CrUX URL on origin miss', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockCruxClient.queryOrigin.mockResolvedValueOnce(null);
      mockCruxClient.queryUrl.mockResolvedValueOnce({ record: { metrics: {} } });
      mockCruxClient.extractMetrics.mockReturnValueOnce({
        lcp: 2500,
        cls: 0.1,
        lcpRating: 'good',
        inpRating: 'poor',
        clsRating: 'good',
      });

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const result = await service.getCwvData('https://example.com/page');

      expect(result.source).toBe('crux');
      expect(mockCruxClient.queryUrl).toHaveBeenCalledWith('https://example.com/page');
    });

    it('should try PSI on CrUX miss', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockCruxClient.queryOrigin.mockResolvedValueOnce(null);
      mockCruxClient.queryUrl.mockResolvedValueOnce(null);
      mockPsiClient.analyze.mockResolvedValueOnce({ lighthouseResult: {} });
      mockPsiClient.extractMetrics.mockReturnValueOnce({
        lcp: 2500,
        cls: 0.1,
        performanceScore: 85,
        lcpRating: 'good',
        inpRating: 'poor',
        clsRating: 'good',
      });

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
        enablePsiFallback: true,
      });

      const result = await service.getCwvData('https://example.com/page');

      expect(result.source).toBe('psi');
      expect(mockPsiClient.analyze).toHaveBeenCalledWith('https://example.com/page');
    });

    it('should enforce PSI daily budget', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCruxClient.queryOrigin.mockResolvedValue(null);
      mockCruxClient.queryUrl.mockResolvedValue(null);

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
        enablePsiFallback: true,
        psiDailyBudget: 0, // Budget exhausted
      });

      const result = await service.getCwvData('https://example.com/page');

      expect(result.source).toBe('unavailable');
      expect(mockPsiClient.analyze).not.toHaveBeenCalled();
    });

    it('should return unavailable when all sources fail', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockCruxClient.queryOrigin.mockResolvedValueOnce(null);
      mockCruxClient.queryUrl.mockResolvedValueOnce(null);
      mockPsiClient.analyze.mockResolvedValueOnce(null);

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const result = await service.getCwvData('https://example.com/page');

      expect(result.source).toBe('unavailable');
    });
  });

  describe('batchGetCwvData', () => {
    it('should batch fetch with cache optimization', async () => {
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

      mockCache.mget.mockResolvedValueOnce(
        new Map([['https://example.com/page1', cachedMetrics]])
      );

      // For the cache miss
      mockCruxClient.queryOrigin.mockResolvedValueOnce({ record: { metrics: {} } });
      mockCruxClient.extractMetrics.mockReturnValueOnce({
        lcp: 2500,
        lcpRating: 'good',
        inpRating: 'poor',
        clsRating: 'good',
      });

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const result = await service.batchGetCwvData([
        'https://example.com/page1',
        'https://example.com/page2',
      ]);

      expect(result.size).toBe(2);
      expect(mockCache.mget).toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const result = await service.batchGetCwvData([]);

      expect(result.size).toBe(0);
    });
  });

  describe('refreshCwvData', () => {
    it('should invalidate cache and fetch fresh data', async () => {
      mockCruxClient.queryOrigin.mockResolvedValueOnce({ record: { metrics: {} } });
      mockCruxClient.extractMetrics.mockReturnValueOnce({
        lcp: 2000,
        lcpRating: 'good',
        inpRating: 'good',
        clsRating: 'good',
      });

      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      await service.refreshCwvData('https://example.com');

      expect(mockCache.invalidate).toHaveBeenCalledWith('https://example.com');
      expect(mockCache.get).toHaveBeenCalled();
    });
  });

  describe('getPsiUsageToday', () => {
    it('should return usage stats', () => {
      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
        psiDailyBudget: 1000,
      });

      const stats = service.getPsiUsageToday();

      expect(stats.budget).toBe(1000);
      expect(stats.used).toBe(0);
      expect(stats.remaining).toBe(1000);
    });
  });

  describe('getMetrics', () => {
    it('should return service metrics', () => {
      const service = new CwvService({
        cruxClient: mockCruxClient,
        psiClient: mockPsiClient,
        cache: mockCache,
      });

      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('cruxHits');
      expect(metrics).toHaveProperty('cruxMisses');
      expect(metrics).toHaveProperty('psiCalls');
      expect(metrics).toHaveProperty('unavailable');
    });
  });
});
