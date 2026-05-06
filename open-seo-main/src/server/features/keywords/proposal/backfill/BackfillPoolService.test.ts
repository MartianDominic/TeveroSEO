import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackfillPoolService } from './BackfillPoolService';
import { DEFAULT_BACKFILL_CONFIG } from './types';

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => Promise.resolve([])),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve([])),
  })),
};

describe('BackfillPoolService', () => {
  let service: BackfillPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BackfillPoolService(mockDb as any);
  });

  describe('maxPoolSize enforcement', () => {
    it('should enforce 200 keyword maximum', () => {
      expect(DEFAULT_BACKFILL_CONFIG.maxPoolSize).toBe(200);
    });

    it('should not add keywords beyond maxPoolSize', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 195 }])),
        })),
      });
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn(() => Promise.resolve([])),
      });

      const keywords = Array(10)
        .fill(null)
        .map((_, i) => ({
          keyword: `keyword-${i}`,
          volume: 100,
          difficulty: 20,
          funnelStage: 'mofu' as const,
          embedding: Array(768).fill(0.1),
          compositeScore: 0.8,
          funnelConfidence: 0.8,
          geoCity: null,
        }));

      const added = await service.addToPool('proposal-1', keywords, 'cluster-1', 'Test Cluster');

      expect(added).toBe(5);
    });
  });

  describe('needsReplenishment', () => {
    it('should return true when pool is below minPoolSize (50)', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 30 }])),
        })),
      });

      const needs = await service.needsReplenishment('proposal-1');

      expect(needs).toBe(true);
    });

    it('should return false when pool is at or above minPoolSize', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 100 }])),
        })),
      });

      const needs = await service.needsReplenishment('proposal-1');

      expect(needs).toBe(false);
    });
  });

  describe('consumeFromPool', () => {
    it('should return requested count of keywords', async () => {
      const mockEntries = [
        {
          id: '1',
          proposalId: 'p1',
          keyword: 'kw1',
          volume: 100,
          difficulty: 20,
          funnelStage: 'mofu',
          clusterId: 'c1',
          clusterLabel: 'Test',
          embedding: [],
          relevanceScore: 0.9,
          createdAt: new Date(),
        },
        {
          id: '2',
          proposalId: 'p1',
          keyword: 'kw2',
          volume: 100,
          difficulty: 20,
          funnelStage: 'mofu',
          clusterId: 'c1',
          clusterLabel: 'Test',
          embedding: [],
          relevanceScore: 0.8,
          createdAt: new Date(),
        },
      ];
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve(mockEntries)),
          })),
        })),
      });
      mockDb.delete.mockReturnValueOnce({
        where: vi.fn(() => Promise.resolve([])),
      });

      const consumed = await service.consumeFromPool('proposal-1', 2);

      expect(consumed.length).toBe(2);
    });
  });
});
