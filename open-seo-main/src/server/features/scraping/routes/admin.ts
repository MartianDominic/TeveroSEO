/**
 * Admin Dashboard Routes
 * Phase 95-13: E2E Testing & Migration Rollout
 *
 * Provides admin endpoints for:
 * - Migration status and control
 * - Cache warming operations
 * - Domain learning feedback monitoring
 * - Operational controls
 *
 * Access Control:
 * - GET endpoints: requireReadonly (monitoring access)
 * - POST endpoints: requireAdmin (write access)
 */

// @ts-expect-error - express may not be installed yet
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { ScrapingService } from '../ScrapingService';
import type { MigrationRollout, RolloutStatus, RolloutReadinessCheck } from '../migration/MigrationRollout';
import { domainLearningService } from '../DomainLearningService';
import type { CacheWarmer, WarmingResult, WarmingProgress } from '../cache/CacheWarmer';
import type { DomainFeedbackService } from '../DomainFeedback';
import type { ScrapingFeature, MigrationState } from '../config';
import { VALID_MIGRATION_STATES, MIGRATION_ORDER } from '../config/feature-flags';
import { SCRAPE_TIERS } from '@/db/domain-scrape-learning-schema';
import { requireAdmin, requireReadonly } from '../middleware';
import { cacheLogger } from '../logging';
import {
  expressScrapingCriticalRateLimit,
  expressScrapingStateChangeRateLimit,
  expressScrapingResourceIntensiveRateLimit,
  expressScrapingGeneralAdminRateLimit,
} from '../../../middleware/rate-limit';
import {
  getAuditLogger,
  createAuditContext,
  type AuditEntry,
} from '../monitoring/AuditLogger';
import type { ScrapingAuditAction } from '@/db/scraping-audit-schema';

// =============================================================================
// Zod Validation Schemas (SEC-01: Input Validation)
// =============================================================================

/**
 * Schema for emergency stop request.
 * Requires a reason for audit trail.
 */
const EmergencyStopSchema = z.object({
  /** Reason for emergency stop (required for audit trail) */
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be at most 500 characters'),
  /** Optional: auto-resume after duration (minutes) */
  durationMinutes: z.number().int().positive().max(1440).optional(),
});
type EmergencyStopRequest = z.infer<typeof EmergencyStopSchema>;

/**
 * Schema for resume request.
 * Optional confirmation code for safety.
 */
const ResumeSchema = z.object({
  /** Optional confirmation code for extra safety */
  confirmationCode: z.string().max(100).optional(),
  /** Reason for resuming operations */
  reason: z.string().max(500).optional(),
});
type ResumeRequest = z.infer<typeof ResumeSchema>;

/**
 * Schema for migration feature advancement.
 */
const MigrationAdvanceSchema = z.object({
  /** Force advancement even if not ready (not recommended) */
  force: z.boolean().optional().default(false),
  /** Reason for manual advancement */
  reason: z.string().max(500).optional(),
});
type MigrationAdvanceRequest = z.infer<typeof MigrationAdvanceSchema>;

/**
 * Schema for migration rollback.
 */
const MigrationRollbackSchema = z.object({
  /** Target state to rollback to */
  targetState: z.enum(VALID_MIGRATION_STATES as unknown as [string, ...string[]]).optional(),
  /** Reason for rollback (required for audit) */
  reason: z.string().min(1, 'Reason is required for rollback').max(500),
});
type MigrationRollbackRequest = z.infer<typeof MigrationRollbackSchema>;

/**
 * Schema for cache warming request.
 */
const CacheWarmSchema = z.object({
  /** URLs to warm cache for (1-1000 URLs) */
  urls: z.array(z.string().url('Invalid URL format')).min(1, 'At least one URL is required').max(1000, 'Maximum 1000 URLs per request'),
  /** Priority level for warming */
  priority: z.enum(['high', 'normal', 'low']).optional().default('normal'),
  /** Concurrent fetch limit (1-50) */
  concurrency: z.number().int().positive().max(50).optional().default(10),
  /** Client identifier for tracking */
  clientId: z.string().max(100).optional().default('admin'),
});
type CacheWarmRequestBody = z.infer<typeof CacheWarmSchema>;

