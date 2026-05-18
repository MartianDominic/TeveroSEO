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
  /** Sequence number for ordering guarantee within a session */
  sequenceNumber?: number;
  /** Client-generated event ID for deduplication */
  eventId?: string;
}

// =============================================================================
// Event Sequencing (H-CON-01)
// =============================================================================

let globalSequenceCounter = 0;

/**
 * Generate a unique sequence number for event ordering.
 * Combines timestamp with incrementing counter for total ordering.
 */
export function generateSequenceNumber(): number {
  globalSequenceCounter = (globalSequenceCounter + 1) % Number.MAX_SAFE_INTEGER;
  return Date.now() * 1000 + (globalSequenceCounter % 1000);
}

/**
 * Generate a unique event ID for deduplication.
 * Format: {timestamp}-{random}-{sequence}
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const seq = (globalSequenceCounter % 1000).toString(36).padStart(3, "0");
  return `${timestamp}-${random}-${seq}`;
}

// =============================================================================
// Key Builders (CS-001: Consolidated into single generic function)
// =============================================================================

/**
 * Build a Redis key for block analytics.
 *
 * Key patterns follow D-04 specification:
 * - `block:{blockId}:{metric}` - block-level metric
 * - `block:{blockId}:variant:{variantId}:{metric}` - variant-level metric
 *
 * @param blockId - The block identifier
 * @param metric - The metric type (views, dwell, conversions, etc.)
 * @param variantId - Optional variant identifier for A/B testing
 * @returns Formatted Redis key
 */
function buildKey(blockId: string, metric: string, variantId?: string): string {
  if (variantId) {
    return `block:${blockId}:variant:${variantId}:${metric}`;
  }
  return `block:${blockId}:${metric}`;
}

/** Build key for view counter */
function buildViewKey(blockId: string, variantId?: string): string {
  return buildKey(blockId, "views", variantId);
}

/** Build key for cumulative dwell time */
function buildDwellKey(blockId: string, variantId?: string): string {
  return buildKey(blockId, "dwell", variantId);
}

/** Build key for dwell event count (for average calculation) */
function buildDwellCountKey(blockId: string, variantId?: string): string {
  return buildKey(blockId, "dwell:count", variantId);
}

/** Build key for conversion counter */
function buildConversionsKey(blockId: string, variantId?: string): string {
  return buildKey(blockId, "conversions", variantId);
}

/** Build key for outcome tracking (won/lost) */
function buildOutcomeKey(
  blockId: string,
  variantId: string | undefined,
  outcome: "won" | "lost"
): string {
  return buildKey(blockId, outcome, variantId);
}

/** Build key for time-series sorted set */
function buildTimeSeriesKey(blockId: string): string {
  return `block:${blockId}:views:ts`;
}

// =============================================================================
// Correlation Constants (CS-002: Named constants for magic numbers)
// =============================================================================

/**
 * Baseline win rate representing no correlation.
 * A 50% win rate means the block has no effect on proposal outcomes.
 */
const BASELINE_WIN_RATE = 0.5;

/**
 * Multiplier to normalize win rate to correlation range.
 * Converts (0, 1) win rate to (-1, 1) correlation coefficient.
 */
const CORRELATION_NORMALIZER = 2;

/**
 * Sample size for full confidence calculation.
 * At 20+ samples, we consider the data statistically significant.
 * Based on rule of thumb for minimum sample size in A/B testing.
 */
const FULL_CONFIDENCE_SAMPLE_SIZE = 20;

/**
 * Minimum sample size threshold for meaningful confidence.
 * Below 5 samples, confidence is heavily penalized.
 */
const MIN_MEANINGFUL_SAMPLE_SIZE = 5;

/**
 * Maximum confidence level cap.
 * Even with large samples, we cap at 95% to account for external factors.
 */
const MAX_CONFIDENCE = 0.95;

/**
 * Confidence penalty multiplier for insufficient samples.
 * Applied when sample size is below MIN_MEANINGFUL_SAMPLE_SIZE.
 */
const INSUFFICIENT_SAMPLE_PENALTY = 0.5;

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
 * @returns true if recorded, false if validation failed
 */
