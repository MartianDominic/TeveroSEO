import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalDataService } from './PortalDataService';

// Mock database
const mockDb = {
  select: vi.fn(),
  query: vi.fn(),
};

describe('PortalDataService', () => {
  let service: PortalDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PortalDataService(mockDb as any);
  });

  describe('getPortalData', () => {
    it('should include clusters field in response', async () => {
      // Mock proposal with clusters
      mockDb.query.mockResolvedValueOnce({
        proposals: [{
          id: 'proposal-1',
          clusters: [
            {
              id: 'cluster-1',
              tier: 'pillar',
              labelLt: 'Plaukų priežiūra',
              labelEn: 'Hair Care',
              totalVolume: 5000,
              averageDifficulty: 30,
              dominantFunnel: 'mofu',
              keywords: [
                { keyword: 'šampūnas', volume: 2000, difficulty: 25, currentPosition: 5 },
                { keyword: 'kondicionierius', volume: 1500, difficulty: 28, currentPosition: 12 },
              ],
            },
          ],
        }],
      });

      const result = await service.getPortalData('valid-token');

      expect(result.clusters).toBeDefined();
      expect(result.clusters.length).toBeGreaterThan(0);
      expect(result.clusters[0].progress).toBeDefined();
    });

    it('should calculate cluster progress metrics', async () => {
      mockDb.query.mockResolvedValueOnce({
        proposals: [{
          id: 'proposal-1',
          clusters: [
            {
              id: 'cluster-1',
              tier: 'pillar',
              labelLt: 'Test',
              labelEn: 'Test',
              totalVolume: 3000,
              averageDifficulty: 30,
              dominantFunnel: 'mofu',
              keywords: [
                { keyword: 'kw1', volume: 1000, difficulty: 20, currentPosition: 3 },   // top10
                { keyword: 'kw2', volume: 1000, difficulty: 20, currentPosition: 8 },   // top10
                { keyword: 'kw3', volume: 1000, difficulty: 20, currentPosition: 15 },  // top20
              ],
            },
          ],
        }],
      });

      const result = await service.getPortalData('valid-token');

      const cluster = result.clusters[0];
      expect(cluster.progress.inTop10).toBe(2);
      expect(cluster.progress.inTop20).toBe(1);
      expect(cluster.progress.total).toBe(3);
      expect(cluster.progress.percentComplete).toBe(67); // 2/3 in top10
    });

    it('should sort clusters by tier then volume', async () => {
      mockDb.query.mockResolvedValueOnce({
        proposals: [{
          id: 'proposal-1',
          clusters: [
            { id: 'c1', tier: 'longtail', labelLt: 'LT1', totalVolume: 500 },
            { id: 'c2', tier: 'pillar', labelLt: 'Pillar1', totalVolume: 3000 },
            { id: 'c3', tier: 'subtopic', labelLt: 'Sub1', totalVolume: 1500 },
            { id: 'c4', tier: 'pillar', labelLt: 'Pillar2', totalVolume: 5000 },
          ].map(c => ({ ...c, labelEn: c.labelLt, averageDifficulty: 30, dominantFunnel: 'mofu', keywords: [] })),
        }],
      });

      const result = await service.getPortalData('valid-token');

      // Pillars first (sorted by volume desc), then subtopics, then longtail
      expect(result.clusters[0].tier).toBe('pillar');
      expect(result.clusters[0].totalVolume).toBe(5000);
      expect(result.clusters[1].tier).toBe('pillar');
      expect(result.clusters[1].totalVolume).toBe(3000);
      expect(result.clusters[2].tier).toBe('subtopic');
      expect(result.clusters[3].tier).toBe('longtail');
    });

    it('should derive flat keywords list from clusters', async () => {
      mockDb.query.mockResolvedValueOnce({
        proposals: [{
          id: 'proposal-1',
          clusters: [
            {
              id: 'c1',
              tier: 'pillar',
              labelLt: 'Test',
              labelEn: 'Test',
              totalVolume: 2000,
              averageDifficulty: 30,
              dominantFunnel: 'mofu',
              keywords: [
                { keyword: 'kw1', volume: 1000, difficulty: 20, currentPosition: 5 },
                { keyword: 'kw2', volume: 1000, difficulty: 25, currentPosition: 10 },
              ],
            },
          ],
        }],
      });

      const result = await service.getPortalData('valid-token');

      expect(result.keywords).toBeDefined();
      expect(result.keywords.length).toBe(2);
    });
  });
});
