/**
 * PsiClient Unit Tests
 * Phase 95-07: Core Web Vitals Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PsiClient } from '../PsiClient';

describe('PsiClient', () => {
  const mockApiKey = 'test-psi-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new PsiClient({ apiKey: '' })).toThrow('PSI API key is required');
    });

    it('should create client with default config', () => {
      const client = new PsiClient({ apiKey: mockApiKey });
      expect(client).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should successfully fetch PSI data', async () => {
      const mockResponse = {
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 2500, score: 0.8, displayValue: '2.5s' },
            'cumulative-layout-shift': { numericValue: 0.1, score: 0.9, displayValue: '0.1' },
            'total-blocking-time': { numericValue: 200, score: 0.7, displayValue: '200ms' },
            'first-contentful-paint': { numericValue: 1500, score: 0.85, displayValue: '1.5s' },
            'speed-index': { numericValue: 3000, score: 0.75, displayValue: '3.0s' },
            interactive: { numericValue: 4000, score: 0.7, displayValue: '4.0s' },
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new PsiClient({ apiKey: mockApiKey });
      const result = await client.analyze('https://example.com');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pagespeedonline'),
        expect.any(Object)
      );
    });

    it('should return null on 429 rate limit', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const client = new PsiClient({ apiKey: mockApiKey });
      const result = await client.analyze('https://example.com');

      expect(result).toBeNull();
    });

    it('should return null on timeout', async () => {
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({}) }), 50000);
          })
      );

      const client = new PsiClient({ apiKey: mockApiKey, timeout: 100 });
      const result = await client.analyze('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const client = new PsiClient({ apiKey: mockApiKey });
      const result = await client.analyze('https://example.com');

      expect(result).toBeNull();
    });
  });

  describe('extractMetrics', () => {
    it('should extract lab metrics when field data unavailable', () => {
      const mockResponse = {
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 2500, score: 0.8, displayValue: '2.5s' },
            'cumulative-layout-shift': { numericValue: 0.1, score: 0.9, displayValue: '0.1' },
            'total-blocking-time': { numericValue: 200, score: 0.7, displayValue: '200ms' },
            'first-contentful-paint': { numericValue: 1500, score: 0.85, displayValue: '1.5s' },
            'speed-index': { numericValue: 3000, score: 0.75, displayValue: '3.0s' },
            interactive: { numericValue: 4000, score: 0.7, displayValue: '4.0s' },
          },
        },
      };

      const client = new PsiClient({ apiKey: mockApiKey });
      const metrics = client.extractMetrics(mockResponse);

      expect(metrics.source).toBe('psi');
      expect(metrics.lcp).toBe(2500);
      expect(metrics.cls).toBe(0.1);
      expect(metrics.fcp).toBe(1500);
      expect(metrics.si).toBe(3000);
      expect(metrics.tbt).toBe(200);
      expect(metrics.performanceScore).toBe(85);
    });

    it('should prefer field data over lab data', () => {
      const mockResponse = {
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 3000, score: 0.7, displayValue: '3.0s' },
            'cumulative-layout-shift': { numericValue: 0.2, score: 0.8, displayValue: '0.2' },
            'total-blocking-time': { numericValue: 300, score: 0.6, displayValue: '300ms' },
            'first-contentful-paint': { numericValue: 2000, score: 0.75, displayValue: '2.0s' },
            'speed-index': { numericValue: 4000, score: 0.65, displayValue: '4.0s' },
            interactive: { numericValue: 5000, score: 0.6, displayValue: '5.0s' },
          },
        },
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2000 },
            CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 10 }, // Stored as 0.1 * 100
            INTERACTION_TO_NEXT_PAINT: { percentile: 150 },
            FIRST_CONTENTFUL_PAINT_MS: { percentile: 1500 },
            EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 500 },
          },
        },
      };

      const client = new PsiClient({ apiKey: mockApiKey });
      const metrics = client.extractMetrics(mockResponse);

      expect(metrics.source).toBe('psi');
      expect(metrics.lcp).toBe(2000); // Field data, not lab 3000
      expect(metrics.cls).toBe(0.1); // Field data divided by 100
      expect(metrics.inp).toBe(150);
      expect(metrics.fcp).toBe(1500);
      expect(metrics.ttfb).toBe(500);
    });
  });

  describe('hasFieldData', () => {
    it('should return true when field data exists', () => {
      const mockResponse = {
        lighthouseResult: {
          categories: { performance: { score: 0.85 } },
          audits: {} as any,
        },
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2000 },
          },
        },
      };

      const client = new PsiClient({ apiKey: mockApiKey });
      expect(client.hasFieldData(mockResponse)).toBe(true);
    });

    it('should return false when field data missing', () => {
      const mockResponse = {
        lighthouseResult: {
          categories: { performance: { score: 0.85 } },
          audits: {} as any,
        },
      };

      const client = new PsiClient({ apiKey: mockApiKey });
      expect(client.hasFieldData(mockResponse)).toBe(false);
    });
  });
});