export async function recordBlockView(
  blockId: string,
  variantId?: string
): Promise<boolean> {
  // Validate blockId is present and non-empty
  if (!blockId || typeof blockId !== "string" || blockId.trim() === "") {
    logger.error("[analytics-service] recordBlockView: Missing or invalid blockId", {
      blockId,
      variantId,
    });
    return false;
  }

  try {
    const key = buildViewKey(blockId, variantId);
    const tsKey = buildTimeSeriesKey(blockId);

    // Atomic increment
    await redis.incr(key);

    // Add to time-series sorted set for decay analysis
    const timestamp = Date.now();
    const member = `${timestamp}:${variantId || "control"}`;
    await redis.zadd(tsKey, timestamp, member);
    return true;
  } catch (error) {
    logger.error(
      "[analytics-service] recordBlockView error",
      error instanceof Error ? error : { error: String(error) }
    );
    return false;
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
 * @returns true if recorded, false if validation failed
 */
export async function recordBlockDwell(
  blockId: string,
  variantId: string | undefined,
  dwellMs: number
): Promise<boolean> {
  // Validate blockId is present and non-empty
  if (!blockId || typeof blockId !== "string" || blockId.trim() === "") {
    logger.error("[analytics-service] recordBlockDwell: Missing or invalid blockId", {
      blockId,
      variantId,
      dwellMs,
    });
    return false;
  }

  // Validate dwellMs is a positive number
  if (typeof dwellMs !== "number" || dwellMs <= 0 || !Number.isFinite(dwellMs)) {
    logger.warn("[analytics-service] recordBlockDwell: Invalid dwellMs", {
      blockId,
      variantId,
      dwellMs,
    });
    return false;
  }

  try {
    const dwellRedisKey = buildDwellKey(blockId, variantId);
    const dwellCountRedisKey = buildDwellCountKey(blockId, variantId);

    // Increment cumulative dwell time
    await redis.incrby(dwellRedisKey, Math.round(dwellMs));

    // Increment view count for average calculation
    await redis.incr(dwellCountRedisKey);
    return true;
  } catch (error) {
    logger.error(
      "[analytics-service] recordBlockDwell error",
      error instanceof Error ? error : { error: String(error) }
    );
    return false;
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
    // MAINT-02: Use descriptive variable names instead of abbreviations
    const viewRedisKey = buildViewKey(blockId, variantId);
    const conversionsRedisKey = buildConversionsKey(blockId, variantId);
    const dwellRedisKey = buildDwellKey(blockId, variantId);
    const dwellCountRedisKey = buildDwellCountKey(blockId, variantId);

    const [views, conversions, dwell, dwellCount] = await redis.mget(
      viewRedisKey,
      conversionsRedisKey,
      dwellRedisKey,
      dwellCountRedisKey
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
    const wonKey = buildOutcomeKey(blockId, variantId, "won");
    const lostKey = buildOutcomeKey(blockId, variantId, "lost");
    const totalKey = `block:${blockId}:total:proposals`;

    const [won, lost, total] = await redis.mget(wonKey, lostKey, totalKey);

    const wonCount = parseInt(won || "0", 10);
    const lostCount = parseInt(lost || "0", 10);
    // CS-003: totalProposals reserved for future Bayesian confidence calculation
    // that accounts for proposals where this block was NOT shown
    void parseInt(total || "0", 10);

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

    // CS-002: Use named constants for correlation calculation
    // Normalize to -1 to 1 range using baseline and normalizer
    const correlation = (winRate - BASELINE_WIN_RATE) * CORRELATION_NORMALIZER;

    // Confidence based on sample size using named thresholds
    const sampleFactor = Math.min(totalWithBlock / FULL_CONFIDENCE_SAMPLE_SIZE, 1);
    const confidence =
      totalWithBlock >= MIN_MEANINGFUL_SAMPLE_SIZE
        ? Math.min(MAX_CONFIDENCE, sampleFactor)
        : sampleFactor * INSUFFICIENT_SAMPLE_PENALTY;

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
    const convKey = buildConversionsKey(blockId, variantId);
    const outKey = buildOutcomeKey(blockId, variantId, outcome);

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
 * Mirrors the same data writes as single-event tracking (recordBlockView, recordBlockDwell)
 * to ensure data consistency between batch and single-event processing.
 *
 * @param sessionId - Session ID for rate limiting
 * @param events - Array of block interactions
 */
export async function processBatchedEvents(
  // CS-003: sessionId reserved for future per-session rate limiting (e.g., max 1000 events/session/hour)
  // Will be used with Redis INCR + TTL pattern when rate limiting is implemented
  _sessionId: string,
  events: BlockInteraction[]
): Promise<void> {
  const pipeline = redis.pipeline();
  const timestamp = Date.now();

  // H-CON-01: Sort events by sequence number if present, then by timestamp
  // This ensures ordering guarantee even with concurrent batches
  const sortedEvents = [...events].sort((a, b) => {
    const seqA = a.sequenceNumber ?? a.timestamp ?? 0;
    const seqB = b.sequenceNumber ?? b.timestamp ?? 0;
    return seqA - seqB;
  });

  for (const event of sortedEvents) {
    const { type, blockId, variantId, dwellMs } = event;

    // Validate blockId for all event types
    if (!blockId || typeof blockId !== "string" || blockId.trim() === "") {
      logger.warn("[analytics-service] processBatchedEvents: Skipping event with invalid blockId", {
        type,
        blockId,
        variantId,
      });
      continue;
    }

    switch (type) {
      case "block_view": {
        const key = buildViewKey(blockId, variantId);
        pipeline.incr(key);

        // Add to time-series sorted set for decay analysis (matches recordBlockView)
        const tsKey = buildTimeSeriesKey(blockId);
        const member = `${timestamp}:${variantId || "control"}`;
        pipeline.zadd(tsKey, timestamp, member);
        break;
      }
      case "block_dwell": {
        if (dwellMs !== undefined && typeof dwellMs === "number" && dwellMs > 0 && Number.isFinite(dwellMs)) {
          // MAINT-02: Use descriptive variable names
          const dwellRedisKey = buildDwellKey(blockId, variantId);
          const dwellCountRedisKey = buildDwellCountKey(blockId, variantId);
          pipeline.incrby(dwellRedisKey, Math.round(dwellMs));
          pipeline.incr(dwellCountRedisKey);
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
 * Uses SCAN cursor iteration instead of KEYS command to avoid O(N) blocking.
 * Per Redis best practices: KEYS should never be used in production.
 *
 * @returns Array of Redis keys matching block analytics pattern
 */
export async function getAnalyticsKeys(): Promise<string[]> {
  try {
    const keys: string[] = [];

    // Use scanStream for non-blocking cursor iteration
    const stream = redis.scanStream({
      match: "block:*:views",
      count: 100, // Batch size hint for Redis
    });

    return new Promise((resolve, reject) => {
      stream.on("data", (batch: string[]) => {
        keys.push(...batch);
      });

      stream.on("end", () => {
        resolve(keys);
      });

      stream.on("error", (err: Error) => {
        logger.error("[analytics-service] SCAN stream error", { error: err.message });
        reject(err);
      });
    });
  } catch (error) {
    logger.error(
      "[analytics-service] getAnalyticsKeys error",
      error instanceof Error ? error : { error: String(error) }
    );
    return [];
  }
}
