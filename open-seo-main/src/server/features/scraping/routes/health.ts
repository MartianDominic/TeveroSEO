// @ts-expect-error - express may not be installed yet
import { Router, type Request, type Response } from 'express';
import type { ScrapingService, HealthCheckResult } from '../ScrapingService';
import { requireAdminAuth, requireAdmin, requireReadonly } from '../middleware';
import {
  expressScrapingCriticalRateLimit,
  expressScrapingResourceIntensiveRateLimit,
  expressScrapingCircuitOpsRateLimit,
} from '../../../middleware/rate-limit';

export interface StatusResult {
  health: HealthCheckResult;
  metrics: {
    requestsToday: number;
    errorRate: number;
    cacheHitRate: number;
    p95Latency: number;
  };
  circuits: Record<string, string>;
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  timestamp: string;
}

export function createHealthRoutes(scrapingService: ScrapingService): Router {
  const router = Router();

  // Liveness probe (is the process running?)
  // Always returns 200 if the server can respond
  router.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe (is the service ready to handle requests?)
  // Returns 503 if any critical component is unhealthy
  // Protected: exposes latency and component health details
  router.get('/health/ready', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const health = await scrapingService.healthCheck();

      if (health.healthy) {
        res.status(200).json({
          status: 'ready',
          timestamp: health.timestamp,
          latencyMs: health.latencyMs,
        });
      } else {
        const unhealthyComponents = Object.entries(health.components)
          .filter(([_, v]) => !v.healthy)
          .map(([k]) => k);

        res.status(503).json({
          status: 'not_ready',
          timestamp: health.timestamp,
          unhealthyComponents,
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Basic health check - legacy endpoint
  // Protected: exposes component status details
  // NOTE: Use /health/live for unauthenticated load balancer probes
  router.get('/health', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const health = await scrapingService.healthCheck();

      // Determine overall status
      const criticalComponents = ['redis', 'postgres'];
      const criticalHealthy = criticalComponents.every(
        (c) => health.components[c as keyof typeof health.components]?.healthy
      );

      const status = health.healthy
        ? 'healthy'
        : criticalHealthy
          ? 'degraded'
          : 'unhealthy';

      res.status(status === 'unhealthy' ? 503 : 200).json({
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Detailed health check (for debugging)
  // Protected: exposes full internal health state
  router.get('/health/detailed', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const health = await scrapingService.healthCheck();
      res.status(health.healthy ? 200 : 503).json(health);
    } catch (error) {
      res.status(500).json({
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Detailed status (for debugging)
  // Protected: exposes metrics, circuit states, queue stats
  router.get('/status', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const [health, metrics, circuits, queue] = await Promise.all([
        scrapingService.healthCheck(),
        scrapingService.getMetrics(),
        Promise.resolve(scrapingService.getCircuitStates()),
        scrapingService.getQueueStats(),
      ]);

      res.json({
        health,
        metrics: {
          requestsToday: metrics.performance.requestsTotal || 0,
          errorRate: Object.values(metrics.performance.errorsByType).reduce((a, b) => a + b, 0) / Math.max(metrics.performance.requestsTotal, 1) || 0,
          cacheHitRate: metrics.cache.totalHitRate || 0,
          p95Latency: metrics.performance.latencyP95Ms || 0,
        },
        circuits,
        queue: {
          waiting: queue.waiting,
          active: queue.active,
          completed: queue.completed,
          failed: queue.failed,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Prometheus metrics
  // Protected: exposes detailed performance and error metrics
  router.get('/metrics', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const metrics = await scrapingService.getPrometheusMetrics();
      res.set('Content-Type', scrapingService.getMetricsContentType());
      res.send(metrics);
    } catch (error) {
      res.status(500).send(`# Error generating metrics: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  });

  // Cost report
  // Protected: exposes cost and usage data
  router.get('/cost-report', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;
      const report = await scrapingService.getCostReport({
        start: start ? new Date(start as string) : undefined,
        end: end ? new Date(end as string) : undefined,
      });
      res.json(report);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Circuit breaker status
  // Protected: exposes circuit breaker internal state
  router.get('/health/circuits', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const states = scrapingService.getCircuitStates();
      const openCircuits = Object.entries(states)
        .filter(([_, state]) => state === 'open')
        .map(([tier]) => tier);

      res.status(openCircuits.length > 3 ? 503 : 200).json({
        states,
        openCircuits,
        openCount: openCircuits.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Legacy circuits endpoint
  // Protected: exposes circuit breaker state
  router.get('/circuits', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const states = scrapingService.getCircuitStates();
      res.json(states);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Reset circuit breaker (admin only)
  // Rate limit: 5 req/min (circuit operations)
  router.post('/health/circuits/:tier/reset', expressScrapingCircuitOpsRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    const { tier } = req.params;

    try {
      scrapingService.forceCloseCircuit(tier);
      res.status(200).json({
        message: `Circuit ${tier} reset`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Manual circuit control (protected by requireAdminAuth + requireAdmin middleware)
  // Rate limit: 5 req/min (circuit operations)
  router.post('/circuits/:tier/close', expressScrapingCircuitOpsRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      scrapingService.forceCloseCircuit(req.params.tier);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Rate limit: 5 req/min (circuit operations)
  router.post('/circuits/:tier/open', expressScrapingCircuitOpsRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      scrapingService.forceOpenCircuit(req.params.tier);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Queue health endpoint
  // Protected: exposes queue statistics and health status
  router.get('/health/queues', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const stats = await scrapingService.getQueueStats();
      const healthy = stats.failed < 100 && stats.waiting < 1000;

      res.status(healthy ? 200 : 503).json({
        ...stats,
        healthy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Queue management
  // Protected: exposes queue statistics
  router.get('/queue/stats', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const stats = await scrapingService.getQueueStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Rate limit: 10 req/min (resource intensive)
  router.post('/queue/drain', expressScrapingResourceIntensiveRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { older_than } = req.query;
      const count = await scrapingService.drainQueue(
        older_than ? parseInt(older_than as string) : undefined
      );
      res.json({ drained: count });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Cache management
  // Protected: exposes cache statistics
  router.get('/cache/stats', requireAdminAuth, requireReadonly, async (req: Request, res: Response) => {
    try {
      const stats = scrapingService.getCacheStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Rate limit: 10 req/min (resource intensive)
  router.post('/cache/warm', expressScrapingResourceIntensiveRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { urls } = req.body;
      if (!Array.isArray(urls)) {
        res.status(400).json({ error: 'urls must be an array' });
        return;
      }
      const result = await scrapingService.warmCache(urls);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Rate limit: 10 req/min (resource intensive)
  router.post('/cache/invalidate', expressScrapingResourceIntensiveRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { pattern } = req.body;
      if (!pattern || typeof pattern !== 'string') {
        res.status(400).json({ error: 'pattern must be a string' });
        return;
      }
      const count = await scrapingService.invalidateCache(pattern);
      res.json({ invalidated: count });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Emergency controls
  // Rate limit: 2 req/min (critical operation)
  router.post('/emergency-stop', expressScrapingCriticalRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await scrapingService.emergencyStop();
      res.json({ success: true, message: 'All scraping stopped' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Rate limit: 2 req/min (critical operation)
  router.post('/resume', expressScrapingCriticalRateLimit, requireAdminAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await scrapingService.resume();
      res.json({ success: true, message: 'Scraping resumed' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
