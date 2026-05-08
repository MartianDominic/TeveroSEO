/**
 * Internal Scraping API Routes
 * HTTP Bridge for AI-Writer to use unified ScrapingService
 *
 * Purpose:
 * - Provides internal API endpoint for cross-service scraping
 * - Allows AI-Writer (Python/FastAPI) to use the unified TieredFetcher
 * - Uses separate authentication (INTERNAL_API_KEY) for service-to-service calls
 *
 * Security:
 * - Internal API key authentication (X-Internal-API-Key header)
 * - Rate limiting (100 req/min per client)
 * - Input validation with Zod
 *
 * Endpoints:
 * - POST /api/internal/scrape - Single URL scrape
 * - POST /api/internal/scrape-batch - Batch URL scrape
 */

// @ts-expect-error - express may not be installed yet
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import type { ScrapingService } from '../ScrapingService';
import type { ScrapeTier } from '@/db/domain-scrape-learning-schema';
import { logger } from '../logging';

// =============================================================================
// Zod Validation Schemas
// =============================================================================

/**
 * Valid tier names for max tier option.
 */
const VALID_TIERS = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'] as const;

/**
 * Schema for single scrape request.
 */
const ScrapeRequestSchema = z.object({
  /** URL to scrape */
  url: z.string().url('Invalid URL format'),
  /** Optional scraping options */
  options: z.object({
    /** Maximum tier to use (default: dfs_browser) */
    maxTier: z.enum(VALID_TIERS).optional(),
    /** Starting tier (default: based on domain learning) */
    startTier: z.enum(VALID_TIERS).optional(),
    /** Force a specific tier (skip domain learning) */
    forceTier: z.enum(VALID_TIERS).optional(),
    /** Feature identifier for cost tracking */
    feature: z.string().max(50).optional(),
    /** Client ID for cost attribution */
    clientId: z.string().max(100).optional(),
    /** Skip cache lookup */
    skipCache: z.boolean().optional(),
    /** Timeout in milliseconds (max 60 seconds) */
    timeoutMs: z.number().int().positive().max(60000).optional(),
    /** Include parsed page data (title, meta, headings) */
    includeParsedData: z.boolean().optional(),
    /** Include raw HTML in response (default: true) */
    includeHtml: z.boolean().optional(),
  }).optional(),
});
type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

/**
 * Schema for batch scrape request.
 */
const BatchScrapeRequestSchema = z.object({
  /** URLs to scrape (1-100 URLs) */
  urls: z.array(z.string().url('Invalid URL format')).min(1).max(100),
  /** Optional scraping options (applied to all URLs) */
  options: z.object({
    /** Maximum tier to use */
    maxTier: z.enum(VALID_TIERS).optional(),
    /** Feature identifier for cost tracking */
    feature: z.string().max(50).optional(),
    /** Client ID for cost attribution */
    clientId: z.string().max(100).optional(),
    /** Concurrency limit (1-20) */
    concurrency: z.number().int().positive().max(20).optional(),
    /** Skip cache lookup */
    skipCache: z.boolean().optional(),
    /** Timeout per URL in milliseconds */
    timeoutMs: z.number().int().positive().max(60000).optional(),
  }).optional(),
});
type BatchScrapeRequest = z.infer<typeof BatchScrapeRequestSchema>;

// =============================================================================
// Types
// =============================================================================

/**
 * Response format for single scrape.
 */
export interface InternalScrapeResponse {
  success: boolean;
  html?: string;
  error?: string;
  metadata: {
    tierUsed: ScrapeTier;
    fromCache: boolean;
    cacheLevel?: string;
    costUsd: number;
    responseTimeMs: number;
    statusCode: number;
    responseSizeBytes: number;
    parsedData?: {
      title?: string;
      metaDescription?: string;
      h1?: string[];
      canonical?: string;
      wordCount?: number;
    };
  };
}

/**
 * Response format for batch scrape.
 */
export interface InternalBatchScrapeResponse {
  success: boolean;
  results: Array<{
    url: string;
    success: boolean;
    html?: string;
    error?: string;
    metadata: {
      tierUsed: ScrapeTier;
      fromCache: boolean;
      costUsd: number;
      responseTimeMs: number;
    };
  }>;
  summary: {
    totalUrls: number;
    successCount: number;
    failureCount: number;
    totalCostUsd: number;
    totalDurationMs: number;
    cacheHits: number;
    cacheMisses: number;
    tierDistribution: Record<ScrapeTier, number>;
  };
}

