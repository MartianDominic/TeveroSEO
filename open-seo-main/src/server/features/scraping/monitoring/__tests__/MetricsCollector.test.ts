/**
 * MetricsCollector Tests
 * Phase 95-16: Metrics & Observability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector,
  withTiming,
  createTimer,
  recordScrapeRequest,
  recordCircuitState,
  recordDfsBudgetUsage,
} from '../MetricsCollector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    resetMetricsCollector();
    collector = new MetricsCollector();
  });

  describe('counters', () => {
    it('should increment counter', () => {
      collector.incrementCounter('test_counter');
      expect(collector.getCounter('test_counter')).toBe(1);

      collector.incrementCounter('test_counter');
      expect(collector.getCounter('test_counter')).toBe(2);
    });

    it('should increment counter with custom value', () => {
      collector.incrementCounter('test_counter', {}, 5);
      expect(collector.getCounter('test_counter')).toBe(5);
    });

    it('should handle labeled counters', () => {
      collector.incrementCounter('test_counter', { tier: 'direct', status: 'success' });
      collector.incrementCounter('test_counter', { tier: 'direct', status: 'error' });
      collector.incrementCounter('test_counter', { tier: 'dfs_basic', status: 'success' });

      expect(collector.getCounter('test_counter', { tier: 'direct', status: 'success' })).toBe(1);
      expect(collector.getCounter('test_counter', { tier: 'direct', status: 'error' })).toBe(1);
      expect(collector.getCounter('test_counter', { tier: 'dfs_basic', status: 'success' })).toBe(1);
    });

    it('should return 0 for unknown counter', () => {
      expect(collector.getCounter('unknown_counter')).toBe(0);
    });
  });

  describe('gauges', () => {
    it('should set gauge value', () => {
      collector.setGauge('test_gauge', 42);
      expect(collector.getGauge('test_gauge')).toBe(42);
    });

    it('should overwrite gauge value', () => {
      collector.setGauge('test_gauge', 42);
      collector.setGauge('test_gauge', 100);
      expect(collector.getGauge('test_gauge')).toBe(100);
    });

    it('should handle labeled gauges', () => {
      collector.setGauge('test_gauge', 1, { tier: 'direct' });
      collector.setGauge('test_gauge', 0.5, { tier: 'webshare' });

      expect(collector.getGauge('test_gauge', { tier: 'direct' })).toBe(1);
      expect(collector.getGauge('test_gauge', { tier: 'webshare' })).toBe(0.5);
    });
  });

  describe('histograms', () => {
    it('should record duration in histogram', () => {
      collector.recordDuration('test_histogram', 0.5);
      collector.recordDuration('test_histogram', 1.5);
      collector.recordDuration('test_histogram', 2.5);

      const stats = collector.getHistogramStats('test_histogram');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(3);
      expect(stats!.sum).toBe(4.5);
      expect(stats!.avg).toBeCloseTo(1.5, 5);
    });

    it('should record labeled histogram', () => {
      collector.recordDuration('test_histogram', 0.5, { tier: 'direct' });
      collector.recordDuration('test_histogram', 1.5, { tier: 'dfs_basic' });

      const directStats = collector.getHistogramStats('test_histogram', { tier: 'direct' });
      const dfsStats = collector.getHistogramStats('test_histogram', { tier: 'dfs_basic' });

      expect(directStats!.count).toBe(1);
      expect(dfsStats!.count).toBe(1);
    });

    it('should calculate percentiles', () => {
      // Add values to create a distribution
      for (let i = 0; i < 100; i++) {
        collector.recordDuration('test_histogram', i / 100);
      }

      const p50 = collector.getPercentile('test_histogram', 50);
      const p95 = collector.getPercentile('test_histogram', 95);
      const p99 = collector.getPercentile('test_histogram', 99);

      // Percentiles should be in expected ranges
      expect(p50).toBeGreaterThan(0.4);
      expect(p50).toBeLessThan(0.6);
      expect(p95).toBeGreaterThan(0.9);
      expect(p99).toBeGreaterThan(0.95);
    });

    it('should return 0 for empty histogram percentile', () => {
      expect(collector.getPercentile('empty_histogram', 50)).toBe(0);
    });
  });

  describe('toPrometheusFormat', () => {
    it('should export counters in Prometheus format', () => {
      collector.incrementCounter('scraping_requests_total', { tier: 'direct', status: 'success' }, 10);
      collector.incrementCounter('scraping_requests_total', { tier: 'direct', status: 'error' }, 2);

      const output = collector.toPrometheusFormat();
      expect(output).toContain('scraping_requests_total{status="error",tier="direct"}');
      expect(output).toContain('scraping_requests_total{status="success",tier="direct"}');
    });

    it('should export gauges in Prometheus format', () => {
      collector.setGauge('scraping_circuit_state', 0, { tier: 'direct' });
      collector.setGauge('scraping_circuit_state', 1, { tier: 'webshare' });

      const output = collector.toPrometheusFormat();
      expect(output).toContain('scraping_circuit_state{tier="direct"} 0');
      expect(output).toContain('scraping_circuit_state{tier="webshare"} 1');
    });

    it('should export histograms with buckets', () => {
      collector.recordDuration('scraping_request_duration_seconds', 0.05, { tier: 'direct' });
      collector.recordDuration('scraping_request_duration_seconds', 0.15, { tier: 'direct' });

      const output = collector.toPrometheusFormat();
      expect(output).toContain('scraping_request_duration_seconds_bucket');
      expect(output).toContain('scraping_request_duration_seconds_sum');
      expect(output).toContain('scraping_request_duration_seconds_count');
      expect(output).toContain('le="+Inf"');
    });

    it('should include HELP and TYPE comments', () => {
      collector.recordDuration('scraping_request_duration_seconds', 0.05);

      const output = collector.toPrometheusFormat();
      expect(output).toContain('# HELP scraping_request_duration_seconds');
      expect(output).toContain('# TYPE scraping_request_duration_seconds histogram');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      collector.incrementCounter('test_counter');
      collector.setGauge('test_gauge', 42);
      collector.recordDuration('test_histogram', 0.5);

      collector.reset();

      expect(collector.getCounter('test_counter')).toBe(0);
      expect(collector.getGauge('test_gauge')).toBe(0);
      expect(collector.getHistogramStats('test_histogram')).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetMetricsCollector();
      const instance1 = getMetricsCollector();
      const instance2 = getMetricsCollector();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getMetricsCollector();
      instance1.incrementCounter('test_counter');

      resetMetricsCollector();
      const instance2 = getMetricsCollector();

      expect(instance2.getCounter('test_counter')).toBe(0);
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('timing utilities', () => {
  it('should record timing with withTiming', async () => {
    resetMetricsCollector();
    const collector = getMetricsCollector();

    await withTiming(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      },
      'test_operation',
      { operation: 'test' }
    );

    const stats = collector.getHistogramStats('test_operation', { operation: 'test' });
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(1);
    expect(stats!.sum).toBeGreaterThan(0.04); // At least 40ms
  });

  it('should create manual timer', () => {
    const timer = createTimer();

    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // busy wait for 10ms
    }

    const duration = timer.stop();
    expect(duration).toBeGreaterThan(0.005); // At least 5ms
  });
});

describe('helper functions', () => {
  beforeEach(() => {
    resetMetricsCollector();
  });

  it('should record scrape request', () => {
    recordScrapeRequest({
      tier: 'direct',
      status: 'success',
      durationSeconds: 0.5,
      costUsd: 0,
      cached: false,
    });

    const collector = getMetricsCollector();
    const stats = collector.getHistogramStats('scraping_request_duration_seconds', {
      tier: 'direct',
      status: 'success',
    });
    expect(stats!.count).toBe(1);
    expect(collector.getCounter('scraping_requests_total', { tier: 'direct', status: 'success' })).toBe(1);
  });

  it('should record cache hit', () => {
    recordScrapeRequest({
      tier: 'direct',
      status: 'success',
      durationSeconds: 0.01,
      costUsd: 0,
      cached: true,
      cacheLevel: 'l1',
    });

    const collector = getMetricsCollector();
    expect(collector.getCounter('scraping_cache_hits_total', { level: 'l1' })).toBe(1);
  });

  it('should record cost', () => {
    recordScrapeRequest({
      tier: 'dfs_basic',
      status: 'success',
      durationSeconds: 0.5,
      costUsd: 0.00125,
      cached: false,
      clientId: 'client-123',
    });

    const collector = getMetricsCollector();
    expect(collector.getCounter('scraping_cost_usd_total', { tier: 'dfs_basic', client: 'client-123' })).toBe(0.00125);
  });

  it('should record circuit state', () => {
    recordCircuitState('direct', 'closed');
    recordCircuitState('webshare', 'open');
    recordCircuitState('geonode', 'half-open');

    const collector = getMetricsCollector();
    expect(collector.getGauge('scraping_circuit_state', { tier: 'direct' })).toBe(0);
    expect(collector.getGauge('scraping_circuit_state', { tier: 'webshare' })).toBe(1);
    expect(collector.getGauge('scraping_circuit_state', { tier: 'geonode' })).toBe(0.5);
  });

  it('should record DFS budget usage', () => {
    recordDfsBudgetUsage(5, 10, 2.5);

    const collector = getMetricsCollector();
    expect(collector.getGauge('scraping_dfs_budget_used_percent')).toBe(50);
    expect(collector.getCounter('scraping_dfs_savings_usd')).toBe(2.5);
  });
});
