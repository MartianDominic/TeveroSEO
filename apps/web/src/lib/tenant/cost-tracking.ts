/**
 * Per-Tenant Cost Attribution Module
 * Tracks API usage costs per client/workspace for billing and monitoring.
 *
 * Features:
 * 1. Per-operation cost recording
 * 2. Aggregation by time period (hourly, daily, monthly)
 * 3. Cost forecasting based on usage patterns
 * 4. Billing integration points
 */

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis/client";

import { getTenantContextOrNull, TenantContext } from "./context";

// --- Types ---

/**
 * Cost operation types that can be tracked.
 */
export type CostOperationType =
  | "chat_message"
  | "content_generation"
  | "seo_audit"
  | "keyword_analysis"
  | "serp_api"
  | "gsc_api"
  | "export"
  | "image_generation";

/**
 * Cost entry for a single operation.
 */
export interface CostEntry {
  /** Operation type */
  operation: CostOperationType;
  /** Cost in microdollars (1/1,000,000 of a dollar) */
  costMicros: number;
  /** Input tokens consumed (for LLM operations) */
  inputTokens?: number;
  /** Output tokens consumed (for LLM operations) */
  outputTokens?: number;
  /** Model used (for LLM operations) */
  model?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp of the operation */
  timestamp: number;
}

/**
 * Aggregated cost summary.
 */
export interface CostSummary {
  /** Total cost in microdollars */
  totalCostMicros: number;
  /** Total cost in dollars (formatted) */
  totalCostDollars: string;
  /** Breakdown by operation type */
  byOperation: Record<CostOperationType, number>;
  /** Number of operations */
  operationCount: number;
  /** Time period start */
  periodStart: number;
  /** Time period end */
  periodEnd: number;
}

// --- Cost Configuration ---

/**
 * Cost rates per operation type (in microdollars).
 * Based on current API pricing.
 */
export const COST_RATES_MICROS: Record<CostOperationType, number> = {
  // Chat: ~$0.001 per message (Grok 4.1 Fast)
  chat_message: 1000,
  // Content generation: ~$0.05 per article (Gemini 3.1 Pro)
  content_generation: 50000,
  // SEO audit: ~$0.10 per audit (includes crawling + analysis)
  seo_audit: 100000,
  // Keyword analysis: ~$0.02 per analysis
  keyword_analysis: 20000,
  // SERP API: ~$0.005 per query (DataForSEO)
  serp_api: 5000,
  // GSC API: ~$0.001 per query (Google API costs)
  gsc_api: 1000,
  // Export: ~$0.01 per export
  export: 10000,
  // Image generation: ~$0.02 per image
  image_generation: 20000,
};

// --- Redis Keys ---

/**
 * Redis key patterns for cost tracking.
 */
const COST_KEY_PREFIX = "tenant:cost";

function getCostListKey(
  workspaceId: string,
  clientId: string | undefined,
  period: "hourly" | "daily"
): string {
  const scope = clientId || "workspace";
  const date = new Date();
  const periodKey =
    period === "hourly"
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCHours()).padStart(2, "0")}`
      : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return `${COST_KEY_PREFIX}:${workspaceId}:${scope}:${period}:${periodKey}`;
}

function getCostAggregateKey(
  workspaceId: string,
  clientId: string | undefined,
  period: "daily" | "monthly"
): string {
  const scope = clientId || "workspace";
  const date = new Date();
  const periodKey =
    period === "daily"
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
      : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${COST_KEY_PREFIX}:agg:${workspaceId}:${scope}:${period}:${periodKey}`;
}

// --- Cost Recording ---

/**
 * Record a cost entry for the current tenant context.
 * Uses tenant context if available, or explicit IDs if provided.
 *
 * @param operation - Type of operation
 * @param options - Optional overrides and metadata
 */
