/**
 * Admin Dashboard Routes
 * Phase 95-13: E2E Testing & Migration Rollout
 * Phase 95-14: Security & Authentication
 *
 * Provides admin endpoints for:
 * - Migration status and control
 * - Cache warming operations
 * - Domain learning feedback monitoring
 * - Operational controls
 *
 * Security:
 * - All routes require SCRAPING_ADMIN_API_KEY via X-Admin-API-Key header
 * - All actions are audit logged
 */

// @ts-expect-error - express may not be installed yet
import { Router, type Request, type Response } from 'express';
import type { ScrapingService } from '../ScrapingService';
import type { MigrationRollout, RolloutStatus, RolloutReadinessCheck } from '../migration/MigrationRollout';
import { domainLearningService } from '../DomainLearningService';
import type { CacheWarmer, WarmingResult, WarmingProgress } from '../cache/CacheWarmer';
import type { DomainFeedbackService } from '../DomainFeedback';
import type { ScrapingFeature, MigrationState } from '../config';
import { requireAdminAuth, type AdminRequest } from '../middleware/adminAuth';
import { getAuditLogger, createAuditContext, type AuditEntry } from '../monitoring/AuditLogger';

// =============================================================================
// Types
// =============================================================================

/**
 * Feature status in migration response.
 */
interface FeatureStatus {
  state: MigrationState;
  ready: boolean;
  blockers: string[];
}

/**
 * Migration status response.
 */
export interface MigrationStatusResponse {
  features: Record<string, FeatureStatus>;
  summary: {
    total: number;
    migratedCount: number;
    overallProgress: number;
  };
  lastUpdated: string;
}

/**
 * Readiness check response.
 */
export interface ReadinessResponse {
  feature: ScrapingFeature;
  currentState: MigrationState;
  ready: boolean;
  criteria: {
    met: string[];
    unmet: string[];
  };
  recommendation: string;
}

/**
 * Cache warming request body.
 */
export interface CacheWarmRequest {
  urls: string[];
  priority?: 'high' | 'normal' | 'low';
  concurrency?: number;
  clientId?: string;
}

/**
 * Audit warming request params.
 */
export interface AuditWarmParams {
  auditId: string;
}

/**
 * Feedback status response.
 */
export interface FeedbackStatusResponse {
  buffer: {
    domains: number;
    totalFeedback: number;
  };
  lastFlush?: {
    domainsProcessed: number;
    updatesApplied: number;
    timestamp: string;
  };
}

// =============================================================================
// Admin Routes Factory
// =============================================================================

/**
 * Dependencies for admin routes.
 */
export interface AdminRouteDependencies {
  scrapingService: ScrapingService;
  migrationRollout?: MigrationRollout;
  cacheWarmer?: CacheWarmer;
  feedbackService?: DomainFeedbackService;
}

/**
 * Create admin routes for scraping infrastructure.
 *
 * @example
 * ```typescript
 * import { createAdminRoutes } from './routes/admin';
 * import { scrapingService } from '../ScrapingService';
 * import { getMigrationRollout } from '../migration/MigrationRollout';
 * import { getCacheWarmer } from '../cache/CacheWarmer';
 * import { getDomainFeedbackService } from '../DomainFeedback';
 *
 * const adminRoutes = createAdminRoutes({
 *   scrapingService,
 *   migrationRollout: getMigrationRollout(),
 *   cacheWarmer: getCacheWarmer(),
 *   feedbackService: getDomainFeedbackService(),
 * });
 *
 * app.use('/admin/scraping', adminRoutes);
 * ```
 */