/**
 * Schema for sitemap warming request.
 */
const SitemapWarmSchema = z.object({
  /** Sitemap URL to fetch and warm */
  sitemapUrl: z.string().url('Invalid sitemap URL format'),
  /** Maximum URLs to warm from sitemap (1-5000) */
  maxUrls: z.number().int().positive().max(5000).optional().default(1000),
  /** Priority level for warming */
  priority: z.enum(['high', 'normal', 'low']).optional().default('low'),
  /** Client identifier for tracking */
  clientId: z.string().max(100).optional().default('admin'),
});
type SitemapWarmRequest = z.infer<typeof SitemapWarmSchema>;

/**
 * Schema for domain warming request.
 */
const DomainWarmSchema = z.object({
  /** Domain to warm cache for */
  domain: z.string().min(1, 'Domain is required').max(253, 'Invalid domain length'),
  /** Client identifier for tracking */
  clientId: z.string().max(100).optional().default('admin'),
  /** Optional list of top page URLs to warm */
  topPages: z.array(z.string().url('Invalid URL format')).max(100).optional(),
  /** Optional list of recently updated page URLs to warm */
  recentlyUpdated: z.array(z.string().url('Invalid URL format')).max(100).optional(),
});
type DomainWarmRequest = z.infer<typeof DomainWarmSchema>;

/**
 * Schema for audit warming request body.
 */
const AuditWarmBodySchema = z.object({
  /** Client identifier for tracking */
  clientId: z.string().max(100).optional().default('admin'),
});
type AuditWarmBody = z.infer<typeof AuditWarmBodySchema>;

/**
 * Schema for domain reset request.
 */
const DomainResetSchema = z.object({
  /** Reason for resetting domain configuration */
  reason: z.string().max(500).optional(),
});
type DomainResetRequest = z.infer<typeof DomainResetSchema>;

/**
 * Schema for tier override request.
 * Allows forcing a specific tier for a domain.
 */
const TierOverrideSchema = z.object({
  /** Domain to override tier for */
  domain: z.string().min(1, 'Domain is required').max(253, 'Invalid domain length'),
  /** Tier to force for this domain */
  tier: z.enum(SCRAPE_TIERS as unknown as [string, ...string[]]),
  /** Reason for override (required for audit) */
  reason: z.string().min(1, 'Reason is required').max(500),
  /** Duration of override in hours (optional, permanent if not set) */
  durationHours: z.number().int().positive().max(720).optional(), // Max 30 days
});
type TierOverrideRequest = z.infer<typeof TierOverrideSchema>;

/**
 * Schema for cache invalidation request.
 */
const CacheInvalidateSchema = z.object({
  /** Domain to invalidate cache for */
  domain: z.string().max(253).optional(),
  /** URL pattern to invalidate (regex supported) */
  urlPattern: z.string().max(1000).optional(),
  /** Invalidate all cache (requires both domain and urlPattern to be empty) */
  all: z.boolean().optional().default(false),
}).refine(
  (data) => data.domain || data.urlPattern || data.all,
  { message: 'At least one of domain, urlPattern, or all must be specified' }
);
type CacheInvalidateRequest = z.infer<typeof CacheInvalidateSchema>;

/**
 * Validate request body with Zod schema.
 * Returns 400 with validation errors on failure.
 *
 * @example
 * ```typescript
 * const parsed = validateRequestBody(EmergencyStopSchema, req.body, res);
 * if (!parsed) return; // Response already sent
 * // parsed is fully typed
 * ```
 */
function validateRequestBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
        code: issue.code,
      })),
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  return result.data;
}

/**
 * Validate URL path parameter as ScrapingFeature.
 * Returns 400 if not a valid feature.
 */
