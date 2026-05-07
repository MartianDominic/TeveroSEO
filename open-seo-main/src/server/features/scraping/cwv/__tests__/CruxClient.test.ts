/**
 * CruxClient Unit Tests
 * Phase 95-07: Core Web Vitals Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CruxClient } from '../CruxClient';

describe('CruxClient', () => {
  const mockApiKey = 'test-crux-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new CruxClient({ apiKey: '' })).toThrow('CrUX API key is required');
    });

    it('should create client with default config', () => {
      const client = new CruxClient({ apiKey: mockApiKey });
      expect(client).toBeDefined();
    });
  });

  describe('queryOrigin', () => {
    it('should successfully fetch origin data', async () => {
      const mockResponse = {
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

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new CruxClient({ apiKey: mockApiKey });
      const result = await client.queryOrigin('https://example.com');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('chromeuxreport.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ origin: 'https://example.com' }),
        })
      );
    });

    it('should return null for 404 (not in dataset)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const client = new CruxClient({ apiKey: mockApiKey });
      const result = await client.queryOrigin('https://example.com');

      expect(result).toBeNull();
    });

    it('should retry on failure', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            record: {
              key: { origin: 'https://example.com' },
              metrics: {},
            },
          }),
        });

      const client = new CruxClient({ apiKey: mockApiKey, retries: 1 });
      const result = await client.queryOrigin('https://example.com');

      expect(result).not.toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return null after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const client = new CruxClient({ apiKey: mockApiKey, retries: 1 });
      const result = await client.queryOrigin('https://example.com');

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('extractMetrics', () => {
    it('should extract P75 values from response', () => {
      const mockResponse = {
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
            first_contentful_paint: {
              percentiles: { p75: 1500 },
              histogram: [],
            },
          },
        },
      };

      const client = new CruxClient({ apiKey: mockApiKey });
      const metrics = client.extractMetrics(mockResponse);

      expect(metrics.source).toBe('crux');
      expect(metrics.lcp).toBe(2000);
      expect(metrics.inp).toBe(150);
      expect(metrics.cls).toBe(0.05);
      expect(metrics.fcp).toBe(1500);
      expect(metrics.lcpRating).toBe('good');
      expect(metrics.inpRating).toBe('good');
      expect(metrics.clsRating).toBe('good');
    });

    it('should handle missing metrics', () => {
      const mockResponse = {
        record: {
          key: { origin: 'https://example.com' },
          metrics: {},
        },
      };

      const client = new CruxClient({ apiKey: mockApiKey });
      const metrics = client.extractMetrics(mockResponse);

      expect(metrics.source).toBe('crux');
      expect(metrics.lcp).toBeUndefined();
      expect(metrics.inp).toBeUndefined();
      expect(metrics.cls).toBeUndefined();
    });

    it('should correctly rate metrics', () => {
      const client = new CruxClient({ apiKey: mockApiKey });

      // Good LCP (<=2500)
      const goodLcp = client.extractMetrics({
        record: {
          key: { origin: 'https://example.com' },
          metrics: {
            largest_contentful_paint: { percentiles: { p75: 2000 }, histogram: [] },
          },
        },
      });
      expect(goodLcp.lcpRating).toBe('good');

      // Needs improvement LCP (2500-4000)
      const needsImprovementLcp = client.extractMetrics({
        record: {
          key: { origin: 'https://example.com' },
          metrics: {
            largest_contentful_paint: { percentiles: { p75: 3000 }, histogram: [] },
          },
        },
      });
      expect(needsImprovementLcp.lcpRating).toBe('needs-improvement');

      // Poor LCP (>4000)
      const poorLcp = client.extractMetrics({
        record: {
          key: { origin: 'https://example.com' },
          metrics: {
            largest_contentful_paint: { percentiles: { p75: 5000 }, histogram: [] },
          },
        },
      });
      expect(poorLcp.lcpRating).toBe('poor');
    });
  });
});
