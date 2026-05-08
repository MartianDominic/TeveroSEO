/**
 * Universal Budget Pre-Check Wrapper
 * Phase 95: COST-1 - Budget Enforcement for All DataForSEO API Calls
 *
 * Ensures budget enforcement applies to ALL DataForSEO API calls,
 * including direct API calls that bypass ScrapingService.
 *
 * Usage:
 * ```typescript
 * import { withBudgetCheck } from '@/server/features/scraping/providers/withBudgetCheck';
 *
 * // Wrap any DataForSEO API call
 * const response = await withBudgetCheck(
 *   () => fetchLiveSerpItemsRaw(keyword, options),
 *   0.002, // SERP API cost
 *   { workspaceId: options.workspaceId }
 * );
 * ```
 */

import { getDfsBudgetMonitor, type BudgetConfig } from "./DfsBudgetMonitor";
import type { DbClient } from "@/db";

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when DataForSEO budget is exceeded.
 * Callers should handle this error gracefully (e.g., queue for later, notify user).
 */
export class BudgetExceededError extends Error {
  /** Budget type that was exceeded */
  readonly budgetType: "daily" | "monthly" | "both";

  /** Current spend at time of rejection */
  readonly currentSpend: number;

  /** Budget limit that was exceeded */
  readonly budgetLimit: number;

  /** Workspace ID if workspace-specific budget */
  readonly workspaceId?: string;

  constructor(options: {
    budgetType: "daily" | "monthly" | "both";
    currentSpend: number;
    budgetLimit: number;
    workspaceId?: string;
  }) {
    const { budgetType, currentSpend, budgetLimit, workspaceId } = options;
    const scope = workspaceId ? `workspace ${workspaceId}` : "global";
    super(
      `DataForSEO ${budgetType} budget exceeded for ${scope}: ` +
        `$${currentSpend.toFixed(2)} / $${budgetLimit.toFixed(2)}`
    );
    this.name = "BudgetExceededError";
    this.budgetType = budgetType;
    this.currentSpend = currentSpend;
    this.budgetLimit = budgetLimit;
    this.workspaceId = workspaceId;
  }
}

// =============================================================================
// Budget Check Options
// =============================================================================

/**
 * Options for budget check wrapper.
 */
export interface BudgetCheckOptions {
  /** Workspace ID for workspace-specific budgets (optional) */
  workspaceId?: string;

  /** Whether to enforce hard limits (default: true if env DFS_ENFORCE_HARD_LIMIT is set) */
  enforceHardLimit?: boolean;