export function createAdminRoutes(deps: AdminRouteDependencies): Router {
  const router = Router();
  const { scrapingService, migrationRollout, cacheWarmer, feedbackService } = deps;

  // ===========================================================================
  // Authentication - All admin routes require API key
  // Phase 95-14: Security & Authentication
  // ===========================================================================
  router.use(requireAdminAuth);

  // ===========================================================================
  // Migration Status Endpoints
  // ===========================================================================

  /**
   * GET /admin/migration/status
   * Get full migration status for all features.
   */
  router.get('/migration/status', async (_req: Request, res: Response) => {
    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const status: RolloutStatus = await migrationRollout.getFullRolloutStatus();

      // Transform to response format
      const features: Record<string, FeatureStatus> = {};
      for (const [feature, data] of Object.entries(status.features)) {
        features[feature] = {
          state: data.state,
          ready: data.ready,
          blockers: data.blockers,
        };
      }

      const response: MigrationStatusResponse = {
        features,
        summary: {
          total: status.totalFeatures,
          migratedCount: status.migratedCount,
          overallProgress: status.overallProgress,
        },
        lastUpdated: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /admin/migration/:feature/ready
   * Check if a feature is ready to advance to next state.
   */
  router.get('/migration/:feature/ready', async (req: Request, res: Response) => {
    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const feature = req.params.feature as ScrapingFeature;

    try {
      const readiness: RolloutReadinessCheck = await migrationRollout.checkReadyForAdvancement(feature);

      const response: ReadinessResponse = {
        feature,
        currentState: readiness.currentState,
        ready: readiness.ready,
        criteria: {
          met: [], // Criteria that passed (not tracked individually)
          unmet: readiness.blockers,
        },
        recommendation: readiness.ready
          ? `Feature ${feature} is ready to advance from ${readiness.currentState}`
          : `Feature ${feature} has ${readiness.blockers.length} unmet criteria`,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        feature,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/migration/:feature/advance
   * Advance a feature to the next migration state.
   */
  router.post('/migration/:feature/advance', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const feature = req.params.feature as ScrapingFeature;
    const { force = false, reason } = req.body;

    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      // First check readiness unless forced
      if (!force) {
        const readiness = await migrationRollout.checkReadyForAdvancement(feature);
        if (!readiness.ready) {
          res.status(400).json({
            error: 'Feature not ready to advance',
            feature,
            currentState: readiness.currentState,
            blockers: readiness.blockers,
            hint: 'Use force=true to override (not recommended)',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const result = await migrationRollout.advanceFeature(feature);

      if (result.success) {
        await auditLogger.log({
          action: 'migration_advance',
          actor,
          target: { type: 'migration', id: feature },
          parameters: { fromState: result.previousState, toState: result.newState, forced: force, reason },
          result: 'success',
          durationMs: Date.now() - startTime,
        });

        res.json({
          success: true,
          feature,
          previousState: result.previousState,
          newState: result.newState,
          forced: force,
          reason: reason ?? 'Manual advancement via admin API',
          timestamp: new Date().toISOString(),
        });
      } else {
        await auditLogger.log({
          action: 'migration_advance',
          actor,
          target: { type: 'migration', id: feature },
          parameters: { forced: force, reason },
          result: 'failure',
          errorMessage: result.message,
          durationMs: Date.now() - startTime,
        });

        res.status(400).json({
          success: false,
          feature,
          message: result.message,
          currentState: result.previousState,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      await auditLogger.log({
        action: 'migration_advance',
        actor,
        target: { type: 'migration', id: feature },
        parameters: { forced: force, reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        feature,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/migration/:feature/rollback
   * Rollback a feature to a previous migration state.
   */
  router.post('/migration/:feature/rollback', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const feature = req.params.feature as ScrapingFeature;
    const { targetState, reason } = req.body;

    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = await migrationRollout.rollbackFeature(feature, reason);

      if (result.success) {
        await auditLogger.log({
          action: 'migration_rollback',
          actor,
          target: { type: 'migration', id: feature },
          parameters: { fromState: result.previousState, toState: result.newState, reason },
          result: 'success',
          durationMs: Date.now() - startTime,
        });

        res.json({
          success: true,
          feature,
          previousState: result.previousState,
          newState: result.newState,
          reason: reason ?? 'Manual rollback via admin API',
          timestamp: new Date().toISOString(),
        });
      } else {
        await auditLogger.log({
          action: 'migration_rollback',
          actor,
          target: { type: 'migration', id: feature },
          parameters: { reason },
          result: 'failure',
          errorMessage: result.reason,
          durationMs: Date.now() - startTime,
        });

        res.status(400).json({
          success: false,
          feature,
          reason: result.reason,
          currentState: result.previousState,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      await auditLogger.log({
        action: 'migration_rollback',
        actor,
        target: { type: 'migration', id: feature },
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        feature,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===========================================================================
  // Cache Warming Endpoints
  // ===========================================================================

  /**
   * POST /admin/cache/warm
   * Warm cache with provided URLs.
   */
  router.post('/cache/warm', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);

    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { urls, priority = 'normal', concurrency = 10, clientId = 'admin' } = req.body as CacheWarmRequest;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        error: 'urls array is required and must not be empty',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (urls.length > 1000) {
      res.status(400).json({
        error: 'Maximum 1000 URLs per request',
        received: urls.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result: WarmingResult = await cacheWarmer.warmCache({
        urls,
        priority,
        concurrency: Math.min(concurrency, 50), // Cap concurrency
        clientId,
        onProgress: (progress: WarmingProgress) => {
          // Progress is logged server-side, not sent to client
          console.info(
            `[CacheWarmer] Progress: ${progress.warmed}/${progress.total} warmed, ` +
            `${progress.alreadyCached} cached, ${progress.failed} failed`
          );
        },
      });

      await auditLogger.log({
        action: 'cache_warm',
        actor,
        target: { type: 'cache', id: 'urls' },
        parameters: { urlCount: urls.length, priority, concurrency, clientId },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'cache_warm',
        actor,
        target: { type: 'cache', id: 'urls' },
        parameters: { urlCount: urls.length, priority, concurrency, clientId },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/cache/warm-audit/:auditId
   * Warm cache for all URLs in an audit job.
   */
  router.post('/cache/warm-audit/:auditId', async (req: Request, res: Response) => {
    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { auditId } = req.params;
    const { clientId = 'admin' } = req.body;

    if (!auditId) {
      res.status(400).json({
        error: 'auditId is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result: WarmingResult = await cacheWarmer.warmForAudit(auditId, clientId);

      res.json({
        success: true,
        auditId,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        auditId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/cache/warm-sitemap
   * Warm cache from a sitemap URL.
   */
  router.post('/cache/warm-sitemap', async (req: Request, res: Response) => {
    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { sitemapUrl, maxUrls = 1000, priority = 'low', clientId = 'admin' } = req.body;

    if (!sitemapUrl || typeof sitemapUrl !== 'string') {
      res.status(400).json({
        error: 'sitemapUrl is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result: WarmingResult = await cacheWarmer.warmFromSitemap(sitemapUrl, clientId, {
        maxUrls: Math.min(maxUrls, 5000), // Cap at 5000 URLs
        priority,
      });

      res.json({
        success: true,
        sitemapUrl,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        sitemapUrl,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/cache/warm-domain
   * Intelligent cache warming for a domain.
   */
  router.post('/cache/warm-domain', async (req: Request, res: Response) => {
    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { domain, clientId = 'admin', topPages, recentlyUpdated } = req.body;

    if (!domain || typeof domain !== 'string') {
      res.status(400).json({
        error: 'domain is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result: WarmingResult = await cacheWarmer.warmIntelligent(domain, clientId, {
        topPages,
        recentlyUpdated,
      });

      res.json({
        success: true,
        domain,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        domain,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===========================================================================
  // Domain Feedback Endpoints
  // ===========================================================================

  /**
   * GET /admin/feedback/status
   * Get current feedback buffer status.
   */
  router.get('/feedback/status', (_req: Request, res: Response) => {
    if (!feedbackService) {
      res.status(503).json({
        error: 'Feedback service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const bufferSize = feedbackService.getBufferSize();

      const response: FeedbackStatusResponse = {
        buffer: bufferSize,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/feedback/flush
   * Manually flush feedback buffer.
   */
  router.post('/feedback/flush', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);

    if (!feedbackService) {
      res.status(503).json({
        error: 'Feedback service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = await feedbackService.flush();

      await auditLogger.log({
        action: 'feedback_flush',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'feedback_flush',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/feedback/clear
   * Clear feedback buffer without processing.
   */
  router.post('/feedback/clear', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);

    if (!feedbackService) {
      res.status(503).json({
        error: 'Feedback service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const beforeSize = feedbackService.getBufferSize();
      feedbackService.clearBuffer();
      const afterSize = feedbackService.getBufferSize();

      await auditLogger.log({
        action: 'feedback_clear',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        parameters: { clearedDomains: beforeSize.domains, clearedFeedback: beforeSize.totalFeedback },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({
        success: true,
        cleared: {
          domains: beforeSize.domains,
          feedback: beforeSize.totalFeedback,
        },
        remaining: afterSize,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'feedback_clear',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===========================================================================
  // Domain Learning Endpoints
  // ===========================================================================

  /**
   * GET /admin/domains/:domain/config
   * Get domain scrape configuration.
   */
  router.get('/domains/:domain/config', async (req: Request, res: Response) => {
    const { domain } = req.params;

    try {
      // Use domain learning service directly
      const config = await domainLearningService.getConfig(domain);

      if (!config) {
        res.status(404).json({
          error: 'Domain configuration not found',
          domain,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        domain,
        config,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        domain,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/domains/:domain/reset
   * Reset domain configuration to default (invalidate cache to trigger re-discovery).
   */
  router.post('/domains/:domain/reset', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { domain } = req.params;
    const { reason } = req.body;

    try {
      // Invalidate cache forces re-discovery on next request
      await domainLearningService.invalidateCache(domain);

      await auditLogger.log({
        action: 'domain_reset',
        actor,
        target: { type: 'domain', id: domain },
        parameters: { reason },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({
        success: true,
        domain,
        action: 'cache_invalidated',
        reason: reason ?? 'Manual reset via admin API',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'domain_reset',
        actor,
        target: { type: 'domain', id: domain },
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        domain,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===========================================================================
  // Operational Controls
  // ===========================================================================

  /**
   * GET /admin/system/status
   * Get comprehensive system status.
   */
  router.get('/system/status', async (_req: Request, res: Response) => {
    try {
      const [health, metrics, circuitStates, queueStats] = await Promise.all([
        scrapingService.healthCheck(),
        scrapingService.getMetrics(),
        Promise.resolve(scrapingService.getCircuitStates()),
        scrapingService.getQueueStats(),
      ]);

      // Get migration progress if available
      let migrationProgress = 0;
      if (migrationRollout) {
        const rolloutStatus = await migrationRollout.getFullRolloutStatus();
        migrationProgress = rolloutStatus.overallProgress;
      }

      res.json({
        health: {
          overall: health.healthy,
          components: health.components,
          latencyMs: health.latencyMs,
        },
        metrics: {
          requests: metrics.performance.requestsTotal,
          errorRate: Object.values(metrics.performance.errorsByType).reduce((a, b) => a + b, 0) /
            Math.max(metrics.performance.requestsTotal, 1),
          cacheHitRate: metrics.cache.totalHitRate,
          p95LatencyMs: metrics.performance.latencyP95Ms,
        },
        circuits: circuitStates,
        queue: queueStats,
        migration: migrationRollout ? {
          enabled: true,
          progress: migrationProgress,
        } : {
          enabled: false,
        },
        feedback: feedbackService ? {
          enabled: true,
          bufferSize: feedbackService.getBufferSize(),
        } : {
          enabled: false,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/system/emergency-stop
   * Emergency stop all scraping operations.
   */
  router.post('/system/emergency-stop', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { reason } = req.body;

    try {
      await scrapingService.emergencyStop();

      // Stop feedback service if available
      if (feedbackService) {
        feedbackService.stop();
      }

      await auditLogger.log({
        action: 'emergency_stop',
        actor,
        parameters: { reason },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({
        success: true,
        message: 'All scraping operations stopped',
        reason: reason ?? 'Emergency stop via admin API',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'emergency_stop',
        actor,
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/system/resume
   * Resume scraping operations after emergency stop.
   */
  router.post('/system/resume', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const { reason } = req.body;

    try {
      await scrapingService.resume();

      // Resume feedback service if available
      if (feedbackService) {
        feedbackService.startAutoFlush();
      }

      await auditLogger.log({
        action: 'resume',
        actor,
        parameters: { reason },
        result: 'success',
        durationMs: Date.now() - startTime,
      });

      res.json({
        success: true,
        message: 'Scraping operations resumed',
        reason: reason ?? 'Resume via admin API',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await auditLogger.log({
        action: 'resume',
        actor,
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}

// =============================================================================
// Singleton Instance
// =============================================================================

let adminRouterInstance: Router | null = null;

/**
 * Get the singleton admin router instance.
 */
export function getAdminRoutes(): Router {
  if (!adminRouterInstance) {
    throw new Error('Admin routes not initialized. Call initAdminRoutes first.');
  }
  return adminRouterInstance;
}

/**
 * Initialize the admin routes singleton.
 */
export function initAdminRoutes(deps: AdminRouteDependencies): Router {
  adminRouterInstance = createAdminRoutes(deps);
  return adminRouterInstance;
}
