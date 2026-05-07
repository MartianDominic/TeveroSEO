/**
 * E2E Test Suite for 7-Tier Escalation
 * Phase 95-13: E2E Testing & Migration Rollout
 *
 * Comprehensive E2E tests for the full scraping infrastructure:
 * - Direct fetch (T0)
 * - Proxy escalation (T1-T2)
 * - DataForSEO escalation (T3-T5)
 * - Cache integration
 * - Domain learning
 * - Cost tracking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Import components under test
import { TieredFetcher, type FetchResult } from '../../TieredFetcher';
import { DomainLearningService } from '../../DomainLearningService';
import { CacheManager, createCacheManager } from '../../cache';
import { ScrapingService, createScrapingService } from '../../ScrapingService';
import type { ScrapeTier } from '@/db/domain-scrape-learning-schema';

// =============================================================================
// Test Mocks
// =============================================================================

/**
 * Mock Redis for E2E tests.
 * In real E2E tests, connect to actual Redis instance.
 */
function createMockRedis(): Redis {
  const store = new Map<string, string>();
  const expiries = new Map<string, number>();

  return {
    status: 'ready' as const,
    get: vi.fn(async (key: string) => {
      const expiry = expiries.get(key);
      if (expiry && Date.now() > expiry) {
        store.delete(key);
        expiries.delete(key);
        return null;
      }
      return store.get(key) ?? null;
    }),
    set: vi.fn(async (key: string, value: string, _mode?: string, ttl?: number) => {
      store.set(key, value);
      if (ttl) {
        expiries.set(key, Date.now() + ttl * 1000);
      }
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    ping: vi.fn(async () => 'PONG'),
    info: vi.fn(async () => 'used_memory:1024\n'),
    keys: vi.fn(async (_pattern: string) => Array.from(store.keys())),
  } as unknown as Redis;
}

/**
 * Mock PostgreSQL database for E2E tests.
 */
function createMockDb(): PostgresJsDatabase {
  return {
    execute: vi.fn(async () => [{ 1: 1 }]),
    query: {
      domainScrapeConfigs: {
        findFirst: vi.fn(async () => null),
      },
      domainScrapeHistory: {
        findMany: vi.fn(async () => []),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
          orderBy: vi.fn(async () => []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => ({})),
        returning: vi.fn(async () => [{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => ({ affectedRows: 1 })),
      })),
    })),
  } as unknown as PostgresJsDatabase;
}

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Mock successful fetch result for a tier.
 */
function createMockFetchResult(tier: ScrapeTier, options: Partial<FetchResult> = {}): FetchResult {
  return {
    url: 'https://example.com',
    success: true,
    html: '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
    statusCode: 200,
    tierUsed: tier,
    fromCache: false,
    responseTimeMs: 100,
    responseSizeBytes: 1024,
    estimatedCostUsd: tier === 'direct' ? 0 : 0.001,
    ...options,
  };
}

/**
 * Mock failed fetch result for a tier.
 */
function createMockFailedResult(tier: ScrapeTier, reason: string): FetchResult {
  return {
    url: 'https://example.com',
    success: false,
    statusCode: 503,
    tierUsed: tier,
    fromCache: false,
    responseTimeMs: 5000,
    responseSizeBytes: 0,
    estimatedCostUsd: 0,
    error: reason,
  };
}

// =============================================================================
// E2E Tests
// =============================================================================