  /** Custom budget config (optional - uses env defaults if not provided) */
  budgetConfig?: Partial<BudgetConfig>;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Check if hard limit enforcement is enabled.
 * Defaults to true for production safety.
 */
function isHardLimitEnforced(): boolean {
  const envValue = process.env.DFS_ENFORCE_HARD_LIMIT;
  // Default to true if not explicitly set to 'false'
  return envValue !== "false";
}

// =============================================================================
// Main Wrapper Function
// =============================================================================

/**
 * Wrap a DataForSEO API call with budget pre-check.
 *
 * This function checks if the estimated cost would exceed budget limits
 * BEFORE executing the API call. If budget would be exceeded and hard
 * limits are enforced, throws BudgetExceededError.
 *
 * @param fn - Async function that makes the DataForSEO API call
 * @param estimatedCost - Estimated cost in USD for this API call
 * @param db - Database client for budget monitoring
 * @param options - Optional budget check configuration
 * @returns Result of the wrapped function
 * @throws BudgetExceededError if budget would be exceeded
 *
 * @example
 * ```typescript
 * // SERP API call with budget check
 * const response = await withBudgetCheck(
 *   () => fetchLiveSerpItemsRaw(keyword, locationCode, languageCode),
 *   0.002, // SERP API cost
 *   db,
 *   { workspaceId: 'ws-123' }
 * );
 *
 * // Labs API batch call with budget check
 * const metrics = await withBudgetCheck(
 *   () => fetchKeywordMetrics(keywords, location, language),
 *   0.0005 * keywords.length, // Cost per keyword
 *   db,
 *   { workspaceId }
 * );
 * ```
 */
export async function withBudgetCheck<T>(
  fn: () => Promise<T>,
  estimatedCost: number,
  db: DbClient,
  options?: BudgetCheckOptions
): Promise<T> {
  const { workspaceId, enforceHardLimit, budgetConfig } = options ?? {};

  // Determine if we should enforce hard limits
  const shouldEnforce = enforceHardLimit ?? isHardLimitEnforced();

  // If not enforcing hard limits, just execute the function
  if (!shouldEnforce) {
    return fn();
  }

  // Get budget monitor with workspace-specific config if provided
  const monitorConfig: Partial<BudgetConfig> = {
    ...budgetConfig,
    workspaceId,
    enforceHardLimit: true, // Always enforce when checking
  };

  const monitor = getDfsBudgetMonitor(db, monitorConfig);

  // Check if request should be allowed
  const canProceed = await monitor.shouldAllowRequest(estimatedCost);

  if (!canProceed) {
    // Get current budget status for error details
    const status = await monitor.getBudgetStatus();

    // Determine which budget(s) are exceeded
    let budgetType: "daily" | "monthly" | "both";
    let currentSpend: number;
    let budgetLimit: number;

    if (status.isOverDailyBudget && status.isOverMonthlyBudget) {
      budgetType = "both";
      currentSpend = status.dailySpend;
      budgetLimit = status.dailyLimit;
    } else if (status.isOverDailyBudget) {
      budgetType = "daily";
      currentSpend = status.dailySpend;
      budgetLimit = status.dailyLimit;
    } else {
      budgetType = "monthly";
      currentSpend = status.monthlySpend;
      budgetLimit = status.monthlyLimit;
    }

    throw new BudgetExceededError({
      budgetType,
      currentSpend,
      budgetLimit,
      workspaceId,
    });
  }

  // Budget check passed - execute the function
  return fn();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Check if a request would exceed budget without executing anything.
 * Useful for pre-flight checks before queuing expensive operations.
 *
 * @param estimatedCost - Estimated cost in USD
 * @param db - Database client
 * @param workspaceId - Optional workspace ID
 * @returns Object with canProceed flag and budget status
 */
export async function checkBudgetAvailable(
  estimatedCost: number,
  db: DbClient,
  workspaceId?: string
): Promise<{
  canProceed: boolean;
  dailyRemaining: number;
  monthlyRemaining: number;
  dailyUsagePercent: number;
  monthlyUsagePercent: number;
}> {
  const monitor = getDfsBudgetMonitor(db, {
    workspaceId,
    enforceHardLimit: true,
  });

  const status = await monitor.getBudgetStatus();
  const canProceed = await monitor.shouldAllowRequest(estimatedCost);

  return {
    canProceed,
    dailyRemaining: Math.max(0, status.dailyLimit - status.dailySpend),
    monthlyRemaining: Math.max(0, status.monthlyLimit - status.monthlySpend),
    dailyUsagePercent: status.dailyUsagePercent,
    monthlyUsagePercent: status.monthlyUsagePercent,
  };
}

/**
 * Estimate the cost for a batch of operations.
 * Useful for planning batch sizes within budget.
 *
 * @param operationCount - Number of operations
 * @param costPerOperation - Cost per operation in USD
 * @returns Total estimated cost
 */
export function estimateBatchCost(
  operationCount: number,
  costPerOperation: number
): number {
  return operationCount * costPerOperation;
}

// =============================================================================
// Cost Constants (re-exported from centralized pricing)
// =============================================================================

/**
 * Common DataForSEO API costs for budget estimation.
 * Re-exported from the centralized pricing module.
 * @see src/server/features/scraping/cost/dfs-pricing.ts
 */
export { DFS_API_COSTS } from "../cost";
