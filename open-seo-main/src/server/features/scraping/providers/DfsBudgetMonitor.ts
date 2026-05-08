/**
 * DataForSEO Budget Monitor
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Monitors DataForSEO spending against configured budgets:
 * - Daily and monthly budget limits
 * - Configurable alert thresholds (50%, 80%, 95%, 100%)
 * - Webhook and email alert delivery
 * - Rate-limited alerts (once per threshold per day)
 * - Hard budget enforcement option
 */

import { eq, sql, and, gte, desc } from "drizzle-orm";
import type { DbClient } from "@/db";
import {
  dfsCostRecords,
  dfsBudgetAlerts,
  DEFAULT_DFS_BUDGET_CONFIG,
  type DfsBudgetAlertInsert,
} from "@/db/dfs-cost-tracking-schema";
import type { DfsBudgetStatus } from "./DataForSEOFetcher.types";
import { Redis } from "ioredis";
import { dfsBudgetLogger } from "../logging";

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Budget configuration.
 */
export interface BudgetConfig {
  /** Daily budget limit in USD */
  dailyLimit: number;

  /** Monthly budget limit in USD */
  monthlyLimit: number;

  /** Alert thresholds (percentages, 0-1) */
  alertThresholds: readonly number[];

  /** Webhook URL for alerts (optional) */
  alertWebhookUrl?: string;

  /** Email addresses for alerts (optional) */
  alertEmails?: string[];

  /** Whether to hard-block requests when budget exceeded */
  enforceHardLimit?: boolean;

  /** Workspace ID for workspace-specific budgets (optional) */
  workspaceId?: string;
}

/**
 * Alert event data.
 */
export interface BudgetAlert {
  type: "daily" | "monthly";
  threshold: number;
  thresholdPercent: number;
  currentSpend: number;
  limit: number;
  workspaceId?: string;
  timestamp: Date;
}

// =============================================================================
// Budget Monitor Class
// =============================================================================

/**
 * Monitors DataForSEO spending and sends alerts.
 */
export class DfsBudgetMonitor {
  private readonly config: BudgetConfig;
  private readonly db: DbClient;
  private readonly redis?: Redis;

  constructor(
    db: DbClient,
    config?: Partial<BudgetConfig>,
    redis?: Redis
  ) {
    this.db = db;
    this.redis = redis;

    // Merge with defaults
    this.config = {
      dailyLimit: config?.dailyLimit ?? parseFloat(process.env.DFS_DAILY_BUDGET ?? String(DEFAULT_DFS_BUDGET_CONFIG.dailyLimit)),
      monthlyLimit: config?.monthlyLimit ?? parseFloat(process.env.DFS_MONTHLY_BUDGET ?? String(DEFAULT_DFS_BUDGET_CONFIG.monthlyLimit)),
      alertThresholds: config?.alertThresholds ?? DEFAULT_DFS_BUDGET_CONFIG.alertThresholds,
      alertWebhookUrl: config?.alertWebhookUrl ?? process.env.DFS_ALERT_WEBHOOK_URL,
      alertEmails: config?.alertEmails ?? parseAlertEmails(process.env.DFS_ALERT_EMAILS),
      enforceHardLimit: config?.enforceHardLimit ?? false,
      workspaceId: config?.workspaceId,
    };
  }

  /**
   * Check current budget status and send alerts if thresholds crossed.
   *
   * @returns Budget status
   */
  async checkBudget(): Promise<DfsBudgetStatus> {
    const status = await this.getBudgetStatus();

    // Check and send alerts for crossed thresholds
    for (const threshold of this.config.alertThresholds) {
      if (status.dailyUsagePercent >= threshold) {
        await this.sendAlertIfNeeded("daily", threshold, status);
      }
      if (status.monthlyUsagePercent >= threshold) {
        await this.sendAlertIfNeeded("monthly", threshold, status);
      }
    }

    return status;
  }

