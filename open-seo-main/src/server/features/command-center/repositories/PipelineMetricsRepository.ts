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
import { db, pipelineMetrics, type PipelineMetricsSelect, type PipelineMetricsInsert, organization } from "@/db";
import { createLogger } from "@/server/lib/logger";

// Type for the Drizzle database client
type DrizzleClient = typeof db;

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
  constructor(private readonly dbClient: DrizzleClient = db) {}

  /**
   * Get metrics for a workspace.
   * Returns null if no metrics exist.
   */
  async getByWorkspace(workspaceId: string): Promise<PipelineMetricsSelect | null> {
    const result = await this.dbClient.query.pipelineMetrics.findFirst({
      where: eq(pipelineMetrics.workspaceId, workspaceId),
    });
    return result ?? null;
  }

  /**
   * Upsert metrics for a workspace.
   * Uses true INSERT ON CONFLICT UPDATE to avoid race conditions (M-62-03).
   */
  async upsert(workspaceId: string, data: Partial<PipelineMetricsInsert>): Promise<void> {
    const id = nanoid();
    const now = new Date();

    await this.dbClient
      .insert(pipelineMetrics)
      .values({
        id,
        workspaceId,
        ...data,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: pipelineMetrics.workspaceId,
        set: {
          ...data,
          computedAt: now,
        },
      });

    log.debug("Upserted pipeline metrics", { workspaceId });
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
    const allWorkspaces = await this.dbClient.query.organization.findMany({
      columns: { id: true },
    });

    // Get workspaces with fresh metrics
    const freshMetrics = await this.dbClient.query.pipelineMetrics.findMany({
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
