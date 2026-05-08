/**
 * BandwidthTracker Tests
 * Phase 95-18: Resilience Hardening
 *
 * Tests for proxy bandwidth tracking, alert deduplication, and Prometheus metrics.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BandwidthTracker,
  getBandwidthTracker,
  resetBandwidthTracker,
  createBandwidthTracker,
} from '../BandwidthTracker';
import { resetMetricsCollector, getMetricsCollector } from '../MetricsCollector';

// =============================================================================
// Mocks
// =============================================================================

// Mock Redis
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisIncrby = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisDel = vi.fn();

vi.mock('@/server/lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    incrby: (...args: unknown[]) => mockRedisIncrby(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
  REDIS_SERVICE_PREFIX: 'openseo:',
}));

// Mock logger - use the path relative to BandwidthTracker.ts
vi.mock('@/server/features/scraping/logging', () => ({
  createComponentLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock MetricsCollector getMetricsCollector
vi.mock('../MetricsCollector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../MetricsCollector')>();
  return {
    ...actual,
    getMetricsCollector: vi.fn(() => ({
      addCounter: vi.fn(),
      setGauge: vi.fn(),
      incrementCounter: vi.fn(),
    })),
  };
});

// =============================================================================
// Test Constants
// =============================================================================

const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;

// =============================================================================
// Helper Functions
// =============================================================================

function createTestTracker(config?: Parameters<typeof createBandwidthTracker>[0]): BandwidthTracker {
  return createBandwidthTracker({
    geonode: {
      limitBytes: 10 * BYTES_PER_GB, // 10GB
      costPerGb: 0.77,
      warningThresholdPercent: 75,
      criticalThresholdPercent: 90,
      ...config?.geonode,
    },
    webshare: {
      limitBytes: 50 * BYTES_PER_GB, // 50GB
      costPerGb: 0.10,
      warningThresholdPercent: 75,
      criticalThresholdPercent: 90,
      ...config?.webshare,
    },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('BandwidthTracker', () => {
  let tracker: BandwidthTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    resetBandwidthTracker();
    resetMetricsCollector();

    // Default mock responses
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisIncrby.mockResolvedValue(0);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisDel.mockResolvedValue(1);

    tracker = createTestTracker();
  });

  describe('recordUsage', () => {
    it('should record bandwidth usage for a provider', async () => {
      const requestBytes = 1024; // 1KB request
      const responseBytes = BYTES_PER_MB; // 1MB response
      const totalBytes = requestBytes + responseBytes;

      mockRedisIncrby.mockResolvedValue(totalBytes);

      await tracker.recordUsage('geonode', requestBytes, responseBytes);

      expect(mockRedisIncrby).toHaveBeenCalledWith(
        expect.stringContaining('bandwidth:geonode:'),
        totalBytes
      );
    });

    it('should accumulate bandwidth across multiple calls', async () => {
      const firstCall = 500 * 1024; // 500KB
      const secondCall = 500 * 1024; // 500KB

      mockRedisIncrby
        .mockResolvedValueOnce(firstCall)
        .mockResolvedValueOnce(firstCall + secondCall);

      await tracker.recordUsage('webshare', 0, firstCall);
      await tracker.recordUsage('webshare', 0, secondCall);

      expect(mockRedisIncrby).toHaveBeenCalledTimes(2);
    });

    it('should set TTL on first usage of the month', async () => {
      const totalBytes = BYTES_PER_MB;
      mockRedisIncrby.mockResolvedValue(totalBytes); // Same as input = first usage

      await tracker.recordUsage('geonode', 0, totalBytes);

      // TTL should be set to 35 days
      expect(mockRedisExpire).toHaveBeenCalledWith(
        expect.stringContaining('bandwidth:geonode:'),
        35 * 24 * 60 * 60
      );
    });

    it('should not set TTL on subsequent usage', async () => {
      const totalBytes = BYTES_PER_MB;
      const existingBytes = 5 * BYTES_PER_MB;
      mockRedisIncrby.mockResolvedValue(existingBytes + totalBytes); // Different from input

      await tracker.recordUsage('geonode', 0, totalBytes);

      // TTL should not be set again
      expect(mockRedisExpire).not.toHaveBeenCalled();
    });

    it('should update Prometheus metrics on usage', async () => {
      const mockMetrics = {
        addCounter: vi.fn(),
        setGauge: vi.fn(),
        incrementCounter: vi.fn(),
      };
      vi.mocked(getMetricsCollector).mockReturnValue(mockMetrics as unknown as ReturnType<typeof getMetricsCollector>);

      const totalBytes = BYTES_PER_MB;
      mockRedisIncrby.mockResolvedValue(totalBytes);

      await tracker.recordUsage('geonode', 0, totalBytes);

      expect(mockMetrics.addCounter).toHaveBeenCalledWith(
        'scraping_proxy_bandwidth_bytes',
        totalBytes,
        { provider: 'geonode' }
      );
      expect(mockMetrics.setGauge).toHaveBeenCalledWith(
        'scraping_proxy_bandwidth_cost_usd',
        expect.any(Number),
        { provider: 'geonode' }
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisIncrby.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw
      await expect(tracker.recordUsage('geonode', 0, BYTES_PER_MB)).resolves.not.toThrow();
    });
  });

  describe('getUsage', () => {
    it('should return current usage for a provider', async () => {
      const usedBytes = 5 * BYTES_PER_GB;
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const usage = await tracker.getUsage('geonode');

      expect(usage).toBe(usedBytes);
    });

    it('should return 0 when no usage recorded', async () => {
      mockRedisGet.mockResolvedValue(null);

      const usage = await tracker.getUsage('webshare');

      expect(usage).toBe(0);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection failed'));

      const usage = await tracker.getUsage('geonode');

      expect(usage).toBe(0);
    });
  });

  describe('getRemainingBandwidth', () => {
    it('should return remaining bandwidth for a provider', async () => {
      const usedBytes = 2 * BYTES_PER_GB;
      const limitBytes = 10 * BYTES_PER_GB;
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const remaining = await tracker.getRemainingBandwidth('geonode');

      expect(remaining).toBe(limitBytes - usedBytes);
    });

    it('should return 0 when quota is exhausted', async () => {
      const usedBytes = 15 * BYTES_PER_GB; // Over limit
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const remaining = await tracker.getRemainingBandwidth('geonode');

      expect(remaining).toBe(0);
    });
  });

  describe('hasBandwidthRemaining', () => {
    it('should return true when bandwidth is available', async () => {
      mockRedisGet.mockResolvedValue(String(5 * BYTES_PER_GB));

      const hasRemaining = await tracker.hasBandwidthRemaining('geonode');

      expect(hasRemaining).toBe(true);
    });

    it('should return false when bandwidth is exhausted', async () => {
      mockRedisGet.mockResolvedValue(String(15 * BYTES_PER_GB)); // Over 10GB limit

      const hasRemaining = await tracker.hasBandwidthRemaining('geonode');

      expect(hasRemaining).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return full bandwidth status for a provider', async () => {
      const usedBytes = 5 * BYTES_PER_GB; // 50% of 10GB
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const status = await tracker.getStatus('geonode');

      expect(status).toMatchObject({
        provider: 'geonode',
        usedBytes,
        limitBytes: 10 * BYTES_PER_GB,
        remainingBytes: 5 * BYTES_PER_GB,
        percentUsed: 50,
        isExhausted: false,
        isWarning: false,
        isCritical: false,
      });
      expect(status.estimatedCostUsd).toBeCloseTo(5 * 0.77, 2);
      expect(status.month).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should indicate warning when threshold reached', async () => {
      const usedBytes = 8 * BYTES_PER_GB; // 80% of 10GB
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const status = await tracker.getStatus('geonode');

      expect(status.isWarning).toBe(true);
      expect(status.isCritical).toBe(false);
      expect(status.percentUsed).toBe(80);
    });

    it('should indicate critical when threshold reached', async () => {
      const usedBytes = 9.5 * BYTES_PER_GB; // 95% of 10GB
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const status = await tracker.getStatus('geonode');

      expect(status.isWarning).toBe(true); // Also warning (95% >= 75%)
      expect(status.isCritical).toBe(true);
    });

    it('should indicate exhausted when over quota', async () => {
      const usedBytes = 10 * BYTES_PER_GB; // Exactly at limit
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const status = await tracker.getStatus('geonode');

      expect(status.isExhausted).toBe(true);
      expect(status.remainingBytes).toBe(0);
    });
  });

  describe('getAllStatus', () => {
    it('should return status for all providers', async () => {
      mockRedisGet
        .mockResolvedValueOnce(String(5 * BYTES_PER_GB)) // geonode
        .mockResolvedValueOnce(String(25 * BYTES_PER_GB)); // webshare

      const allStatus = await tracker.getAllStatus();

      expect(allStatus.size).toBe(2);
      expect(allStatus.has('geonode')).toBe(true);
      expect(allStatus.has('webshare')).toBe(true);

      const geonodeStatus = allStatus.get('geonode')!;
      expect(geonodeStatus.percentUsed).toBe(50);

      const webshareStatus = allStatus.get('webshare')!;
      expect(webshareStatus.percentUsed).toBe(50);
    });
  });

  describe('alert deduplication', () => {
    it('should send warning alert only once per month', async () => {
      const mockMetrics = {
        addCounter: vi.fn(),
        setGauge: vi.fn(),
        incrementCounter: vi.fn(),
      };
      vi.mocked(getMetricsCollector).mockReturnValue(mockMetrics as unknown as ReturnType<typeof getMetricsCollector>);

      // First call at 80% - should trigger warning
      mockRedisIncrby.mockResolvedValue(8 * BYTES_PER_GB);
      mockRedisSet.mockResolvedValueOnce('OK'); // NX succeeds first time

      await tracker.recordUsage('geonode', 0, 8 * BYTES_PER_GB);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('bandwidth_alert:geonode:warning:'),
        '1',
        'EX',
        35 * 24 * 60 * 60,
        'NX'
      );
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'scraping_proxy_bandwidth_alerts_total',
        { provider: 'geonode', level: 'warning' }
      );
    });

    it('should not send duplicate warning alert in same month', async () => {
      const mockMetrics = {
        addCounter: vi.fn(),
        setGauge: vi.fn(),
        incrementCounter: vi.fn(),
      };
      vi.mocked(getMetricsCollector).mockReturnValue(mockMetrics as unknown as ReturnType<typeof getMetricsCollector>);

      // Second call at 80% - warning already sent
      mockRedisIncrby.mockResolvedValue(8 * BYTES_PER_GB);
      mockRedisSet.mockResolvedValueOnce(null); // NX fails (key exists)

      await tracker.recordUsage('geonode', 0, 1024);

      // Alert metric should not be incremented
      expect(mockMetrics.incrementCounter).not.toHaveBeenCalledWith(
        'scraping_proxy_bandwidth_alerts_total',
        expect.any(Object)
      );
    });

    it('should send different alerts for different thresholds', async () => {
      const mockMetrics = {
        addCounter: vi.fn(),
        setGauge: vi.fn(),
        incrementCounter: vi.fn(),
      };
      vi.mocked(getMetricsCollector).mockReturnValue(mockMetrics as unknown as ReturnType<typeof getMetricsCollector>);

      // First call at 80% - triggers warning
      mockRedisIncrby.mockResolvedValueOnce(8 * BYTES_PER_GB);
      mockRedisSet.mockResolvedValueOnce('OK');

      await tracker.recordUsage('geonode', 0, 8 * BYTES_PER_GB);

      // Second call at 95% - triggers critical (different key)
      mockRedisIncrby.mockResolvedValueOnce(9.5 * BYTES_PER_GB);
      mockRedisSet.mockResolvedValueOnce('OK');

      await tracker.recordUsage('geonode', 0, 1.5 * BYTES_PER_GB);

      // Both alerts should be sent
      const setCalls = mockRedisSet.mock.calls;
      const warningCall = setCalls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('warning')
      );
      const criticalCall = setCalls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('critical')
      );

      expect(warningCall).toBeDefined();
      expect(criticalCall).toBeDefined();
    });

    it('should send critical alert at 90% threshold', async () => {
      const mockMetrics = {
        addCounter: vi.fn(),
        setGauge: vi.fn(),
        incrementCounter: vi.fn(),
      };
      vi.mocked(getMetricsCollector).mockReturnValue(mockMetrics as unknown as ReturnType<typeof getMetricsCollector>);

      // 91% usage triggers critical
      mockRedisIncrby.mockResolvedValue(9.1 * BYTES_PER_GB);
      mockRedisSet.mockResolvedValue('OK');

      await tracker.recordUsage('geonode', 0, 9.1 * BYTES_PER_GB);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('bandwidth_alert:geonode:critical:'),
        '1',
        'EX',
        35 * 24 * 60 * 60,
        'NX'
      );
    });
  });

  describe('getMetrics (Prometheus export)', () => {
    it('should return metrics for both providers', async () => {
      mockRedisGet
        .mockResolvedValueOnce(String(5 * BYTES_PER_GB))
        .mockResolvedValueOnce(String(25 * BYTES_PER_GB));

      const metrics = await tracker.getMetrics();

      expect(metrics.geonode).toMatchObject({
        usedBytes: 5 * BYTES_PER_GB,
        limitBytes: 10 * BYTES_PER_GB,
        percentUsed: 50,
      });
      expect(metrics.geonode.estimatedCostUsd).toBeCloseTo(5 * 0.77, 2);

      expect(metrics.webshare).toMatchObject({
        usedBytes: 25 * BYTES_PER_GB,
        limitBytes: 50 * BYTES_PER_GB,
        percentUsed: 50,
      });
      expect(metrics.webshare.estimatedCostUsd).toBeCloseTo(25 * 0.10, 2);
    });
  });

  describe('resetUsage', () => {
    it('should reset usage for a single provider', async () => {
      await tracker.resetUsage('geonode');

      expect(mockRedisDel).toHaveBeenCalledWith(expect.stringContaining('bandwidth:geonode:'));
      expect(mockRedisDel).toHaveBeenCalledWith(expect.stringContaining('bandwidth_alert:geonode:warning:'));
      expect(mockRedisDel).toHaveBeenCalledWith(expect.stringContaining('bandwidth_alert:geonode:critical:'));
    });

    it('should reset usage for all providers', async () => {
      await tracker.resetAllUsage();

      // Should call del for both providers
      expect(mockRedisDel).toHaveBeenCalledWith(expect.stringContaining('geonode'));
      expect(mockRedisDel).toHaveBeenCalledWith(expect.stringContaining('webshare'));
      expect(mockRedisDel.mock.calls.length).toBeGreaterThanOrEqual(6); // 3 keys per provider
    });
  });

  describe('getProviderConfig', () => {
    it('should return config for a provider', () => {
      const config = tracker.getProviderConfig('geonode');

      expect(config).toMatchObject({
        limitBytes: 10 * BYTES_PER_GB,
        costPerGb: 0.77,
        warningThresholdPercent: 75,
        criticalThresholdPercent: 90,
      });
    });

    it('should return copy of config (immutable)', () => {
      const config1 = tracker.getProviderConfig('geonode');
      const config2 = tracker.getProviderConfig('geonode');

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('custom configuration', () => {
    it('should use custom limits', async () => {
      const customTracker = createBandwidthTracker({
        geonode: {
          limitBytes: 5 * BYTES_PER_GB,
          costPerGb: 0.77,
          warningThresholdPercent: 50,
          criticalThresholdPercent: 80,
        },
      });

      const config = customTracker.getProviderConfig('geonode');

      expect(config.limitBytes).toBe(5 * BYTES_PER_GB);
      expect(config.warningThresholdPercent).toBe(50);
      expect(config.criticalThresholdPercent).toBe(80);
    });

    it('should merge custom config with defaults', () => {
      const customTracker = createBandwidthTracker({
        geonode: {
          limitBytes: 20 * BYTES_PER_GB,
          costPerGb: 0.77,
          warningThresholdPercent: 75,
          criticalThresholdPercent: 90,
        },
      });

      // Geonode should have custom limit
      expect(customTracker.getProviderConfig('geonode').limitBytes).toBe(20 * BYTES_PER_GB);

      // Webshare should have default limit (50GB from env or default)
      // Note: actual default depends on env var, but should be greater than 0
      expect(customTracker.getProviderConfig('webshare').limitBytes).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance via getBandwidthTracker', () => {
      resetBandwidthTracker();
      const instance1 = getBandwidthTracker();
      const instance2 = getBandwidthTracker();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetBandwidthTracker', () => {
      const instance1 = getBandwidthTracker();
      resetBandwidthTracker();
      const instance2 = getBandwidthTracker();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('cost calculation', () => {
    it('should calculate correct cost for geonode ($0.77/GB)', async () => {
      const usedGb = 3;
      mockRedisGet.mockResolvedValue(String(usedGb * BYTES_PER_GB));

      const status = await tracker.getStatus('geonode');

      expect(status.estimatedCostUsd).toBeCloseTo(usedGb * 0.77, 2);
    });

    it('should calculate correct cost for webshare ($0.10/GB)', async () => {
      const usedGb = 20;
      mockRedisGet.mockResolvedValue(String(usedGb * BYTES_PER_GB));

      const status = await tracker.getStatus('webshare');

      expect(status.estimatedCostUsd).toBeCloseTo(usedGb * 0.10, 2);
    });

    it('should handle partial GB usage', async () => {
      const usedBytes = 1.5 * BYTES_PER_GB; // 1.5 GB
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const status = await tracker.getStatus('geonode');

      expect(status.estimatedCostUsd).toBeCloseTo(1.5 * 0.77, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero usage', async () => {
      mockRedisGet.mockResolvedValue('0');

      const status = await tracker.getStatus('geonode');

      expect(status.usedBytes).toBe(0);
      expect(status.percentUsed).toBe(0);
      expect(status.estimatedCostUsd).toBe(0);
      expect(status.isWarning).toBe(false);
      expect(status.isCritical).toBe(false);
      expect(status.isExhausted).toBe(false);
    });

    it('should handle usage exceeding limit', async () => {
      const usedBytes = 15 * BYTES_PER_GB; // 150% of 10GB limit
      mockRedisGet.mockResolvedValue(String(usedBytes));

      const status = await tracker.getStatus('geonode');

      expect(status.usedBytes).toBe(usedBytes);
      expect(status.percentUsed).toBe(150);
      expect(status.remainingBytes).toBe(0);
      expect(status.isExhausted).toBe(true);
      expect(status.isWarning).toBe(true);
      expect(status.isCritical).toBe(true);
    });

    it('should handle exactly at threshold boundaries', async () => {
      // Exactly at 75%
      mockRedisGet.mockResolvedValue(String(7.5 * BYTES_PER_GB));
      let status = await tracker.getStatus('geonode');
      expect(status.isWarning).toBe(true);
      expect(status.isCritical).toBe(false);

      // Exactly at 90%
      mockRedisGet.mockResolvedValue(String(9 * BYTES_PER_GB));
      status = await tracker.getStatus('geonode');
      expect(status.isWarning).toBe(true);
      expect(status.isCritical).toBe(true);
    });
  });
});
