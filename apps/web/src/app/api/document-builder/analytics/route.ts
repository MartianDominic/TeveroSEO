/**
 * Analytics API Route for Document Builder
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 *
 * POST /api/document-builder/analytics
 *
 * Accepts batched events per DOCUMENT-BUILDER-ARCHITECTURE.md:
 * - Validates session token
 * - Calls recordBlockView/recordBlockDwell for each event
 * - Fire-and-forget (returns 202 Accepted immediately)
 * - Rate limit: 100 events/minute/session
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import {
  recordBlockView,
  recordBlockDwell,
  type BlockInteraction,
} from "@/lib/document-builder/analytics-service";
import {
  unauthorized,
  badRequest,
  forbidden,
  validationError,
  rateLimited,
  serviceUnavailable,
  internalError,
  accepted,
  success,
} from "@/lib/api/responses";
import { validateCsrf } from "@/lib/api/security";

// =============================================================================
// Schema
// =============================================================================

/**
 * Block interaction schema with proper constraints.
 * M-10-02: Added length/range constraints for security.
 */
const blockInteractionSchema = z.object({
  type: z.enum(["block_view", "block_dwell", "scroll_depth", "cta_click"]),
  blockId: z.string().min(1).max(100),
  variantId: z.string().min(1).max(100).optional(),
  // dwellMs: max 24 hours in milliseconds (86400000ms)
  dwellMs: z.number().int().nonnegative().max(86400000).optional(),
  // percent: 0-100 range for scroll depth
  percent: z.number().min(0).max(100).optional(),
  // timestamp: must be reasonable (not before year 2020, not more than 1 hour in future)
  timestamp: z.number().int()
    .min(1577836800000) // Jan 1, 2020
    .max(Date.now() + 3600000) // 1 hour in future max
    .optional(),
});

const analyticsRequestSchema = z.object({
  sessionId: z.string().min(1),
  events: z.array(blockInteractionSchema).min(1).max(100),
});

// =============================================================================
// Rate Limiting (FAIL-CLOSED for security)
// =============================================================================

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_EVENTS = 100;

/** Timeout for background event processing: 30 seconds */
const BACKGROUND_PROCESSING_TIMEOUT_MS = 30000;

/** Track active background processing for cleanup */
const activeProcessing = new Map<string, AbortController>();

/**
 * Circuit breaker state for Redis failures.
 * Prevents cascading failures while maintaining security.
 */
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failureCount: 0,
  lastFailureTime: 0,
  isOpen: false,
};

const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
const CIRCUIT_BREAKER_RESET_MS = 30000; // Reset after 30 seconds

/**
 * Check rate limit for analytics events.
 *
 * SECURITY: Fails CLOSED - denies requests when Redis is unavailable.
 * This prevents abuse during Redis outages.
 *
 * Returns:
 * - { allowed: true } if within limit
 * - { allowed: false, reason: 'rate_limit' } if over limit
 * - { allowed: false, reason: 'service_unavailable' } if Redis error
 */