function validateFeatureParam(feature: string, res: Response): ScrapingFeature | null {
  if (!MIGRATION_ORDER.includes(feature as ScrapingFeature)) {
    res.status(400).json({
      error: 'Invalid feature',
      message: `Feature must be one of: ${MIGRATION_ORDER.join(', ')}`,
      received: feature,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
  return feature as ScrapingFeature;
}

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
  // Migration Status Endpoints
  // ===========================================================================

  /**
   * GET /admin/migration/status
   * Get full migration status for all features.
   * Access: readonly
   */
  router.get('/migration/status', requireReadonly, async (_req: Request, res: Response) => {
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
   * Access: readonly
   * SEC-01: Validate feature parameter
   */
  router.get('/migration/:feature/ready', requireReadonly, async (req: Request, res: Response) => {
    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate feature parameter
    const feature = validateFeatureParam(req.params.feature, res);
    if (!feature) return;

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
   * Access: admin
   * Rate limit: 5 req/min (state change)
   * SEC-01: Zod validation for request body and feature param
   */
  router.post('/migration/:feature/advance', expressScrapingStateChangeRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate feature parameter
    const feature = validateFeatureParam(req.params.feature, res);
    if (!feature) return;

    // SEC-01: Validate request body
    const validated = validateRequestBody(MigrationAdvanceSchema, req.body, res);
    if (!validated) return;

    const { force, reason } = validated;

    try {
      // First check readiness unless forced
      if (!force) {
        const readiness = await migrationRollout.checkReadyForAdvancement(feature);
        if (!readiness.ready) {
          // Log failed attempt due to blockers
          auditLogger.log({
            action: 'migration_advance',
            actor,
            target: { type: 'migration', id: feature },
            parameters: { force, reason, blockers: readiness.blockers },
            result: 'failure',
            errorMessage: `Not ready: ${readiness.blockers.join(', ')}`,
            durationMs: Date.now() - startTime,
          }).catch(() => { /* Audit failure should not break operation */ });

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
        // Log successful state change
        auditLogger.log({
          action: 'migration_advance',
          actor,
          target: { type: 'migration', id: feature },
          parameters: {
            force,
            reason: reason ?? 'Manual advancement via admin API',
            previousState: result.previousState,
            newState: result.newState,
          },
          result: 'success',
          durationMs: Date.now() - startTime,
        }).catch(() => { /* Audit failure should not break operation */ });

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
        // Log failed advancement
        auditLogger.log({
          action: 'migration_advance',
          actor,
          target: { type: 'migration', id: feature },
          parameters: { force, reason },
          result: 'failure',
          errorMessage: result.message,
          durationMs: Date.now() - startTime,
        }).catch(() => { /* Audit failure should not break operation */ });

        res.status(400).json({
          success: false,
          feature,
          message: result.message,
          currentState: result.previousState,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      // Log error
      auditLogger.log({
        action: 'migration_advance',
        actor,
        target: { type: 'migration', id: feature },
        parameters: { force, reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

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
   * Access: admin
   * Rate limit: 5 req/min (state change)
   * SEC-01: Zod validation for request body and feature param
   */
  router.post('/migration/:feature/rollback', expressScrapingStateChangeRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

    if (!migrationRollout) {
      res.status(503).json({
        error: 'Migration rollout service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate feature parameter
    const feature = validateFeatureParam(req.params.feature, res);
    if (!feature) return;

    // SEC-01: Validate request body
    const validated = validateRequestBody(MigrationRollbackSchema, req.body, res);
    if (!validated) return;

    const { targetState, reason } = validated;

    try {
      const result = await migrationRollout.rollbackFeature(feature, reason);

      if (result.success) {
        // Log successful rollback (critical action)
        auditLogger.log({
          action: 'migration_rollback',
          actor,
          target: { type: 'migration', id: feature },
          parameters: {
            targetState,
            reason: reason ?? 'Manual rollback via admin API',
            previousState: result.previousState,
            newState: result.newState,
          },
          result: 'success',
          durationMs: Date.now() - startTime,
        }).catch(() => { /* Audit failure should not break operation */ });

        res.json({
          success: true,
          feature,
          previousState: result.previousState,
          newState: result.newState,
          reason: reason ?? 'Manual rollback via admin API',
          timestamp: new Date().toISOString(),
        });
      } else {
        // Log failed rollback
        auditLogger.log({
          action: 'migration_rollback',
          actor,
          target: { type: 'migration', id: feature },
          parameters: { targetState, reason },
          result: 'failure',
          errorMessage: result.reason,
          durationMs: Date.now() - startTime,
        }).catch(() => { /* Audit failure should not break operation */ });

        res.status(400).json({
          success: false,
          feature,
          reason: result.reason,
          currentState: result.previousState,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      // Log error
      auditLogger.log({
        action: 'migration_rollback',
        actor,
        target: { type: 'migration', id: feature },
        parameters: { targetState, reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

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
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   * SEC-01: Zod validation for request body
   */
  router.post('/cache/warm', expressScrapingResourceIntensiveRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate request body with Zod schema
    const validated = validateRequestBody(CacheWarmSchema, req.body, res);
    if (!validated) return;

    const { urls, priority, concurrency, clientId } = validated;

    try {
      const result: WarmingResult = await cacheWarmer.warmCache({
        urls,
        priority,
        concurrency: Math.min(concurrency, 50), // Cap concurrency
        clientId,
        onProgress: (progress: WarmingProgress) => {
          // Progress is logged server-side, not sent to client
          cacheLogger.info(
            { warmed: progress.warmed, total: progress.total, cached: progress.alreadyCached, failed: progress.failed },
            "Cache warming progress"
          );
        },
      });

      // Log successful cache warm
      auditLogger.log({
        action: 'cache_warm',
        actor,
        target: { type: 'cache', id: 'urls' },
        parameters: {
          urlCount: urls.length,
          priority,
          concurrency: Math.min(concurrency, 50),
          clientId,
          warmed: result.warmed,
          failed: result.failed,
        },
        result: 'success',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Log failed cache warm
      auditLogger.log({
        action: 'cache_warm',
        actor,
        target: { type: 'cache', id: 'urls' },
        parameters: { urlCount: urls.length, priority, concurrency, clientId },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/cache/warm-audit/:auditId
   * Warm cache for all URLs in an audit job.
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   * SEC-01: Zod validation for request body
   */
  router.post('/cache/warm-audit/:auditId', expressScrapingResourceIntensiveRateLimit, requireAdmin, async (req: Request, res: Response) => {
    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { auditId } = req.params;

    // Validate auditId is a non-empty string (URL param validation)
    if (!auditId || typeof auditId !== 'string' || auditId.trim().length === 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'auditId', message: 'auditId is required', code: 'invalid_string' }],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate request body with Zod schema
    const validated = validateRequestBody(AuditWarmBodySchema, req.body, res);
    if (!validated) return;

    const { clientId } = validated;

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
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   * SEC-01: Zod validation for request body
   */
  router.post('/cache/warm-sitemap', expressScrapingResourceIntensiveRateLimit, requireAdmin, async (req: Request, res: Response) => {
    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate request body with Zod schema
    const validated = validateRequestBody(SitemapWarmSchema, req.body, res);
    if (!validated) return;

    const { sitemapUrl, maxUrls, priority, clientId } = validated;

    try {
      const result: WarmingResult = await cacheWarmer.warmFromSitemap(sitemapUrl, clientId, {
        maxUrls, // Already validated and capped by schema
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
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   * SEC-01: Zod validation for request body
   */
  router.post('/cache/warm-domain', expressScrapingResourceIntensiveRateLimit, requireAdmin, async (req: Request, res: Response) => {
    if (!cacheWarmer) {
      res.status(503).json({
        error: 'Cache warmer service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate request body with Zod schema
    const validated = validateRequestBody(DomainWarmSchema, req.body, res);
    if (!validated) return;

    const { domain, clientId, topPages, recentlyUpdated } = validated;

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
   * Access: readonly
   */
  router.get('/feedback/status', requireReadonly, (_req: Request, res: Response) => {
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
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   */
  router.post('/feedback/flush', expressScrapingResourceIntensiveRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

    if (!feedbackService) {
      res.status(503).json({
        error: 'Feedback service not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const bufferBefore = feedbackService.getBufferSize();
      const result = await feedbackService.flush();

      // Log successful flush
      auditLogger.log({
        action: 'feedback_flush',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        parameters: {
          bufferBefore,
          domainsProcessed: result.domainsProcessed,
          updatesApplied: result.updatesApplied,
        },
        result: 'success',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Log failed flush
      auditLogger.log({
        action: 'feedback_flush',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/feedback/clear
   * Clear feedback buffer without processing.
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   */
  router.post('/feedback/clear', expressScrapingResourceIntensiveRateLimit, requireAdmin, (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

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

      // Log successful clear
      auditLogger.log({
        action: 'feedback_clear',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        parameters: {
          clearedDomains: beforeSize.domains,
          clearedFeedback: beforeSize.totalFeedback,
        },
        result: 'success',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

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
      // Log failed clear
      auditLogger.log({
        action: 'feedback_clear',
        actor,
        target: { type: 'feedback', id: 'buffer' },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

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
   * Access: readonly
   */
  router.get('/domains/:domain/config', requireReadonly, async (req: Request, res: Response) => {
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
   * Access: admin
   * Rate limit: 10 req/min (resource intensive)
   * SEC-01: Zod validation for request body
   */
  router.post('/domains/:domain/reset', expressScrapingResourceIntensiveRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();
    const { domain } = req.params;

    // Validate domain param
    if (!domain || typeof domain !== 'string' || domain.length > 253) {
      res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'domain', message: 'Invalid domain parameter', code: 'invalid_string' }],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // SEC-01: Validate request body with Zod schema
    const validated = validateRequestBody(DomainResetSchema, req.body, res);
    if (!validated) return;

    const { reason } = validated;

    try {
      // Invalidate cache forces re-discovery on next request
      await domainLearningService.invalidateCache(domain);

      // Log successful cache invalidation
      auditLogger.log({
        action: 'cache_invalidate',
        actor,
        target: { type: 'domain', id: domain },
        parameters: { reason: reason ?? 'Manual reset via admin API' },
        result: 'success',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.json({
        success: true,
        domain,
        action: 'cache_invalidated',
        reason: reason ?? 'Manual reset via admin API',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Log error
      auditLogger.log({
        action: 'cache_invalidate',
        actor,
        target: { type: 'domain', id: domain },
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

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
   * Access: readonly
   */
  router.get('/system/status', requireReadonly, async (_req: Request, res: Response) => {
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
   * Access: admin
   * Rate limit: 2 req/min (critical operation)
   * SEC-01: Zod validation for request body
   */
  router.post('/system/emergency-stop', expressScrapingCriticalRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

    // SEC-01: Validate request body
    const validated = validateRequestBody(EmergencyStopSchema, req.body, res);
    if (!validated) return;

    const { reason, durationMinutes } = validated;

    try {
      await scrapingService.emergencyStop();

      // Stop feedback service if available
      if (feedbackService) {
        feedbackService.stop();
      }

      // Log successful emergency stop (critical action - persisted immediately)
      auditLogger.log({
        action: 'emergency_stop',
        actor,
        target: { type: 'system', id: 'scraping-system' },
        parameters: { reason, durationMinutes },
        result: 'success',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.json({
        success: true,
        message: 'All scraping operations stopped',
        reason,
        durationMinutes,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Log failed emergency stop
      auditLogger.log({
        action: 'emergency_stop',
        actor,
        target: { type: 'system', id: 'scraping-system' },
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /admin/system/resume
   * Resume scraping operations after emergency stop.
   * Access: admin
   * Rate limit: 2 req/min (critical operation)
   * SEC-01: Zod validation for request body
   */
  router.post('/system/resume', expressScrapingCriticalRateLimit, requireAdmin, async (req: Request, res: Response) => {
    const auditLogger = getAuditLogger();
    const actor = createAuditContext(req);
    const startTime = Date.now();

    // SEC-01: Validate request body
    const validated = validateRequestBody(ResumeSchema, req.body, res);
    if (!validated) return;

    const { reason, confirmationCode } = validated;

    try {
      await scrapingService.resume();

      // Resume feedback service if available
      if (feedbackService) {
        feedbackService.startAutoFlush();
      }

      // Log successful resume
      auditLogger.log({
        action: 'resume',
        actor,
        target: { type: 'system', id: 'scraping-system' },
        parameters: { reason: reason ?? 'Resume via admin API' },
        result: 'success',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

      res.json({
        success: true,
        message: 'Scraping operations resumed',
        reason: reason ?? 'Resume via admin API',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Log failed resume
      auditLogger.log({
        action: 'resume',
        actor,
        target: { type: 'system', id: 'scraping-system' },
        parameters: { reason },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      }).catch(() => { /* Audit failure should not break operation */ });

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
