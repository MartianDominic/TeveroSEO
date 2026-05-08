/**
 * Health and Monitoring Routes
 * Phase 95-11: Health & Metrics
 * Phase 95-14: Security & Authentication
 *
 * Provides health check and monitoring endpoints:
 * - GET endpoints: Public (monitoring access)
 * - POST endpoints: Require admin authentication
 */

// @ts-expect-error - express may not be installed yet
import { Router, type Request, type Response } from 'express';
import type { ScrapingService, HealthCheckResult } from '../ScrapingService';
import { requireAdminAuth } from '../middleware/adminAuth';
import { getAuditLogger, createAuditContext } from '../monitoring/AuditLogger';

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
  router.get('/health/ready', async (req: Request, res: Response) => {
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

  // Basic health check (for load balancers) - legacy endpoint
  router.get('/health', async (req: Request, res: Response) => {
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
  router.get('/health/detailed', async (req: Request, res: Response) => {
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
  router.get('/status', async (req: Request, res: Response) => {
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
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await scrapingService.getPrometheusMetrics();
      res.set('Content-Type', scrapingService.getMetricsContentType());
      res.send(metrics);
    } catch (error) {
      res.status(500).send(`# Error generating metrics: ${error instanceof Error ? error.message : 'Unknown'}\n`);
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
  router.get('/health/circuits', async (req: Request, res: Response) => {
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
  router.get('/circuits', async (req: Request, res: Response) => {
    try {
      const states = scrapingService.getCircuitStates();
      res.json(states);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Reset circuit breaker (admin only - requires authentication)
  router.post('/health/circuits/:tier/reset', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { tier } = req.params;

    try {
      scrapingService.forceCloseCircuit(tier);

      await auditLogger.log({
        action: 'circuit_reset',
        actor,
        target: { type: 'circuit', id: tier },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.status(200).json({
        message: `Circuit ${tier} reset`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'circuit_reset',
        actor,
        target: { type: 'circuit', id: tier },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Manual circuit control (requires authentication)
  router.post('/circuits/:tier/close', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { tier } = req.params;

    try {
      scrapingService.forceCloseCircuit(tier);

      await auditLogger.log({
        action: 'circuit_force_close',
        actor,
        target: { type: 'circuit', id: tier },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({ success: true });
    } catch (error) {
      await auditLogger.log({
        action: 'circuit_force_close',
        actor,
        target: { type: 'circuit', id: tier },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/circuits/:tier/open', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { tier } = req.params;

    try {
      scrapingService.forceOpenCircuit(tier);

      await auditLogger.log({
        action: 'circuit_force_open',
        actor,
        target: { type: 'circuit', id: tier },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({ success: true });
    } catch (error) {
      await auditLogger.log({
        action: 'circuit_force_open',
        actor,
        target: { type: 'circuit', id: tier },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Queue health endpoint
  router.get('/health/queues', async (req: Request, res: Response) => {
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
  router.get('/queue/stats', async (req: Request, res: Response) => {
    try {
      const stats = await scrapingService.getQueueStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/queue/drain', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { older_than } = req.query;

    try {
      const count = await scrapingService.drainQueue(
        older_than ? parseInt(older_than as string) : undefined
      );

      await auditLogger.log({
        action: 'queue_drain',
        actor,
        target: { type: 'queue', id: 'scraping' },
        parameters: { olderThan: older_than, drainedCount: count },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({ drained: count });
    } catch (error) {
      await auditLogger.log({
        action: 'queue_drain',
        actor,
        target: { type: 'queue', id: 'scraping' },
        parameters: { olderThan: older_than },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Cache management
  router.get('/cache/stats', async (req: Request, res: Response) => {
    try {
      const stats = scrapingService.getCacheStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/cache/warm', requireAdminAuth, async (req: Request, res: Response) => {
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

  router.post('/cache/invalidate', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { pattern } = req.body;

    if (!pattern || typeof pattern !== 'string') {
      res.status(400).json({ error: 'pattern must be a string' });
      return;
    }

    try {
      const count = await scrapingService.invalidateCache(pattern);

      await auditLogger.log({
        action: 'cache_invalidate',
        actor,
        target: { type: 'cache', id: pattern },
        parameters: { pattern, invalidatedCount: count },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({ invalidated: count });
    } catch (error) {
      await auditLogger.log({
        action: 'cache_invalidate',
        actor,
        target: { type: 'cache', id: pattern },
        parameters: { pattern },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Emergency controls (require authentication)
  router.post('/emergency-stop', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);

    try {
      await scrapingService.emergencyStop();

      await auditLogger.log({
        action: 'emergency_stop',
        actor,
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({ success: true, message: 'All scraping stopped' });
    } catch (error) {
      await auditLogger.log({
        action: 'emergency_stop',
        actor,
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/resume', requireAdminAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);

    try {
      await scrapingService.resume();

      await auditLogger.log({
        action: 'resume',
        actor,
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({ success: true, message: 'Scraping resumed' });
    } catch (error) {
      await auditLogger.log({
        action: 'resume',
        actor,
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
