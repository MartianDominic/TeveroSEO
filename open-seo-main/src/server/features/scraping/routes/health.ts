// @ts-expect-error - express may not be installed yet
import { Router, type Request, type Response } from 'express';
import type { ScrapingService } from '../ScrapingService';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components?: Array<{ name: string; status: string; latency_ms?: number }>;
  error?: string;
}

export interface StatusResult {
  health: HealthCheckResult;
  metrics: {
    requestsToday: number;
    errorRate: number;
    cacheHitRate: number;
    p95Latency: number;
  };
  circuits: any;
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

  // Basic health check (for load balancers)
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await scrapingService.healthCheck();

      const status =
        health.components && health.components.every((c) => c.status === 'up')
          ? 'healthy'
          : health.components && health.components.some((c) => c.status === 'up')
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

  // Detailed status (for debugging)
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const [health, metrics, circuits, queue] = await Promise.all([
        scrapingService.healthCheck(),
        scrapingService.getMetrics(),
        scrapingService.getCircuitStates?.() || {},
        scrapingService.getQueueStats?.() || {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
        },
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
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await scrapingService.getPrometheusMetrics?.();
      res.set('Content-Type', 'text/plain');
      res.send(metrics || '# No metrics available\n');
    } catch (error) {
      res.status(500).send('# Error generating metrics\n');
    }
  });

  // Cost report
  router.get('/cost-report', async (req: Request, res: Response) => {
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
  router.get('/circuits', async (req: Request, res: Response) => {
    try {
      const circuits = await scrapingService.getCircuitStates?.();
      res.json(circuits || {});
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Manual circuit control (protected by requireAdmin middleware)
  router.post('/circuits/:tier/close', async (req: Request, res: Response) => {
    try {
      await scrapingService.forceCloseCircuit?.(req.params.tier);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/circuits/:tier/open', async (req: Request, res: Response) => {
    try {
      await scrapingService.forceOpenCircuit?.(req.params.tier);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Queue management
  router.get('/queue/stats', async (req: Request, res: Response) => {
    try {
      const stats = await scrapingService.getQueueStats?.();
      res.json(stats || { waiting: 0, active: 0, completed: 0, failed: 0 });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/queue/drain', async (req: Request, res: Response) => {
    try {
      const { older_than } = req.query;
      const count = await scrapingService.drainQueue?.(
        older_than ? parseInt(older_than as string) : undefined
      );
      res.json({ drained: count || 0 });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Cache management
  router.get('/cache/stats', async (req: Request, res: Response) => {
    try {
      const stats = await scrapingService.getCacheStats?.();
      res.json(stats || {});
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/cache/warm', async (req: Request, res: Response) => {
    try {
      const { domains } = req.body;
      await scrapingService.warmCache?.(domains);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/cache/invalidate', async (req: Request, res: Response) => {
    try {
      const { pattern } = req.body;
      const count = (await scrapingService.invalidateCache?.(pattern)) ?? 0;
      res.json({ invalidated: count });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Emergency controls
  router.post('/emergency-stop', async (req: Request, res: Response) => {
    try {
      await scrapingService.emergencyStop?.();
      res.json({ success: true, message: 'All scraping stopped' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/resume', async (req: Request, res: Response) => {
    try {
      await scrapingService.resume?.();
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
