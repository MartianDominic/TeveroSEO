/**
 * Tests for HDBSCANClusterer
 * Phase 86-02: HDBSCAN + UMAP Clustering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HDBSCANClusterer, clusterKeywords } from './HDBSCANClusterer';
import type { ClusteringInput } from './types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HDBSCANClusterer', () => {
  // Helper to create test input
  function createInput(
    keyword: string,
    funnelStage: 'bofu' | 'mofu' | 'tofu' = 'bofu',
    volume: number = 100
  ): ClusteringInput {
    return {
      keyword,
      embedding: Array(768).fill(0.5),
      volume,
      difficulty: 30,
      funnelStage,
      funnelConfidence: 0.8,
      geoCity: null,
      compositeScore: 0.7,
    };
  }

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const clusterer = new HDBSCANClusterer();
      expect(clusterer).toBeInstanceOf(HDBSCANClusterer);
    });

    it('should accept custom config', () => {
      const clusterer = new HDBSCANClusterer({ minClusterSize: 5 });
      expect(clusterer).toBeInstanceOf(HDBSCANClusterer);
    });
  });

  describe('clusterKeywords', () => {
    it('should return empty result for empty input', async () => {
      const clusterer = new HDBSCANClusterer();
      const result = await clusterer.clusterKeywords([]);

      expect(result.clusters).toHaveLength(0);
      expect(result.noise).toHaveLength(0);
      expect(result.stats.inputCount).toBe(0);
    });

    it('should call Python API with embeddings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labels: [0, 0, -1],
          centroids: [[0.5]],
          vis_coords: [{ x: 1, y: 2 }, { x: 1.1, y: 2.1 }, { x: 5, y: 5 }],
          cluster_count: 1,
          noise_count: 1,
        }),
      });

      const inputs = [
        createInput('keyword1'),
        createInput('keyword2'),
        createInput('keyword3'),
      ];

      const clusterer = new HDBSCANClusterer({}, 'http://test:8000');
      await clusterer.clusterKeywords(inputs);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test:8000/api/clustering/cluster',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should use 60s timeout via AbortSignal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labels: [0],
          centroids: [[0.5]],
          vis_coords: [{ x: 1, y: 1 }],
          cluster_count: 1,
          noise_count: 0,
        }),
      });

      const clusterer = new HDBSCANClusterer();
      await clusterer.clusterKeywords([createInput('test')]);

      // Verify AbortSignal is passed (timeout is set internally)
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.signal).toBeDefined();
    });

    it('should map Python response to clusters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labels: [0, 0, 1, 1, -1],
          centroids: [[0.5], [0.8]],
          vis_coords: [
            { x: 1, y: 1 }, { x: 1.1, y: 1.1 },
            { x: 5, y: 5 }, { x: 5.1, y: 5.1 },
            { x: 10, y: 10 },
          ],
          cluster_count: 2,
          noise_count: 1,
        }),
      });

      const inputs = [
        createInput('a'), createInput('b'),
        createInput('c'), createInput('d'),
        createInput('e'),
      ];

      const clusterer = new HDBSCANClusterer();
      const result = await clusterer.clusterKeywords(inputs);

      expect(result.clusters).toHaveLength(2);
      expect(result.noise).toHaveLength(1);
      expect(result.clusters[0].keywords).toHaveLength(2);
      expect(result.clusters[1].keywords).toHaveLength(2);
    });

    it('should calculate totalVolume per cluster', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labels: [0, 0],
          centroids: [[0.5]],
          vis_coords: [{ x: 1, y: 1 }, { x: 1.1, y: 1.1 }],
          cluster_count: 1,
          noise_count: 0,
        }),
      });

      const inputs = [
        createInput('a', 'bofu', 100),
        createInput('b', 'bofu', 200),
      ];

      const clusterer = new HDBSCANClusterer();
      const result = await clusterer.clusterKeywords(inputs);

      expect(result.clusters[0].totalVolume).toBe(300);
    });

    it('should determine dominantFunnel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labels: [0, 0, 0],
          centroids: [[0.5]],
          vis_coords: [{ x: 1, y: 1 }, { x: 1.1, y: 1.1 }, { x: 1.2, y: 1.2 }],
          cluster_count: 1,
          noise_count: 0,
        }),
      });

      const inputs = [
        createInput('a', 'bofu'),
        createInput('b', 'mofu'),
        createInput('c', 'mofu'),
      ];

      const clusterer = new HDBSCANClusterer();
      const result = await clusterer.clusterKeywords(inputs);

      expect(result.clusters[0].dominantFunnel).toBe('mofu');
      expect(result.clusters[0].funnelBreakdown).toEqual({ bofu: 1, mofu: 2, tofu: 0 });
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      const clusterer = new HDBSCANClusterer();

      await expect(clusterer.clusterKeywords([createInput('test')]))
        .rejects.toThrow('Clustering API error: 500');
    });

    it('should throw on dimension error from Python API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Embedding at index 0 has 512 dimensions, expected 768',
      });

      const clusterer = new HDBSCANClusterer();

      await expect(clusterer.clusterKeywords([createInput('test')]))
        .rejects.toThrow('expected 768');
    });

    it('should handle timeout errors', async () => {
      // Simulate AbortError from timeout
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const clusterer = new HDBSCANClusterer();

      await expect(clusterer.clusterKeywords([createInput('test')]))
        .rejects.toThrow('Aborted');
    });
  });

  describe('clusterKeywords factory', () => {
    it('should work with default config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labels: [0],
          centroids: [[0.5]],
          vis_coords: [{ x: 1, y: 1 }],
          cluster_count: 1,
          noise_count: 0,
        }),
      });

      const result = await clusterKeywords([createInput('test')]);
      expect(result.clusters).toHaveLength(1);
    });
  });
});