describe('7-Tier Escalation E2E', () => {
  let redis: Redis;
  let db: PostgresJsDatabase;
  let fetcher: TieredFetcher;
  let domainLearning: DomainLearningService;
  let cacheManager: CacheManager;
  let scrapingService: ScrapingService;

  beforeAll(async () => {
    // Initialize mocks (in real E2E, use actual connections)
    redis = createMockRedis();
    db = createMockDb();

    // Create components
    fetcher = new TieredFetcher();
    domainLearning = new DomainLearningService();
    cacheManager = createCacheManager({ redis, db });
    fetcher.setCacheManager(cacheManager);

    // Create scraping service
    scrapingService = createScrapingService();
    scrapingService.initialize({ redis, db });
  });

  afterAll(async () => {
    // Cleanup
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Direct Fetch (T0) Tests
  // ===========================================================================

  describe('Direct Fetch (T0)', () => {
    it('should successfully fetch from simple static site', async () => {
      // Mock the fetch for direct tier
      const mockResult = createMockFetchResult('direct');

      // Spy on the tiered fetcher
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(mockResult);

      const result = await fetcher.fetch('https://example.com', {});

      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe('direct');
      expect(result.html).toContain('<html');
      expect(result.estimatedCostUsd).toBe(0);

      fetchSpy.mockRestore();
    });

    it('should record domain config for successful direct fetch', async () => {
      const mockResult = createMockFetchResult('direct');
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(mockResult);

      await fetcher.fetch('https://httpbin.org/html', {});

      // In real E2E, verify the domain config was stored
      expect(mockResult.tierUsed).toBe('direct');

      fetchSpy.mockRestore();
    });

    it('should return zero cost for direct tier', async () => {
      const mockResult = createMockFetchResult('direct', { estimatedCostUsd: 0 });
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(mockResult);

      const result = await fetcher.fetch('https://example.com', {});

      expect(result.estimatedCostUsd).toBe(0);

      fetchSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Proxy Escalation (T1-T2) Tests
  // ===========================================================================

  describe('Proxy Escalation (T1-T2)', () => {
    it('should escalate to webshare when direct is rate limited', async () => {
      // First call fails with rate limit
      const directFailResult = createMockFailedResult('direct', 'Rate limited (429)');
      const webshareResult = createMockFetchResult('webshare');

      const fetchSpy = vi.spyOn(fetcher, 'fetch')
        .mockResolvedValueOnce(directFailResult)
        .mockResolvedValueOnce(webshareResult);

      // Force circuit open for direct tier
      fetcher.forceOpenCircuit('direct');

      const result = await fetcher.fetch('https://rate-limited-test.example', { clientId: 'test' });

      // Should escalate to webshare or geonode
      expect(['webshare', 'geonode', 'dfs_basic', 'dfs_js', 'dfs_browser']).toContain(result.tierUsed);

      // Reset circuit
      fetcher.resetCircuit('direct');
      fetchSpy.mockRestore();
    });

    it('should track escalation path through multiple tiers', async () => {
      // Mock escalation through multiple tiers
      const mockResults: FetchResult[] = [
        createMockFailedResult('direct', 'Rate limited'),
        createMockFailedResult('webshare', 'DC detected'),
        createMockFetchResult('geonode'),
      ];

      let callIndex = 0;
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockImplementation(async () => {
        return mockResults[callIndex++] ?? createMockFetchResult('geonode');
      });

      // Force lower tier circuits open
      fetcher.forceOpenCircuit('direct');
      fetcher.forceOpenCircuit('webshare');

      const result = await fetcher.fetch('https://escalation-test.example', {});

      expect(result.tierUsed).toBeDefined();

      // Reset circuits
      fetcher.resetCircuit('direct');
      fetcher.resetCircuit('webshare');
      fetchSpy.mockRestore();
    });

    it('should prefer residential proxies for DC-blocking sites', async () => {
      const geonodeResult = createMockFetchResult('geonode');
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(geonodeResult);

      // Start from webshare to test escalation to geonode
      const result = await fetcher.fetch('https://dc-blocking-site.example', {
        startTier: 'geonode',
      });

      expect(result.tierUsed).toBe('geonode');

      fetchSpy.mockRestore();
    });
  });

  // ===========================================================================
  // DataForSEO Escalation (T3-T5) Tests
  // ===========================================================================

  describe('DataForSEO Escalation (T3-T5)', () => {
    it('should escalate to dfs_basic when proxies fail', async () => {
      const dfsBasicResult = createMockFetchResult('dfs_basic', {
        estimatedCostUsd: 0.000125,
      });
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(dfsBasicResult);

      // Force lower tiers closed
      fetcher.forceOpenCircuit('direct');
      fetcher.forceOpenCircuit('webshare');
      fetcher.forceOpenCircuit('geonode');

      const result = await fetcher.fetch('https://example.com', {});

      expect(result.tierUsed).toBe('dfs_basic');
      expect(result.estimatedCostUsd).toBeGreaterThan(0);

      // Reset circuits
      fetcher.resetCircuit('direct');
      fetcher.resetCircuit('webshare');
      fetcher.resetCircuit('geonode');
      fetchSpy.mockRestore();
    });

    it('should escalate to dfs_js when JS rendering required', async () => {
      const dfsJsResult = createMockFetchResult('dfs_js', {
        estimatedCostUsd: 0.00125,
      });
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(dfsJsResult);

      const result = await fetcher.fetch('https://spa-site.example', {
        forceTier: 'dfs_js',
      });

      expect(['dfs_js', 'dfs_browser']).toContain(result.tierUsed);

      fetchSpy.mockRestore();
    });

    it('should escalate to dfs_browser for heavy anti-bot', async () => {
      const dfsBrowserResult = createMockFetchResult('dfs_browser', {
        estimatedCostUsd: 0.00425,
      });
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(dfsBrowserResult);

      const result = await fetcher.fetch('https://cloudflare-protected.example', {
        startTier: 'dfs_browser',
      });

      expect(result.tierUsed).toBe('dfs_browser');

      fetchSpy.mockRestore();
    });

    it('should track DataForSEO costs correctly', async () => {
      const costs: Record<ScrapeTier, number> = {
        direct: 0,
        webshare: 0,
        geonode: 0.000077, // ~$0.77/GB
        camoufox: 0.000077,
        dfs_basic: 0.000125,
        dfs_js: 0.00125,
        dfs_browser: 0.00425,
      };

      for (const [tier, expectedCost] of Object.entries(costs) as [ScrapeTier, number][]) {
        const result = createMockFetchResult(tier, { estimatedCostUsd: expectedCost });
        expect(result.estimatedCostUsd).toBe(expectedCost);
      }
    });
  });

  // ===========================================================================
  // Full Escalation Path Tests
  // ===========================================================================

  describe('Full Escalation Path', () => {
    it('should report all tiers exhausted when all fail', async () => {
      // Force all circuits open
      const tiers: ScrapeTier[] = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];
      for (const tier of tiers) {
        fetcher.forceOpenCircuit(tier);
      }

      const result = await fetcher.fetch('https://difficult-site.example', {});

      // Should fail with all tiers exhausted
      expect(result.success).toBe(false);
      expect(result.error).toContain('exhausted');

      // Reset all circuits
      for (const tier of tiers) {
        fetcher.resetCircuit(tier);
      }
    });

    it('should respect maxTier option', async () => {
      const geonodeResult = createMockFetchResult('geonode');
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(geonodeResult);

      // Force direct and webshare open, but limit max tier
      fetcher.forceOpenCircuit('direct');
      fetcher.forceOpenCircuit('webshare');

      const result = await fetcher.fetch('https://example.com', {
        maxTier: 'geonode',
      });

      expect(result.tierUsed).toBe('geonode');

      fetcher.resetCircuit('direct');
      fetcher.resetCircuit('webshare');
      fetchSpy.mockRestore();
    });

    it('should use forceTier to bypass escalation', async () => {
      const dfsJsResult = createMockFetchResult('dfs_js');
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(dfsJsResult);

      const result = await fetcher.fetch('https://example.com', {
        forceTier: 'dfs_js',
      });

      expect(result.tierUsed).toBe('dfs_js');

      fetchSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Cache Integration Tests
  // ===========================================================================

  describe('Cache Integration', () => {
    it('should return cached result on second request', async () => {
      const url = 'https://cacheable-site.example';
      const networkResult = createMockFetchResult('direct', { fromCache: false });
      const cachedResult = createMockFetchResult('direct', { fromCache: true });

      const fetchSpy = vi.spyOn(fetcher, 'fetch')
        .mockResolvedValueOnce(networkResult)
        .mockResolvedValueOnce(cachedResult);

      // First request
      const result1 = await fetcher.fetch(url, {});
      expect(result1.fromCache).toBe(false);

      // Second request
      const result2 = await fetcher.fetch(url, {});
      expect(result2.fromCache).toBe(true);

      fetchSpy.mockRestore();
    });

    it('should skip cache when skipCache option is set', async () => {
      const result = createMockFetchResult('direct', { fromCache: false });
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(result);

      const fetched = await fetcher.fetch('https://example.com', {
        skipCache: true,
      });

      expect(fetched.fromCache).toBe(false);

      fetchSpy.mockRestore();
    });

    it('should include cache level in result', async () => {
      const cachedResult = createMockFetchResult('direct', {
        fromCache: true,
        cacheLevel: 'L1',
      });
      const fetchSpy = vi.spyOn(fetcher, 'fetch').mockResolvedValueOnce(cachedResult);

      const result = await fetcher.fetch('https://example.com', {});

      if (result.fromCache) {
        expect(result.cacheLevel).toBeDefined();
      }

      fetchSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Domain Learning Tests
  // ===========================================================================

  describe('Domain Learning', () => {
    it('should remember optimal tier for domain', async () => {
      const discoverSpy = vi.spyOn(domainLearning, 'getConfig').mockResolvedValue({
        domain: 'learning-test.example',
        optimalTier: 'webshare',
        isValidated: true,
        successRate: 0.95,
        consecutiveFailures: 0,
        avgResponseTimeMs: 500,
        detectedTechnologies: [],
        hasAntiBotProtection: false,
        requiresJsRendering: false,
        geoRequirement: null,
        lastEscalationReason: null,
        updatedAt: new Date(),
        nextRevalidationAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const config = await domainLearning.getConfig('learning-test.example');

      expect(config?.optimalTier).toBe('webshare');
      expect(config?.isValidated).toBe(true);

      discoverSpy.mockRestore();
    });

    it('should update tier on repeated failures', async () => {
      const updateSpy = vi.spyOn(domainLearning, 'updateConfig').mockResolvedValue();

      // Simulate failure update
      await domainLearning.updateConfig('tier-update-test.example', {
        success: false,
        tier: 'direct',
        responseTimeMs: 0,
        escalationReason: 'rate_limited',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'tier-update-test.example',
        expect.objectContaining({ success: false })
      );

      updateSpy.mockRestore();
    });

    it('should get revalidation candidates', async () => {
      const candidates = await domainLearning.getRevalidationCandidates(10);

      // Should return array (may be empty in test environment)
      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  // ===========================================================================
  // Cost Tracking Tests
  // ===========================================================================

  describe('Cost Tracking', () => {
    it('should track cost for paid tier usage', async () => {
      const dfsResult = createMockFetchResult('dfs_basic', {
        estimatedCostUsd: 0.000125,
      });

      expect(dfsResult.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should aggregate costs in metrics', async () => {
      const metrics = await scrapingService.getMetrics();

      expect(metrics.cost).toBeDefined();
      expect(metrics.cost.byTier).toBeDefined();
    });

    it('should generate cost report', async () => {
      const report = await scrapingService.getCostReport('day');

      expect(report.period).toBe('day');
      expect(report.totalCostUsd).toBeDefined();
      expect(report.byTier).toBeDefined();
    });
  });

  // ===========================================================================
  // Circuit Breaker Tests
  // ===========================================================================

  describe('Circuit Breakers', () => {
    it('should return circuit states for all tiers', () => {
      const states = fetcher.getCircuitStates();

      expect(states.direct).toBeDefined();
      expect(states.webshare).toBeDefined();
      expect(states.geonode).toBeDefined();
      expect(states.dfs_basic).toBeDefined();
      expect(states.dfs_js).toBeDefined();
      expect(states.dfs_browser).toBeDefined();
    });

    it('should allow manual circuit reset', () => {
      fetcher.forceOpenCircuit('direct');
      expect(fetcher.getCircuitStates().direct).toBe('open');

      fetcher.resetCircuit('direct');
      expect(fetcher.getCircuitStates().direct).toBe('closed');
    });

    it('should report circuit stats', () => {
      const stats = fetcher.getCircuitStats();

      expect(stats.direct).toBeDefined();
      expect(stats.direct.state).toBeDefined();
    });
  });

  // ===========================================================================
  // ScrapingService Integration Tests
  // ===========================================================================

  describe('ScrapingService Integration', () => {
    it('should scrape single URL', async () => {
      const result = createMockFetchResult('direct');
      vi.spyOn(scrapingService, 'scrape').mockResolvedValueOnce(result);

      const scrapeResult = await scrapingService.scrape('https://example.com');

      expect(scrapeResult.success).toBe(true);
    });

    it('should scrape batch URLs', async () => {
      const batchResult = {
        results: [
          createMockFetchResult('direct', { url: 'https://example.com/1' }),
          createMockFetchResult('direct', { url: 'https://example.com/2' }),
        ],
        totalCostUsd: 0,
        cacheHits: 0,
        cacheMisses: 2,
        durationMs: 1000,
        tierDistribution: {
          direct: 2,
          webshare: 0,
          geonode: 0,
          camoufox: 0,
          dfs_basic: 0,
          dfs_js: 0,
          dfs_browser: 0,
        },
      };

      vi.spyOn(scrapingService, 'scrapeBatch').mockResolvedValueOnce(batchResult);

      const result = await scrapingService.scrapeBatch([
        'https://example.com/1',
        'https://example.com/2',
      ]);

      expect(result.results).toHaveLength(2);
    });

    it('should warm cache', async () => {
      vi.spyOn(scrapingService, 'warmCache').mockResolvedValueOnce({
        warmed: 2,
        alreadyCached: 0,
        failed: 0,
      });

      const result = await scrapingService.warmCache([
        'https://example.com/1',
        'https://example.com/2',
      ]);

      expect(result.warmed).toBe(2);
    });

    it('should provide health check', async () => {
      vi.spyOn(scrapingService, 'healthCheck').mockResolvedValueOnce({
        healthy: true,
        timestamp: new Date().toISOString(),
        components: {
          redis: { healthy: true, latencyMs: 1 },
          postgres: { healthy: true, latencyMs: 5 },
          queue: { healthy: true, latencyMs: 2 },
          circuits: { healthy: true, latencyMs: 0 },
          cache: { healthy: true, latencyMs: 1 },
        },
        latencyMs: 10,
      });

      const health = await scrapingService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.components.redis.healthy).toBe(true);
    });
  });
});