export async function recordCost(
  operation: CostOperationType,
  options?: {
    workspaceId?: string;
    clientId?: string;
    costMicros?: number;
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const tenant = getTenantContextOrNull();
  const workspaceId = options?.workspaceId || tenant?.workspaceId;
  const clientId = options?.clientId || tenant?.clientId;

  if (!workspaceId) {
    logger.warn("[cost-tracking] Cannot record cost without workspace context");
    return;
  }

  const costMicros = options?.costMicros ?? COST_RATES_MICROS[operation];

  const entry: CostEntry = {
    operation,
    costMicros,
    inputTokens: options?.inputTokens,
    outputTokens: options?.outputTokens,
    model: options?.model,
    metadata: options?.metadata,
    timestamp: Date.now(),
  };

  try {
    // Record to hourly list (for detailed tracking)
    const hourlyKey = getCostListKey(workspaceId, clientId, "hourly");
    await redis.rpush(hourlyKey, JSON.stringify(entry));
    await redis.expire(hourlyKey, 86400 * 7); // Keep 7 days of hourly data

    // Update daily aggregate
    const dailyAggKey = getCostAggregateKey(workspaceId, clientId, "daily");
    await redis.hincrby(dailyAggKey, "total", costMicros);
    await redis.hincrby(dailyAggKey, `op:${operation}`, costMicros);
    await redis.hincrby(dailyAggKey, "count", 1);
    await redis.expire(dailyAggKey, 86400 * 90); // Keep 90 days

    // Update monthly aggregate
    const monthlyAggKey = getCostAggregateKey(workspaceId, clientId, "monthly");
    await redis.hincrby(monthlyAggKey, "total", costMicros);
    await redis.hincrby(monthlyAggKey, `op:${operation}`, costMicros);
    await redis.hincrby(monthlyAggKey, "count", 1);
    await redis.expire(monthlyAggKey, 86400 * 400); // Keep ~13 months

    logger.debug("[cost-tracking] Recorded cost", {
      workspaceId,
      clientId,
      operation,
      costMicros,
    });
  } catch (error) {
    // Cost tracking failure should not break the main operation
    logger.error(
      "[cost-tracking] Failed to record cost",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

/**
 * Record cost based on token usage for LLM operations.
 *
 * @param operation - Type of operation
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - Model name
 */
export async function recordLLMCost(
  operation: CostOperationType,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<void> {
  // Cost per 1M tokens in microdollars
  const modelRates: Record<string, { input: number; output: number }> = {
    "grok-4.1-fast": { input: 200000, output: 200000 }, // $0.20/1M
    "grok-4.1-thinking": { input: 2000000, output: 2000000 }, // $2.00/1M
    "gemini-3.1-pro": { input: 1250000, output: 1250000 }, // $1.25/1M
    "claude-sonnet-4-6": { input: 3000000, output: 3000000 }, // $3.00/1M
  };

  const rates = modelRates[model] || { input: 1000000, output: 1000000 };
  const costMicros = Math.ceil(
    (inputTokens * rates.input + outputTokens * rates.output) / 1000000
  );

  await recordCost(operation, {
    costMicros,
    inputTokens,
    outputTokens,
    model,
  });
}

// --- Cost Retrieval ---

/**
 * Get cost summary for a tenant for a given period.
 *
 * @param workspaceId - Workspace ID
 * @param clientId - Optional client ID for client-scoped costs
 * @param period - Time period ('daily' or 'monthly')
 * @returns Cost summary
 */
export async function getCostSummary(
  workspaceId: string,
  clientId: string | undefined,
  period: "daily" | "monthly"
): Promise<CostSummary> {
  const aggKey = getCostAggregateKey(workspaceId, clientId, period);
  const now = Date.now();

  try {
    const data = await redis.hgetall(aggKey);

    if (!data || Object.keys(data).length === 0) {
      return {
        totalCostMicros: 0,
        totalCostDollars: "$0.00",
        byOperation: {} as Record<CostOperationType, number>,
        operationCount: 0,
        periodStart: getPeriodStart(period),
        periodEnd: now,
      };
    }

    const totalCostMicros = parseInt(data.total || "0", 10);
    const operationCount = parseInt(data.count || "0", 10);

    // Extract per-operation costs
    const byOperation: Record<CostOperationType, number> = {} as Record<
      CostOperationType,
      number
    >;
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("op:")) {
        const operation = key.substring(3) as CostOperationType;
        byOperation[operation] = parseInt(value, 10);
      }
    }

    return {
      totalCostMicros,
      totalCostDollars: formatCostDollars(totalCostMicros),
      byOperation,
      operationCount,
      periodStart: getPeriodStart(period),
      periodEnd: now,
    };
  } catch (error) {
    logger.error(
      "[cost-tracking] Failed to get cost summary",
      error instanceof Error ? error : { error: String(error) }
    );
    return {
      totalCostMicros: 0,
      totalCostDollars: "$0.00",
      byOperation: {} as Record<CostOperationType, number>,
      operationCount: 0,
      periodStart: getPeriodStart(period),
      periodEnd: now,
    };
  }
}

/**
 * Get cost summary for the current tenant context.
 */
export async function getCurrentTenantCostSummary(
  period: "daily" | "monthly"
): Promise<CostSummary | null> {
  const tenant = getTenantContextOrNull();
  if (!tenant) {
    return null;
  }
  return getCostSummary(tenant.workspaceId, tenant.clientId, period);
}

// --- Cost Forecasting ---

/**
 * Estimate monthly cost based on current usage patterns.
 *
 * @param workspaceId - Workspace ID
 * @param clientId - Optional client ID
 * @returns Projected monthly cost in microdollars
 */
export async function forecastMonthlyCost(
  workspaceId: string,
  clientId?: string
): Promise<{
  projectedCostMicros: number;
  projectedCostDollars: string;
  daysInPeriod: number;
  daysRemaining: number;
  currentCostMicros: number;
}> {
  const monthSummary = await getCostSummary(workspaceId, clientId, "monthly");
  const now = new Date();
  const daysInMonth = new Date(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    0
  ).getDate();
  const dayOfMonth = now.getUTCDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  // Calculate daily average and project forward
  const dailyAverage = monthSummary.totalCostMicros / dayOfMonth;
  const projectedCostMicros = Math.round(dailyAverage * daysInMonth);

  return {
    projectedCostMicros,
    projectedCostDollars: formatCostDollars(projectedCostMicros),
    daysInPeriod: daysInMonth,
    daysRemaining,
    currentCostMicros: monthSummary.totalCostMicros,
  };
}

// --- Billing Integration ---

/**
 * Get all clients' cost data for a workspace (for billing).
 *
 * @param workspaceId - Workspace ID
 * @param period - Time period
 * @returns Map of client ID to cost summary
 */
export async function getWorkspaceBillingData(
  workspaceId: string,
  period: "daily" | "monthly"
): Promise<Map<string, CostSummary>> {
  const results = new Map<string, CostSummary>();

  try {
    // Find all client cost keys for this workspace
    const pattern = `${COST_KEY_PREFIX}:agg:${workspaceId}:*:${period}:*`;
    const keys = await redis.keys(pattern);

    for (const key of keys) {
      // Extract client ID from key
      const parts = key.split(":");
      const clientId = parts[4]; // tenant:cost:agg:{workspaceId}:{clientId}:{period}:{periodKey}

      if (clientId && !results.has(clientId)) {
        const summary = await getCostSummary(workspaceId, clientId, period);
        results.set(clientId, summary);
      }
    }

    return results;
  } catch (error) {
    logger.error(
      "[cost-tracking] Failed to get workspace billing data",
      error instanceof Error ? error : { error: String(error) }
    );
    return results;
  }
}

/**
 * Persist cost data to database for permanent storage.
 * Should be called periodically (e.g., end of day/month).
 *
 * @param workspaceId - Workspace ID
 * @param clientId - Client ID
 * @param period - Period type
 * @param summary - Cost summary to persist
 */
export async function persistCostToDatabase(
  workspaceId: string,
  clientId: string | undefined,
  period: "daily" | "monthly",
  summary: CostSummary
): Promise<void> {
  // Import dynamically to avoid circular dependencies
  const { db } = await import("@/lib/db");
  const { apiCosts } = await import("@/lib/db/schema");

  try {
    // Convert microdollars to cents for database storage
    const costCents = Math.ceil(summary.totalCostMicros / 10000);

    await db.insert(apiCosts).values({
      workspaceId,
      service: "aggregate",
      operation: `${period}_total`,
      inputTokens: 0,
      outputTokens: 0,
      costCents,
      metadata: JSON.stringify({
        period,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        operationCount: summary.operationCount,
        byOperation: summary.byOperation,
        clientId,
      }),
    });

    logger.info("[cost-tracking] Persisted cost to database", {
      workspaceId,
      clientId,
      period,
      costCents,
    });
  } catch (error) {
    logger.error(
      "[cost-tracking] Failed to persist cost to database",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

// --- Helper Functions ---

/**
 * Format microdollars as a dollar string.
 */
function formatCostDollars(micros: number): string {
  const dollars = micros / 1000000;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Get the start of the current period.
 */
function getPeriodStart(period: "daily" | "monthly"): number {
  const now = new Date();
  if (period === "daily") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).getTime();
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).getTime();
}

/**
 * Create a cost tracking wrapper for tenant-scoped operations.
 * Automatically records cost when the operation completes.
 *
 * @param operation - Cost operation type
 * @param fn - Function to run
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const result = await withCostTracking('content_generation', async () => {
 *   return await generateContent(prompt);
 * });
 * ```
 */
export async function withCostTracking<T>(
  operation: CostOperationType,
  fn: () => Promise<T>,
  options?: {
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();

    // Record cost after successful completion
    await recordCost(operation, {
      metadata: {
        ...options?.metadata,
        durationMs: Date.now() - startTime,
      },
    });

    return result;
  } catch (error) {
    // Still record cost for failed operations (resources were consumed)
    await recordCost(operation, {
      metadata: {
        ...options?.metadata,
        durationMs: Date.now() - startTime,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
