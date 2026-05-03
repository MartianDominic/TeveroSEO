/**
 * CostTracker: API cost tracking service for classification pipeline.
 *
 * Records all API calls with associated costs per workspace.
 * Enables billing, monitoring, and cost optimization analysis.
 */

import { db } from "@/db";
import {
  apiCosts,
  calculateCostCents,
  estimateTokens,
  type ApiService,
  type ApiOperation,
  type ApiCostInsert,
} from "@/db/api-costs-schema";
import { createLogger } from "@/server/lib/logger";
import { and, eq, gte, lte, sql } from "drizzle-orm";

const log = createLogger({ module: "CostTracker" });

export interface CostRecordInput {
  workspaceId: string;
  service: ApiService;
  operation: ApiOperation;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceCostSummary {
  workspaceId: string;
  totalCostCents: number;
  byService: Record<string, number>;
  byOperation: Record<string, number>;
  recordCount: number;
}

/**
 * CostTracker singleton for recording API costs.
 */
export class CostTracker {
  private static instance: CostTracker;
  private pendingRecords: ApiCostInsert[] = [];
  private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs = 5000; // Batch writes every 5 seconds
  private readonly maxPendingRecords = 100;

  private constructor() {}

  static getInstance(): CostTracker {
    if (!CostTracker.instance) {
      CostTracker.instance = new CostTracker();
    }
    return CostTracker.instance;
  }

  /**
   * Record an API cost.
   * Costs are batched and flushed periodically for efficiency.
   */
  async record(input: CostRecordInput): Promise<void> {
    const costCents = calculateCostCents(
      input.inputTokens,
      input.outputTokens,
      input.service
    );

    const record: ApiCostInsert = {
      workspaceId: input.workspaceId,
      service: input.service,
      operation: input.operation,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costCents,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    };

    this.pendingRecords.push(record);

    log.debug("Cost recorded", {
      workspaceId: input.workspaceId,
      service: input.service,
      costCents,
      pending: this.pendingRecords.length,
    });

    // Flush immediately if we have too many pending records
    if (this.pendingRecords.length >= this.maxPendingRecords) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Record cost from text content (estimates tokens).
   */
  async recordFromText(
    workspaceId: string,
    service: ApiService,
    operation: ApiOperation,
    inputText: string,
    outputText: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);

    await this.record({
      workspaceId,
      service,
      operation,
      inputTokens,
      outputTokens,
      metadata,
    });
  }

  /**
   * Schedule a flush if not already scheduled.
   */
  private scheduleFlush(): void {
    if (this.flushTimeoutId === null) {
      this.flushTimeoutId = setTimeout(() => {
        this.flushTimeoutId = null;
        this.flush().catch((err) => {
          log.error(
            "Failed to flush cost records",
            err instanceof Error ? err : new Error(String(err))
          );
        });
      }, this.flushIntervalMs);
    }
  }

  /**
   * Flush all pending records to the database.
   */
  async flush(): Promise<void> {
    if (this.pendingRecords.length === 0) {
      return;
    }

    const records = [...this.pendingRecords];
    this.pendingRecords = [];

    if (this.flushTimeoutId !== null) {
      clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }

    try {
      await db.insert(apiCosts).values(records);
      log.info("Flushed cost records", { count: records.length });
    } catch (error) {
      // Re-add records on failure for retry
      this.pendingRecords.unshift(...records);
      log.error(
        "Failed to flush cost records, will retry",
        error instanceof Error ? error : new Error(String(error)),
        { count: records.length }
      );
      throw error;
    }
  }

  /**
   * Get cost summary for a workspace within a date range.
   */
  async getWorkspaceCostSummary(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WorkspaceCostSummary> {
    const records = await db
      .select()
      .from(apiCosts)
      .where(
        and(
          eq(apiCosts.workspaceId, workspaceId),
          gte(apiCosts.createdAt, startDate),
          lte(apiCosts.createdAt, endDate)
        )
      );

    const byService: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    let totalCostCents = 0;

    for (const record of records) {
      totalCostCents += record.costCents;
      byService[record.service] =
        (byService[record.service] ?? 0) + record.costCents;
      byOperation[record.operation] =
        (byOperation[record.operation] ?? 0) + record.costCents;
    }

    return {
      workspaceId,
      totalCostCents,
      byService,
      byOperation,
      recordCount: records.length,
    };
  }

  /**
   * Get total cost for a workspace in the current billing period (month).
   */
  async getCurrentMonthCost(workspaceId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${apiCosts.costCents}), 0)`,
      })
      .from(apiCosts)
      .where(
        and(
          eq(apiCosts.workspaceId, workspaceId),
          gte(apiCosts.createdAt, startOfMonth),
          lte(apiCosts.createdAt, endOfMonth)
        )
      );

    return result[0]?.total ?? 0;
  }
}

/**
 * Get the singleton CostTracker instance.
 */
export function getCostTracker(): CostTracker {
  return CostTracker.getInstance();
}
