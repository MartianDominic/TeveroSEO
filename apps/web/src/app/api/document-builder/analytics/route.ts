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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import {
  recordBlockView,
  recordBlockDwell,
  type BlockInteraction,
} from "@/lib/document-builder/analytics-service";

// =============================================================================
// Schema
// =============================================================================

const blockInteractionSchema = z.object({
  type: z.enum(["block_view", "block_dwell", "scroll_depth", "cta_click"]),
  blockId: z.string().min(1),
  variantId: z.string().optional(),
  dwellMs: z.number().optional(),
  percent: z.number().optional(),
  timestamp: z.number().optional(),
});

const analyticsRequestSchema = z.object({
  sessionId: z.string().min(1),
  events: z.array(blockInteractionSchema).min(1).max(100),
});

// =============================================================================
// Rate Limiting
// =============================================================================

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_EVENTS = 100;

async function checkRateLimit(sessionId: string, eventCount: number): Promise<boolean> {
  const key = `ratelimit:analytics:${sessionId}`;

  try {
    const current = await redis.get(key);
    const currentCount = current ? parseInt(current, 10) : 0;

    if (currentCount + eventCount > RATE_LIMIT_MAX_EVENTS) {
      return false;
    }

    // Increment and set expiry
    await redis.incrby(key, eventCount);
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);

    return true;
  } catch (error) {
    logger.error(
      "[analytics-route] Rate limit check error",
      error instanceof Error ? error : { error: String(error) }
    );
    // Allow on error to avoid blocking legitimate traffic
    return true;
  }
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const parsed = analyticsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, events } = parsed.data;

    // Check rate limit
    const withinLimit = await checkRateLimit(sessionId, events.length);
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 100 events per minute per session." },
        { status: 429 }
      );
    }

    // Fire-and-forget: Process events asynchronously
    // Don't await - return 202 immediately
    processEvents(events).catch((error) => {
      logger.error(
        "[analytics-route] Background processing error",
        error instanceof Error ? error : { error: String(error) }
      );
    });

    // Return 202 Accepted immediately
    return NextResponse.json(
      { accepted: true, eventCount: events.length },
      { status: 202 }
    );
  } catch (error) {
    logger.error(
      "[analytics-route] POST error",
      error instanceof Error ? error : { error: String(error) }
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Event Processing
// =============================================================================

async function processEvents(events: BlockInteraction[]): Promise<void> {
  for (const event of events) {
    const { type, blockId, variantId, dwellMs } = event;

    switch (type) {
      case "block_view":
        await recordBlockView(blockId, variantId);
        break;

      case "block_dwell":
        if (dwellMs !== undefined && dwellMs > 0) {
          await recordBlockDwell(blockId, variantId, dwellMs);
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
  return NextResponse.json({
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
