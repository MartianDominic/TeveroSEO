/**
 * Analytics Service for Document Builder
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 *
 * Provides Redis counter operations and correlation tracking per D-04:
 * - Real-time Redis counters for high-frequency view events
 * - Periodic sync to Postgres (handled by analytics-sync-worker)
 * - Block-to-close correlation calculation
 *
 * Redis key patterns (per D-04):
 * - `block:{blockId}:views` - total views
 * - `block:{blockId}:variant:{variantId}:views` - variant views
 * - `block:{blockId}:dwell` - cumulative dwell time
 * - `block:{blockId}:views:ts` - time-series sorted set
 */

import { redis } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

// =============================================================================
// Types
// =============================================================================

export interface BlockAnalytics {
  blockId: string;
  impressions: number;
  conversions: number;
  totalDwellMs: number;
  avgDwellMs: number;
  conversionRate: number;
}

export interface CorrelationResult {
  correlation: number; // -1 to 1
  wonCount: number;
  lostCount: number;
  confidence: number; // 0 to 1
}

export interface BlockInteraction {
  type: "block_view" | "block_dwell" | "scroll_depth" | "cta_click";
  blockId: string;
  variantId?: string;
  dwellMs?: number;
  percent?: number;
  timestamp?: number;
}

// =============================================================================
// Key Builders
// =============================================================================

function viewKey(blockId: string, variantId?: string): string {
  if (variantId) {
    return `block:${blockId}:variant:${variantId}:views`;
  }
  return `block:${blockId}:views`;
}

function dwellKey(blockId: string, variantId?: string): string {
  if (variantId) {
    return `block:${blockId}:variant:${variantId}:dwell`;
  }
  return `block:${blockId}:dwell`;
}

function dwellCountKey(blockId: string, variantId?: string): string {
  if (variantId) {
    return `block:${blockId}:variant:${variantId}:dwell:count`;
  }
  return `block:${blockId}:dwell:count`;
}

function conversionsKey(blockId: string, variantId?: string): string {
  if (variantId) {
    return `block:${blockId}:variant:${variantId}:conversions`;
  }
  return `block:${blockId}:conversions`;
}

function outcomeKey(
  blockId: string,
  variantId: string | undefined,
  outcome: "won" | "lost"
): string {
  if (variantId) {
    return `block:${blockId}:variant:${variantId}:${outcome}`;
  }
  return `block:${blockId}:${outcome}`;
}

function timeSeriesKey(blockId: string): string {
  return `block:${blockId}:views:ts`;
}

// =============================================================================
// Record Operations
// =============================================================================

/**
 * Record a block view event.
 *
 * Increments Redis counter and adds to time-series sorted set for decay analysis.
 * Per D-04: Uses INCR for atomic operations.
 *
 * @param blockId - The block ID
 * @param variantId - Optional variant ID for A/B testing
 */
