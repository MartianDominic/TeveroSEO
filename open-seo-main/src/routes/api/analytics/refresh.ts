/**
 * Analytics Refresh API Route
 * DATA-07 FIX: Manual refresh capability for analytics data
 *
 * POST /api/analytics/refresh
 *
 * Triggers a manual refresh of analytics data for a specific site.
 * Rate limited to prevent abuse (5 refreshes per hour per site).
 * CSRF protected: POST requires valid CSRF token.
 *
 * Request body:
 * - siteId: UUID of the site to refresh
 * - types?: Array of specific analytics types to refresh (default: all)
 *
 * Response:
 * - jobId: BullMQ job ID for tracking
 * - estimatedTime: Estimated completion time in seconds
 * - queuePosition: Position in queue (if applicable)
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { gscSyncQueue } from '@/server/features/analytics/jobs/gsc-sync.job';
import { authenticateAnalyticsRequest } from '@/server/features/analytics/auth/analytics-auth';
import { redis } from '@/server/lib/redis';
import { publishCacheInvalidation } from '@/server/cache';
import { createLogger } from '@/server/lib/logger';
import { csrfProtect } from '@/server/middleware/csrf';
import {
  createErrorResponse,
  ERROR_CODES,
} from '@/server/features/analytics/types/api-responses';

const log = createLogger({ module: 'analytics-refresh-api' });

// Rate limit: 5 refreshes per hour per site
const REFRESH_RATE_LIMIT = 5;
const REFRESH_RATE_WINDOW_SECONDS = 3600; // 1 hour

const bodySchema = z.object({
  siteId: z.string().uuid('Invalid site ID format'),
  types: z
    .array(
      z.enum([
        'dashboard',
        'trends',
        'striking',
        'cannibalization',
        'clusters',
        'groups',
        'portfolio',
        'ctr-benchmark',
        'index-coverage',
      ])
    )
    .optional(),
});

/**
 * Check and update rate limit for refresh requests.
 * Returns remaining requests or -1 if limit exceeded.
 */
async function checkRefreshRateLimit(
  workspaceId: string,
  siteId: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = `analytics:refresh-limit:${workspaceId}:${siteId}`;

  try {
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= REFRESH_RATE_LIMIT) {
      const ttl = await redis.ttl(key);
      return { allowed: false, remaining: 0, resetIn: ttl > 0 ? ttl : REFRESH_RATE_WINDOW_SECONDS };
    }

    // Increment counter
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, REFRESH_RATE_WINDOW_SECONDS);
    await pipeline.exec();

    return {
      allowed: true,
      remaining: REFRESH_RATE_LIMIT - count - 1,
      resetIn: REFRESH_RATE_WINDOW_SECONDS,
    };
  } catch (error) {
    // On Redis error, allow the request (fail open)
    log.warn('Rate limit check failed', {
      workspaceId,
      siteId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, remaining: REFRESH_RATE_LIMIT, resetIn: REFRESH_RATE_WINDOW_SECONDS };
  }
}

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)('/api/analytics/refresh')({
  loader: async ({ request }: any) => {
    // Only allow POST
    if (request.method !== 'POST') {
      return Response.json(
        createErrorResponse(ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed'),
        { status: 405 }
      );
    }

    try {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Parse and validate body
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON body'),
          { status: 400 }
        );
      }

      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid parameters', parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))),
          { status: 400 }
        );
      }

      const { siteId, types } = parsed.data;

      // Check rate limit
      const rateLimit = await checkRefreshRateLimit(auth.workspaceId, siteId);
      if (!rateLimit.allowed) {
        return Response.json(
          createErrorResponse(
            ERROR_CODES.RATE_LIMITED,
            `Maximum ${REFRESH_RATE_LIMIT} refreshes per hour. Try again in ${Math.ceil(rateLimit.resetIn / 60)} minutes.`,
            { resetIn: rateLimit.resetIn }
          ),
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(REFRESH_RATE_LIMIT),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + rateLimit.resetIn),
              'Retry-After': String(rateLimit.resetIn),
            },
          }
        );
      }

      // First, immediately invalidate cache to show stale indicator
      await publishCacheInvalidation(auth.workspaceId, siteId, 'manual_refresh', types);

      // Queue GSC sync job for fresh data
      const job = await gscSyncQueue.add(
        'manual-refresh',
        { syncType: 'incremental', siteId },
        {
          // Manual refreshes have higher priority than scheduled syncs
          priority: 1,
          // Use unique job ID to prevent duplicate concurrent refreshes
          jobId: `manual-refresh:${auth.workspaceId}:${siteId}:${Date.now()}`,
        }
      );

      log.info('Manual refresh triggered', {
        workspaceId: auth.workspaceId,
        siteId,
        jobId: job.id,
        types: types ?? 'all',
      });

      // Estimate completion time based on queue position
      const waiting = await gscSyncQueue.getWaitingCount();
      const estimatedSeconds = Math.max(30, waiting * 60); // ~1 min per job, minimum 30s

      return Response.json(
        {
          success: true,
          data: {
            jobId: job.id,
            estimatedTime: estimatedSeconds,
            queuePosition: waiting + 1,
            message: 'Refresh job queued successfully',
          },
        },
        {
          headers: {
            'X-RateLimit-Limit': String(REFRESH_RATE_LIMIT),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(
              Math.ceil(Date.now() / 1000) + REFRESH_RATE_WINDOW_SECONDS
            ),
          },
        }
      );
    } catch (error) {
      log.error('Manual refresh error', error instanceof Error ? error : undefined);
      return Response.json(
        createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'),
        { status: 500 }
      );
    }
  },
});

/**
 * GET handler to check refresh status
 */
export const getRefreshStatus = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return Response.json(
      createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'jobId parameter required'),
      { status: 400 }
    );
  }

  try {
    const job = await gscSyncQueue.getJob(jobId);

    if (!job) {
      return Response.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Job not found'),
        { status: 404 }
      );
    }

    const state = await job.getState();
    const progress = job.progress;

    return Response.json({
      success: true,
      data: {
        jobId: job.id,
        state,
        progress: typeof progress === 'number' ? progress : 0,
        result: state === 'completed' ? job.returnvalue : null,
        failedReason: state === 'failed' ? job.failedReason : null,
      },
    });
  } catch (error) {
    log.error('Refresh status check error', error instanceof Error ? error : undefined);
    return Response.json(
      createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Failed to check job status'),
      { status: 500 }
    );
  }
};
