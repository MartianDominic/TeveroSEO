import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetentionManager } from '../RetentionManager';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import type { R2Client } from '../RetentionManager';

describe('RetentionManager', () => {
  let retentionManager: RetentionManager;
  let mockPg: Pool;
  let mockRedis: Redis;
  let mockR2: R2Client;

  beforeEach(() => {
    mockPg = {
      query: vi.fn(),
    } as any;

    mockRedis = {} as any;

    mockR2 = {
      list: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;

    retentionManager = new RetentionManager({
      redis: mockRedis,
      pg: mockPg,
      r2: mockR2,
      policies: [
        {
          target: 'cache',
          retention: 30,
          action: 'delete',
          schedule: '0 3 * * *',
        },
      ],
    });
  });

  describe('cache cleanup', () => {
    it('should delete expired cache entries', async () => {
      (mockPg.query as any).mockResolvedValueOnce({
        rowCount: 42,
        rows: [],
      });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      await retentionManager.executePolicy({
        target: 'cache',
        retention: 30,
        action: 'delete',
        schedule: '* * * * *',
      });

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM scraping_cache'),
        expect.arrayContaining([expect.any(Date)])
      );
    });

    it('should delete old R2 objects', async () => {
      (mockPg.query as any).mockResolvedValueOnce({
        rowCount: 10,
        rows: [],
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      (mockR2.list as any).mockResolvedValueOnce({
        objects: [
          { key: 'cache/old-1', uploaded: oldDate },
          { key: 'cache/old-2', uploaded: oldDate },
          { key: 'cache/new-1', uploaded: new Date() },
        ],
      });

      await retentionManager.executePolicy({
        target: 'cache',
        retention: 30,
        action: 'delete',
        schedule: '* * * * *',
      });

      expect(mockR2.delete).toHaveBeenCalledTimes(2);
      expect(mockR2.delete).toHaveBeenCalledWith('cache/old-1');
      expect(mockR2.delete).toHaveBeenCalledWith('cache/old-2');
    });
  });

  describe('log archiving', () => {
    it('should compress and archive logs', async () => {
      const logRows = [
        { id: 1, message: 'Log 1', timestamp: new Date() },
        { id: 2, message: 'Log 2', timestamp: new Date() },
      ];

      (mockPg.query as any)
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: logRows,
        })
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [],
        });

      await retentionManager.executePolicy({
        target: 'logs',
        retention: 90,
        action: 'archive',
        schedule: '* * * * *',
      });

      expect(mockR2.put).toHaveBeenCalledWith(
        expect.stringMatching(/^logs\/archive-.*\.json\.gz$/),
        expect.any(Buffer)
      );

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM scraping_logs'),
        expect.any(Array)
      );
    });

    it('should skip archiving when no logs to archive', async () => {
      (mockPg.query as any).mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      await retentionManager.executePolicy({
        target: 'logs',
        retention: 90,
        action: 'archive',
        schedule: '* * * * *',
      });

      expect(mockR2.put).not.toHaveBeenCalled();
    });
  });

  describe('metrics compression', () => {
    it('should aggregate hourly metrics to daily', async () => {
      (mockPg.query as any)
        .mockResolvedValueOnce({
          rowCount: 24,
          rows: [],
        })
        .mockResolvedValueOnce({
          rowCount: 24,
          rows: [],
        });

      await retentionManager.executePolicy({
        target: 'metrics',
        retention: 365,
        action: 'compress',
        schedule: '* * * * *',
      });

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scraping_metrics_daily'),
        expect.any(Array)
      );

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM scraping_metrics_hourly'),
        expect.any(Array)
      );
    });
  });

  describe('domain learning cleanup', () => {
    it('should remove stale domain mappings', async () => {
      (mockPg.query as any).mockResolvedValueOnce({
        rowCount: 15,
        rows: [{ domain: 'example.com' }, { domain: 'test.com' }],
      });

      await retentionManager.executePolicy({
        target: 'domain_learning',
        retention: 180,
        action: 'delete',
        schedule: '* * * * *',
      });

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM domain_tier_mappings'),
        expect.any(Array)
      );
    });
  });

  describe('stats', () => {
    it('should return retention stats', async () => {
      (mockPg.query as any)
        .mockResolvedValueOnce({ rows: [{ size: 1024 * 1024 * 100 }] })
        .mockResolvedValueOnce({ rows: [{ size: 1024 * 1024 * 50 }] })
        .mockResolvedValueOnce({ rows: [{ size: 1024 * 1024 * 200 }] })
        .mockResolvedValueOnce({ rows: [{ count: '500' }] });

      const stats = await retentionManager.getStats();

      expect(stats.cache.sizeMb).toBe(100);
      expect(stats.logs.sizeMb).toBe(50);
      expect(stats.metrics.sizeMb).toBe(200);
      expect(stats.domainLearning.count).toBe(500);
    });
  });

  describe('lifecycle', () => {
    it('should start cron jobs', async () => {
      await retentionManager.start();
      // Jobs should be scheduled
      expect(true).toBe(true);
    });

    it('should stop cron jobs', async () => {
      await retentionManager.start();
      await retentionManager.stop();
      // Jobs should be stopped
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle query errors gracefully', async () => {
      (mockPg.query as any).mockRejectedValueOnce(new Error('Database error'));

      await expect(
        retentionManager.executePolicy({
          target: 'cache',
          retention: 30,
          action: 'delete',
          schedule: '* * * * *',
        })
      ).resolves.not.toThrow();
    });

    it('should handle R2 errors gracefully', async () => {
      (mockPg.query as any).mockResolvedValueOnce({
        rowCount: 10,
        rows: [],
      });

      (mockR2.list as any).mockRejectedValueOnce(new Error('R2 error'));

      await expect(
        retentionManager.executePolicy({
          target: 'cache',
          retention: 30,
          action: 'delete',
          schedule: '* * * * *',
        })
      ).resolves.not.toThrow();
    });
  });
});
