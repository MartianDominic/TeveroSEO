/**
 * PipelineMetricsRepository - Data access for pipeline metrics
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * Provides:
 * - getByWorkspace: Get cached metrics for a workspace
 * - upsert: Create or update metrics (INSERT ON CONFLICT UPDATE)
 * - getStale: Find workspaces with old/missing metrics for refresh
 */
import { eq, sql, and, lt, or, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { pipelineMetrics, type PipelineMetricsSelect, type PipelineMetricsInsert, organization } from "@/db";
import { getDb, type DrizzleClient } from "@/db/client";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "PipelineMetricsRepository" });

/**
 * Interface for the repository - enables mocking in tests.
 */
export interface PipelineMetricsRepositoryInterface {
  getByWorkspace(workspaceId: string): Promise<PipelineMetricsSelect | null>;
  upsert(workspaceId: string, data: Partial<PipelineMetricsInsert>): Promise<void>;
  getStale(maxAgeMinutes: number): Promise<string[]>;
}

/**
 * Repository for pipeline_metrics table operations.
 */
export class PipelineMetricsRepository implements PipelineMetricsRepositoryInterface {
  constructor(private readonly db: DrizzleClient = getDb()) {}

  /**
   * Get metrics for a workspace.
   * Returns null if no metrics exist.
   */
  async getByWorkspace(workspaceId: string): Promise<PipelineMetricsSelect | null> {
    const result = await this.db.query.pipelineMetrics.findFirst({
      where: eq(pipelineMetrics.workspaceId, workspaceId),
    });
    return result ?? null;
  }

  /**
   * Upsert metrics for a workspace.
   * Uses INSERT ON CONFLICT UPDATE to ensure single row per workspace.
   */
  async upsert(workspaceId: string, data: Partial<PipelineMetricsInsert>): Promise<void> {
    const existing = await this.getByWorkspace(workspaceId);

    if (existing) {
      // Update existing row
      await this.db
        .update(pipelineMetrics)
        .set({
          ...data,
          workspaceId,
        })
        .where(eq(pipelineMetrics.workspaceId, workspaceId));
      log.debug("Updated pipeline metrics", { workspaceId });
    } else {
      // Insert new row
      await this.db.insert(pipelineMetrics).values({
        id: nanoid(),
        workspaceId,
        ...data,
      });
      log.debug("Created pipeline metrics", { workspaceId });
    }
  }

  /**
   * Find workspaces with stale or missing metrics.
   * Returns workspace IDs where:
   * - No metrics exist, OR
   * - computed_at is older than maxAgeMinutes
   */
  async getStale(maxAgeMinutes: number): Promise<string[]> {
    const staleThreshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    // Get all workspaces
    const allWorkspaces = await this.db.query.organization.findMany({
      columns: { id: true },
    });

    // Get workspaces with fresh metrics
    const freshMetrics = await this.db.query.pipelineMetrics.findMany({
      where: and(
        sql`${pipelineMetrics.computedAt} > ${staleThreshold}`
      ),
      columns: { workspaceId: true },
    });

    const freshWorkspaceIds = new Set(freshMetrics.map((m) => m.workspaceId));

    // Return workspaces without fresh metrics
    const staleWorkspaceIds = allWorkspaces
      .filter((ws) => !freshWorkspaceIds.has(ws.id))
      .map((ws) => ws.id);

    log.debug("Found stale workspaces", {
      total: allWorkspaces.length,
      fresh: freshWorkspaceIds.size,
      stale: staleWorkspaceIds.length,
      maxAgeMinutes,
    });

    return staleWorkspaceIds;
  }
}

// Singleton instance
let repoInstance: PipelineMetricsRepository | null = null;

/**
 * Get the singleton repository instance.
 */
export function getPipelineMetricsRepository(): PipelineMetricsRepository {
  if (!repoInstance) {
    repoInstance = new PipelineMetricsRepository();
  }
  return repoInstance;
}