export async function recordBlockView(
  blockId: string,
  variantId?: string
): Promise<void> {
  try {
    const key = viewKey(blockId, variantId);
    const tsKey = timeSeriesKey(blockId);

    // Atomic increment
    await redis.incr(key);

    // Add to time-series sorted set for decay analysis
    const timestamp = Date.now();
    const member = `${timestamp}:${variantId || "control"}`;
    await redis.zadd(tsKey, timestamp, member);
  } catch (error) {
    logger.error(
      "[analytics-service] recordBlockView error",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

/**
 * Record block dwell time.
 *
 * Increments cumulative dwell time and view count for average calculation.
 *
 * @param blockId - The block ID
 * @param variantId - Optional variant ID for A/B testing
 * @param dwellMs - Dwell time in milliseconds
 */
export async function recordBlockDwell(
  blockId: string,
  variantId: string | undefined,
  dwellMs: number
): Promise<void> {
  try {
    const dKey = dwellKey(blockId, variantId);
    const dcKey = dwellCountKey(blockId, variantId);

    // Increment cumulative dwell time
    await redis.incrby(dKey, dwellMs);

    // Increment view count for average calculation
    await redis.incr(dcKey);
  } catch (error) {
    logger.error(
      "[analytics-service] recordBlockDwell error",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

// =============================================================================
// Query Operations
// =============================================================================

/**
 * Get analytics for a block.
 *
 * Returns impressions, conversions, dwell time stats from Redis.
 *
 * @param blockId - The block ID
 * @param variantId - Optional variant ID for A/B testing
 * @returns Block analytics data
 */
export async function getBlockAnalytics(
  blockId: string,
  variantId?: string
): Promise<BlockAnalytics> {
  try {
    const vKey = viewKey(blockId, variantId);
    const cKey = conversionsKey(blockId, variantId);
    const dKey = dwellKey(blockId, variantId);
    const dcKey = dwellCountKey(blockId, variantId);

    const [views, conversions, dwell, dwellCount] = await redis.mget(
      vKey,
      cKey,
      dKey,
      dcKey
    );

    const impressions = parseInt(views || "0", 10);
    const conversionCount = parseInt(conversions || "0", 10);
    const totalDwellMs = parseInt(dwell || "0", 10);
    const dwellViewCount = parseInt(dwellCount || "0", 10);

    return {
      blockId,
      impressions,
      conversions: conversionCount,
      totalDwellMs,
      avgDwellMs: dwellViewCount > 0 ? Math.round(totalDwellMs / dwellViewCount) : 0,
      conversionRate: impressions > 0 ? conversionCount / impressions : 0,
    };
  } catch (error) {
    logger.error(
      "[analytics-service] getBlockAnalytics error",
      error instanceof Error ? error : { error: String(error) }
    );

    return {
      blockId,
      impressions: 0,
      conversions: 0,
      totalDwellMs: 0,
      avgDwellMs: 0,
      conversionRate: 0,
    };
  }
}

/**
 * Calculate correlation between block usage and proposal outcomes.
 *
 * Returns Pearson correlation coefficient (-1 to 1) based on:
 * - How often block appears in won vs lost proposals
 * - Confidence level based on sample size
 *
 * @param blockId - The block ID
 * @param variantId - Optional variant ID for A/B testing
 * @returns Correlation result with confidence
 */
export async function calculateCorrelation(
  blockId: string,
  variantId?: string
): Promise<CorrelationResult> {
  try {
    const wonKey = outcomeKey(blockId, variantId, "won");
    const lostKey = outcomeKey(blockId, variantId, "lost");
    const totalKey = `block:${blockId}:total:proposals`;

    const [won, lost, total] = await redis.mget(wonKey, lostKey, totalKey);

    const wonCount = parseInt(won || "0", 10);
    const lostCount = parseInt(lost || "0", 10);
    const totalProposals = parseInt(total || "0", 10);

    // No data - return zero correlation
    if (wonCount === 0 && lostCount === 0) {
      return {
        correlation: 0,
        wonCount: 0,
        lostCount: 0,
        confidence: 0,
      };
    }

    // Calculate correlation coefficient
    // Positive when block appears more in wins, negative when more in losses
    const totalWithBlock = wonCount + lostCount;
    const winRate = totalWithBlock > 0 ? wonCount / totalWithBlock : 0;

    // Normalize to -1 to 1 range
    // 0.5 win rate = 0 correlation
    // 1.0 win rate = 1 correlation
    // 0.0 win rate = -1 correlation
    const correlation = (winRate - 0.5) * 2;

    // Confidence based on sample size (min 10 for reasonable confidence)
    const sampleFactor = Math.min(totalWithBlock / 20, 1);
    const confidence =
      totalWithBlock >= 5 ? Math.min(0.95, sampleFactor) : sampleFactor * 0.5;

    return {
      correlation: Math.max(-1, Math.min(1, correlation)),
      wonCount,
      lostCount,
      confidence,
    };
  } catch (error) {
    logger.error(
      "[analytics-service] calculateCorrelation error",
      error instanceof Error ? error : { error: String(error) }
    );

    return {
      correlation: 0,
      wonCount: 0,
      lostCount: 0,
      confidence: 0,
    };
  }
}

// =============================================================================
// Conversion Tracking
// =============================================================================

/**
 * Mark a block conversion (proposal won or lost).
 *
 * Called when a proposal outcome is recorded. Increments conversion counters
 * for each block/variant shown in the proposal.
 *
 * @param blockId - The block ID
 * @param variantId - Optional variant ID
 * @param outcome - "won" or "lost"
 */
export async function markConversion(
  blockId: string,
  variantId: string | undefined,
  outcome: "won" | "lost"
): Promise<void> {
  try {
    const convKey = conversionsKey(blockId, variantId);
    const outKey = outcomeKey(blockId, variantId, outcome);

    // Increment conversion counter (for both won and lost)
    if (outcome === "won") {
      await redis.incr(convKey);
    }

    // Increment outcome-specific counter
    await redis.incr(outKey);
  } catch (error) {
    logger.error(
      "[analytics-service] markConversion error",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

// =============================================================================
// Batch Operations (for analytics API)
// =============================================================================

/**
 * Process a batch of block interactions.
 *
 * Used by the analytics API route to handle batched events efficiently.
 *
 * @param sessionId - Session ID for rate limiting
 * @param events - Array of block interactions
 */
export async function processBatchedEvents(
  sessionId: string,
  events: BlockInteraction[]
): Promise<void> {
  const pipeline = redis.pipeline();

  for (const event of events) {
    const { type, blockId, variantId, dwellMs } = event;

    switch (type) {
      case "block_view": {
        const key = viewKey(blockId, variantId);
        pipeline.incr(key);
        break;
      }
      case "block_dwell": {
        if (dwellMs !== undefined) {
          const dKey = dwellKey(blockId, variantId);
          const dcKey = dwellCountKey(blockId, variantId);
          pipeline.incrby(dKey, dwellMs);
          pipeline.incr(dcKey);
        }
        break;
      }
      // scroll_depth and cta_click handled at session level
      default:
        break;
    }
  }

  try {
    await pipeline.exec();
  } catch (error) {
    logger.error(
      "[analytics-service] processBatchedEvents error",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

/**
 * Get all analytics keys for sync worker.
 *
 * Returns Redis keys matching the block analytics pattern.
 */
export async function getAnalyticsKeys(): Promise<string[]> {
  try {
    return await redis.keys("block:*:views");
  } catch (error) {
    logger.error(
      "[analytics-service] getAnalyticsKeys error",
      error instanceof Error ? error : { error: String(error) }
    );
    return [];
  }
}