  /**
   * Get current budget status without sending alerts.
   *
   * @returns Budget status
   */
  async getBudgetStatus(): Promise<DfsBudgetStatus> {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Build conditions
    const dailyConditions = [sql`date(${dfsCostRecords.createdAt}) = ${today}`];
    const monthlyConditions = [gte(dfsCostRecords.createdAt, monthStart)];

    if (this.config.workspaceId) {
      dailyConditions.push(eq(dfsCostRecords.workspaceId, this.config.workspaceId));
      monthlyConditions.push(eq(dfsCostRecords.workspaceId, this.config.workspaceId));
    }

    // Get daily spend
    const [dailyResult] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(and(...dailyConditions));

    // Get monthly spend
    const [monthlyResult] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(and(...monthlyConditions));

    const dailySpend = dailyResult?.total ?? 0;
    const monthlySpend = monthlyResult?.total ?? 0;

    return {
      dailySpend,
      dailyLimit: this.config.dailyLimit,
      dailyUsagePercent: dailySpend / this.config.dailyLimit,
      monthlySpend,
      monthlyLimit: this.config.monthlyLimit,
      monthlyUsagePercent: monthlySpend / this.config.monthlyLimit,
      isOverDailyBudget: dailySpend >= this.config.dailyLimit,
      isOverMonthlyBudget: monthlySpend >= this.config.monthlyLimit,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if a request should be allowed based on budget.
   *
   * @param estimatedCost - Estimated cost of the request
   * @returns True if request should be allowed
   */
  async shouldAllowRequest(estimatedCost: number = 0): Promise<boolean> {
    if (!this.config.enforceHardLimit) {
      return true; // Soft limit - just alert
    }

    const status = await this.getBudgetStatus();

    // Check if adding this request would exceed budget
    const wouldExceedDaily = (status.dailySpend + estimatedCost) > this.config.dailyLimit;
    const wouldExceedMonthly = (status.monthlySpend + estimatedCost) > this.config.monthlyLimit;

    return !wouldExceedDaily && !wouldExceedMonthly;
  }

  /**
   * Get recent budget alerts.
   *
   * @param limit - Maximum number of alerts to return
   * @returns Recent alerts
   */
  async getRecentAlerts(limit: number = 20): Promise<BudgetAlert[]> {
    const conditions = [];
    if (this.config.workspaceId) {
      conditions.push(eq(dfsBudgetAlerts.workspaceId, this.config.workspaceId));
    }

    const results = await this.db
      .select()
      .from(dfsBudgetAlerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dfsBudgetAlerts.alertedAt))
      .limit(limit);

    return results.map((r) => ({
      type: r.alertType as "daily" | "monthly",
      threshold: r.threshold,
      thresholdPercent: r.threshold * 100,
      currentSpend: r.spendAmount,
      limit: r.budgetLimit,
      workspaceId: r.workspaceId ?? undefined,
      timestamp: r.alertedAt,
    }));
  }

  /**
   * Update budget configuration.
   *
   * @param newConfig - New configuration values
   */
  updateConfig(newConfig: Partial<BudgetConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current configuration.
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Send an alert if not already sent for this threshold today.
   */
  private async sendAlertIfNeeded(
    type: "daily" | "monthly",
    threshold: number,
    status: DfsBudgetStatus
  ): Promise<void> {
    const alertKey = this.getAlertKey(type, threshold);

    // Check if already sent (using Redis if available)
    if (this.redis) {
      const alreadySent = await this.redis.get(alertKey);
      if (alreadySent) return;
    } else {
      // Fallback to database check
      const existingAlert = await this.checkExistingAlert(type, threshold);
      if (existingAlert) return;
    }

    // Send alert
    const currentSpend = type === "daily" ? status.dailySpend : status.monthlySpend;
    const limit = type === "daily" ? status.dailyLimit : status.monthlyLimit;

    const alert: BudgetAlert = {
      type,
      threshold,
      thresholdPercent: threshold * 100,
      currentSpend,
      limit,
      workspaceId: this.config.workspaceId,
      timestamp: new Date(),
    };

    let sentSuccessfully = false;
    let deliveryMethod: "webhook" | "email" | "both" | undefined;
    let deliveryError: string | undefined;

    try {
      // Send via webhook
      if (this.config.alertWebhookUrl) {
        await this.sendWebhookAlert(alert);
        deliveryMethod = "webhook";
        sentSuccessfully = true;
      }

      // Send via email (if configured)
      if (this.config.alertEmails && this.config.alertEmails.length > 0) {
        await this.sendEmailAlert(alert);
        deliveryMethod = deliveryMethod ? "both" : "email";
        sentSuccessfully = true;
      }
    } catch (error) {
      deliveryError = error instanceof Error ? error.message : String(error);
      dfsBudgetLogger.error({ alertType: type, error: deliveryError }, 'Failed to send budget alert');
    }

    // Record alert in database
    await this.recordAlert({
      alertType: type,
      threshold,
      spendAmount: currentSpend,
      budgetLimit: limit,
      workspaceId: this.config.workspaceId ?? null,
      sentSuccessfully,
      deliveryMethod,
      deliveryError,
    });

    // Mark as sent in Redis (24 hour TTL)
    if (this.redis) {
      await this.redis.set(alertKey, "1", "EX", 86400);
    }
  }

  /**
   * Generate Redis key for alert deduplication.
   */
  private getAlertKey(type: "daily" | "monthly", threshold: number): string {
    const today = new Date().toISOString().split("T")[0];
    const workspace = this.config.workspaceId ?? "global";
    return `dfs_alert:${type}:${threshold}:${workspace}:${today}`;
  }

  /**
   * Check if alert already exists in database for today.
   */
  private async checkExistingAlert(
    type: "daily" | "monthly",
    threshold: number
  ): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const conditions = [
      eq(dfsBudgetAlerts.alertType, type),
      eq(dfsBudgetAlerts.threshold, threshold),
      gte(dfsBudgetAlerts.alertedAt, today),
    ];

    if (this.config.workspaceId) {
      conditions.push(eq(dfsBudgetAlerts.workspaceId, this.config.workspaceId));
    }

    const [existing] = await this.db
      .select({ id: dfsBudgetAlerts.id })
      .from(dfsBudgetAlerts)
      .where(and(...conditions))
      .limit(1);

    return !!existing;
  }

  /**
   * Record alert in database.
   */
  private async recordAlert(alert: DfsBudgetAlertInsert): Promise<void> {
    await this.db.insert(dfsBudgetAlerts).values(alert);
  }

  /**
   * Send webhook alert.
   */
  private async sendWebhookAlert(alert: BudgetAlert): Promise<void> {
    if (!this.config.alertWebhookUrl) return;

    const payload = {
      type: "dataforseo_budget_alert",
      alert: {
        budget_type: alert.type,
        threshold_percent: alert.thresholdPercent,
        current_spend_usd: alert.currentSpend.toFixed(2),
        budget_limit_usd: alert.limit.toFixed(2),
        usage_percent: ((alert.currentSpend / alert.limit) * 100).toFixed(1),
        workspace_id: alert.workspaceId,
        timestamp: alert.timestamp.toISOString(),
      },
      message: this.formatAlertMessage(alert),
    };

    const response = await fetch(this.config.alertWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  }

  /**
   * Send email alert.
   * Note: This is a placeholder - integrate with your email service.
   */
  private async sendEmailAlert(_alert: BudgetAlert): Promise<void> {
    // Placeholder for email integration
    // In production, integrate with your email service (e.g., Resend)
    dfsBudgetLogger.warn('Email alerts not implemented. Configure webhook instead.');
  }

  /**
   * Format alert message for notifications.
   */
  private formatAlertMessage(alert: BudgetAlert): string {
    const percentUsed = ((alert.currentSpend / alert.limit) * 100).toFixed(1);
    const remaining = alert.limit - alert.currentSpend;

    if (alert.currentSpend >= alert.limit) {
      return `DataForSEO ${alert.type} budget EXCEEDED: $${alert.currentSpend.toFixed(2)} / $${alert.limit.toFixed(2)} (${percentUsed}%)`;
    }

    return `DataForSEO ${alert.type} budget alert: ${alert.thresholdPercent}% threshold reached. Spent $${alert.currentSpend.toFixed(2)} of $${alert.limit.toFixed(2)} ($${remaining.toFixed(2)} remaining)`;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse comma-separated email addresses from env var.
 */
function parseAlertEmails(envVar?: string): string[] | undefined {
  if (!envVar) return undefined;
  return envVar
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

// =============================================================================
// Singleton Factory
// =============================================================================

let _budgetMonitorInstance: DfsBudgetMonitor | null = null;

/**
 * Get or create the budget monitor singleton.
 *
 * @param db - DbClient connection
 * @param config - Optional configuration
 * @param redis - Optional Redis connection
 * @returns Budget monitor instance
 */
export function getDfsBudgetMonitor(
  db: DbClient,
  config?: Partial<BudgetConfig>,
  redis?: Redis
): DfsBudgetMonitor {
  if (!_budgetMonitorInstance) {
    _budgetMonitorInstance = new DfsBudgetMonitor(db, config, redis);
  }
  return _budgetMonitorInstance;
}

/**
 * Reset the budget monitor singleton (for testing).
 */
export function resetDfsBudgetMonitor(): void {
  _budgetMonitorInstance = null;
}

// =============================================================================
// Cron Job Helper
// =============================================================================

/**
 * Run budget check as a cron job.
 * Call this from a scheduled task (e.g., every 5 minutes).
 *
 * @param db - DbClient connection
 * @param redis - Optional Redis connection
 */
export async function runBudgetCheck(db: DbClient, redis?: Redis): Promise<void> {
  const monitor = getDfsBudgetMonitor(db, undefined, redis);
  const status = await monitor.checkBudget();

  // Log status for monitoring
  dfsBudgetLogger.info({
    dailySpend: status.dailySpend,
    dailyLimit: status.dailyLimit,
    dailyUsagePercent: status.dailyUsagePercent * 100,
    monthlySpend: status.monthlySpend,
    monthlyLimit: status.monthlyLimit,
    monthlyUsagePercent: status.monthlyUsagePercent * 100,
  }, 'Budget check completed');
}