// =============================================================================
// Internal API Key Authentication
// =============================================================================

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeCompare(provided: string, expected: string): boolean {
  const maxLength = Math.max(provided.length, expected.length);
  const paddedProvided = provided.padEnd(maxLength, '\0');
  const paddedExpected = expected.padEnd(maxLength, '\0');

  const providedBuffer = Buffer.from(paddedProvided, 'utf-8');
  const expectedBuffer = Buffer.from(paddedExpected, 'utf-8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return (
    timingSafeEqual(providedBuffer, expectedBuffer) &&
    provided.length === expected.length
  );
}

/**
 * Middleware to validate internal API key.
 * Uses X-Internal-API-Key header and INTERNAL_API_KEY env var.
 */
function requireInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
    logger.error({}, 'INTERNAL_API_KEY not configured - internal API disabled');
    res.status(503).json({
      success: false,
      error: 'Internal API not configured',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const providedKey = req.headers['x-internal-api-key'] as string | undefined;

  if (!providedKey) {
    res.status(401).json({
      success: false,
      error: 'Missing internal API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!timingSafeCompare(providedKey, internalApiKey)) {
    logger.warn({ ip: req.ip }, 'Invalid internal API key attempted');
    res.status(401).json({
      success: false,
      error: 'Invalid internal API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

// =============================================================================
// Validation Helper
// =============================================================================

/**
 * Validate request body with Zod schema.
 * Returns null and sends error response if validation fails.
 */
function validateRequestBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      success: false,
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

// =============================================================================
// Rate Limiting (Simple in-memory for internal API)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

function internalApiRateLimit(req: Request, res: Response, next: NextFunction): void {
  // Use client ID from body or IP as key
  const clientId = (req.body?.options?.clientId as string) || req.ip || 'unknown';
  const now = Date.now();

  let entry = rateLimitMap.get(clientId);

  // Reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(clientId, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfterSeconds: retryAfter,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', entry.resetAt);

  next();
}

// Clean up rate limit map periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create internal scraping routes.
 *
 * @example
 * ```typescript
 * import { createInternalRoutes } from './routes/internal';
 * import { scrapingService } from '../ScrapingService';
 *
 * const internalRoutes = createInternalRoutes(scrapingService);
 * app.use('/api/internal', internalRoutes);
 * ```
 */
export function createInternalRoutes(scrapingService: ScrapingService): Router {
  const router = Router();

  /**
   * POST /api/internal/scrape
   * Scrape a single URL using the unified ScrapingService.
   *
   * Headers:
   *   X-Internal-API-Key: <INTERNAL_API_KEY>
   *
   * Body:
   *   {
   *     "url": "https://example.com",
   *     "options": {
   *       "maxTier": "dfs_basic",
   *       "feature": "ai-writer",
   *       "clientId": "client-123"
   *     }
   *   }
   *
   * Response:
   *   {
   *     "success": true,
   *     "html": "<html>...</html>",
   *     "metadata": {
   *       "tierUsed": "direct",
   *       "fromCache": true,
   *       "costUsd": 0,
   *       "responseTimeMs": 150
   *     }
   *   }
   */
  router.post('/scrape', requireInternalApiKey, internalApiRateLimit, async (req: Request, res: Response) => {
    const startTime = Date.now();

    // Validate request body
    const validated = validateRequestBody(ScrapeRequestSchema, req.body, res);
    if (!validated) return;

    const { url, options } = validated;

    try {
      const result = await scrapingService.scrape(url, {
        maxTier: options?.maxTier,
        startTier: options?.startTier,
        forceTier: options?.forceTier,
        feature: (options?.feature ?? 'ai-writer') as any,
        clientId: options?.clientId ?? 'ai-writer',
        skipCache: options?.skipCache,
        timeoutMs: options?.timeoutMs,
        includeParsedData: options?.includeParsedData,
        includeHtml: options?.includeHtml ?? true,
      });

      const response: InternalScrapeResponse = {
        success: result.success,
        html: result.html,
        error: result.error,
        metadata: {
          tierUsed: result.tierUsed,
          fromCache: result.fromCache,
          cacheLevel: result.cacheLevel,
          costUsd: result.estimatedCostUsd,
          responseTimeMs: result.responseTimeMs,
          statusCode: result.statusCode,
          responseSizeBytes: result.responseSizeBytes,
          parsedData: result.parsedData ? {
            title: result.parsedData.title,
            metaDescription: result.parsedData.metaDescription,
            h1: result.parsedData.h1,
            canonical: result.parsedData.canonical,
            wordCount: result.parsedData.wordCount,
          } : undefined,
        },
      };

      logger.info({
        url,
        tierUsed: result.tierUsed,
        fromCache: result.fromCache,
        costUsd: result.estimatedCostUsd,
        durationMs: Date.now() - startTime,
        feature: options?.feature ?? 'ai-writer',
        clientId: options?.clientId,
      }, 'Internal scrape completed');

      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        url,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        feature: options?.feature ?? 'ai-writer',
      }, 'Internal scrape failed');

      const response: InternalScrapeResponse = {
        success: false,
        error: errorMessage,
        metadata: {
          tierUsed: 'direct',
          fromCache: false,
          costUsd: 0,
          responseTimeMs: Date.now() - startTime,
          statusCode: 0,
          responseSizeBytes: 0,
        },
      };

      res.status(500).json(response);
    }
  });

  /**
   * POST /api/internal/scrape-batch
   * Scrape multiple URLs in batch.
   *
   * Headers:
   *   X-Internal-API-Key: <INTERNAL_API_KEY>
   *
   * Body:
   *   {
   *     "urls": ["https://example.com/1", "https://example.com/2"],
   *     "options": {
   *       "feature": "ai-writer",
   *       "clientId": "client-123",
   *       "concurrency": 5
   *     }
   *   }
   */
  router.post('/scrape-batch', requireInternalApiKey, internalApiRateLimit, async (req: Request, res: Response) => {
    const startTime = Date.now();

    // Validate request body
    const validated = validateRequestBody(BatchScrapeRequestSchema, req.body, res);
    if (!validated) return;

    const { urls, options } = validated;

    try {
      const batchResult = await scrapingService.scrapeBatch(urls, {
        maxTier: options?.maxTier,
        feature: (options?.feature ?? 'ai-writer') as any,
        clientId: options?.clientId ?? 'ai-writer',
        skipCache: options?.skipCache,
        timeoutMs: options?.timeoutMs,
        concurrency: options?.concurrency ?? 5,
      });

      const response: InternalBatchScrapeResponse = {
        success: true,
        results: batchResult.results.map((result) => ({
          url: result.url,
          success: result.success,
          html: result.html,
          error: result.error,
          metadata: {
            tierUsed: result.tierUsed,
            fromCache: result.fromCache,
            costUsd: result.estimatedCostUsd,
            responseTimeMs: result.responseTimeMs,
          },
        })),
        summary: {
          totalUrls: urls.length,
          successCount: batchResult.results.filter((r) => r.success).length,
          failureCount: batchResult.results.filter((r) => !r.success).length,
          totalCostUsd: batchResult.totalCostUsd,
          totalDurationMs: batchResult.durationMs,
          cacheHits: batchResult.cacheHits,
          cacheMisses: batchResult.cacheMisses,
          tierDistribution: batchResult.tierDistribution,
        },
      };

      logger.info({
        urlCount: urls.length,
        successCount: response.summary.successCount,
        failureCount: response.summary.failureCount,
        totalCostUsd: batchResult.totalCostUsd,
        durationMs: batchResult.durationMs,
        feature: options?.feature ?? 'ai-writer',
        clientId: options?.clientId,
      }, 'Internal batch scrape completed');

      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        urlCount: urls.length,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        feature: options?.feature ?? 'ai-writer',
      }, 'Internal batch scrape failed');

      res.status(500).json({
        success: false,
        error: errorMessage,
        results: [],
        summary: {
          totalUrls: urls.length,
          successCount: 0,
          failureCount: urls.length,
          totalCostUsd: 0,
          totalDurationMs: Date.now() - startTime,
          cacheHits: 0,
          cacheMisses: 0,
          tierDistribution: {
            direct: 0,
            webshare: 0,
            geonode: 0,
            camoufox: 0,
            dfs_basic: 0,
            dfs_js: 0,
            dfs_browser: 0,
          },
        },
      });
    }
  });

  /**
   * GET /api/internal/health
   * Health check for internal API (no auth required).
   * Used by AI-Writer to verify connectivity.
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'scraping-internal-api',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

// =============================================================================
// Singleton Instance
// =============================================================================

let internalRouterInstance: Router | null = null;

/**
 * Get the singleton internal router instance.
 */
export function getInternalRoutes(): Router {
  if (!internalRouterInstance) {
    throw new Error('Internal routes not initialized. Call initInternalRoutes first.');
  }
  return internalRouterInstance;
}

/**
 * Initialize the internal routes singleton.
 */
export function initInternalRoutes(scrapingService: ScrapingService): Router {
  internalRouterInstance = createInternalRoutes(scrapingService);
  return internalRouterInstance;
}