async function checkRateLimit(
  rateLimitKey: string,
  eventCount: number
): Promise<{ allowed: boolean; reason?: 'rate_limit' | 'service_unavailable' }> {
  const key = `ratelimit:analytics:${rateLimitKey}`;
  const now = Date.now();

  // Check circuit breaker state
  if (circuitBreaker.isOpen) {
    // Check if we should attempt recovery
    if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_RESET_MS) {
      // Allow one request through to test recovery
      circuitBreaker.isOpen = false;
      logger.info("[analytics-route] Circuit breaker reset, attempting recovery");
    } else {
      // Circuit still open - reject immediately
      logger.warn("[analytics-route] Circuit breaker open, rejecting request", {
        rateLimitKey,
        failureCount: circuitBreaker.failureCount,
      });
      return { allowed: false, reason: 'service_unavailable' };
    }
  }

  try {
    const current = await redis.get(key);
    const currentCount = current ? parseInt(current, 10) : 0;

    if (currentCount + eventCount > RATE_LIMIT_MAX_EVENTS) {
      logger.info("[analytics-route] Rate limit exceeded", {
        rateLimitKey,
        currentCount,
        eventCount,
        limit: RATE_LIMIT_MAX_EVENTS,
      });
      return { allowed: false, reason: 'rate_limit' };
    }

    // Increment and set expiry
    await redis.incrby(key, eventCount);
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);

    // Reset circuit breaker on success
    if (circuitBreaker.failureCount > 0) {
      circuitBreaker.failureCount = 0;
      logger.info("[analytics-route] Circuit breaker reset after successful Redis call");
    }

    return { allowed: true };
  } catch (error) {
    // SECURITY: FAIL CLOSED - deny request on Redis error
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = now;

    // Open circuit breaker if threshold exceeded
    if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.isOpen = true;
      logger.error(
        "[analytics-route] Circuit breaker OPENED after repeated Redis failures",
        {
          failureCount: circuitBreaker.failureCount,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    } else {
      logger.error(
        "[analytics-route] Rate limit check failed - DENYING REQUEST (fail-closed)",
        {
          rateLimitKey,
          failureCount: circuitBreaker.failureCount,
          error: error instanceof Error ? error : { error: String(error) },
        }
      );
    }

    return { allowed: false, reason: 'service_unavailable' };
  }
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // CSRF protection for state-changing request
    const csrfError = validateCsrf(request);
    if (csrfError) return csrfError;

    // Content-Type validation (H-API-01)
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return badRequest("Content-Type must be application/json");
    }

    // Authentication check - prevent attackers from flooding with fake events
    const { userId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }
    const parsed = analyticsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { sessionId, events } = parsed.data;

    // Check rate limit (FAIL-CLOSED for security)
    // H-SEC-02: Use composite key ${userId}:${sessionId} to prevent rate limit bypass
    // by using different sessionIds. This ensures rate limiting is tied to the authenticated user.
    const rateLimitKey = `${userId}:${sessionId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, events.length);
    if (!rateLimitResult.allowed) {
      if (rateLimitResult.reason === 'service_unavailable') {
        // Redis unavailable - return 503 to signal temporary issue
        return serviceUnavailable("Service temporarily unavailable. Please retry shortly.");
      }
      // Rate limit exceeded
      return rateLimited("Rate limit exceeded. Max 100 events per minute per session.", 60);
    }

    // Fire-and-forget: Process events asynchronously with timeout
    // Don't await - return 202 immediately
    const requestId = `${sessionId}-${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      activeProcessing.delete(requestId);
      logger.warn("[analytics-route] Background processing timed out", { requestId });
    }, BACKGROUND_PROCESSING_TIMEOUT_MS);

    activeProcessing.set(requestId, controller);

    processEvents(events, requestId, controller.signal)
      .catch((error) => {
        // Don't log abort errors as they're expected on timeout
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        logger.error(
          "[analytics-route] Background processing error",
          error instanceof Error ? error : { error: String(error) }
        );
      })
      .finally(() => {
        clearTimeout(timeoutId);
        activeProcessing.delete(requestId);
      });

    // Return 202 Accepted immediately
    return accepted({ eventCount: events.length });
  } catch (error) {
    logger.error(
      "[analytics-route] POST error",
      error instanceof Error ? error : { error: String(error) }
    );

    return internalError();
  }
}

// =============================================================================
// Event Processing
// =============================================================================

async function processEvents(
  events: BlockInteraction[],
  requestId: string,
  signal?: AbortSignal
): Promise<void> {
  const log = logger.child({ requestId, operation: "processEvents" });

  for (const event of events) {
    // Check if processing was aborted
    if (signal?.aborted) {
      throw new DOMException("Processing aborted", "AbortError");
    }

    const { type, blockId, variantId, dwellMs } = event;

    switch (type) {
      case "block_view":
        await recordBlockView(blockId, variantId);
        log.debug("Recorded block view", { blockId, variantId });
        break;

      case "block_dwell":
        if (dwellMs !== undefined && dwellMs > 0) {
          await recordBlockDwell(blockId, variantId, dwellMs);
          log.debug("Recorded block dwell", { blockId, variantId, dwellMs });
        }
        break;

      case "scroll_depth":
      case "cta_click":
        // These are handled at session level, not block level
        // Could add session-level tracking here if needed
        break;
    }
  }
}

// =============================================================================
// GET Handler (for testing/debugging)
// =============================================================================

export async function GET() {
  return success({
    service: "document-builder-analytics",
    version: "102-04",
    endpoints: {
      POST: "Submit batched analytics events",
    },
    limits: {
      maxEventsPerRequest: 100,
      maxEventsPerMinute: 100,
    },
  });
}
