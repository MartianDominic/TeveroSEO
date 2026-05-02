/**
 * BullMQ sandboxed processor for pipeline metrics jobs.
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * Handles:
 * - compute_workspace: Compute metrics for a single workspace
 * - compute_all_stale: Find and refresh all stale workspaces
 */
import type { Job } from "bullmq";
import type { PipelineMetricsJobData } from "@/server/queues/pipelineMetricsQueue";
import { createLogger } from "@/server/lib/logger";
import { getMetricsService } from "@/server/features/command-center/services/MetricsService";
import { getPipelineMetricsRepository } from "@/server/features/command-center/repositories/PipelineMetricsRepository";
import type { MetricsService } from "@/server/features/command-center/services/MetricsService";
import type { PipelineMetricsRepository } from "@/server/features/command-center/repositories/PipelineMetricsRepository";

const log = createLogger({ module: "pipeline-metrics-processor" });

// Lazy-initialized services
let metricsService: MetricsService | null = null;
let metricsRepo: PipelineMetricsRepository | null = null;

/**
 * Initialize services lazily.
 */
function initServices(): {
  service: MetricsService;
  repo: PipelineMetricsRepository;
} {
  if (!metricsService) {
    metricsService = getMetricsService();
  }
  if (!metricsRepo) {
    metricsRepo = getPipelineMetricsRepository();
  }
  return { service: metricsService, repo: metricsRepo };
}

/**
 * Process a pipeline metrics job.
 * Routes to appropriate handler based on job type.
 */
export default async function processPipelineMetrics(
  job: Job<PipelineMetricsJobData>
): Promise<void> {
  const logger = createLogger({
    module: "pipeline-metrics-processor",
    jobId: job.id,
  });

  const { type } = job.data;
  logger.info("Processing pipeline metrics job", { type, data: job.data });

  switch (type) {
    case "compute_workspace":
      await handleComputeWorkspace(job, logger);
      break;

    case "compute_all_stale":
      await handleComputeAllStale(job, logger);
      break;

    default:
      logger.warn("Unknown job type", { type });
  }
}

/**
 * Handle compute_workspace job.
 * Computes metrics for a single workspace.
 */
async function handleComputeWorkspace(
  job: Job<PipelineMetricsJobData>,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  const { workspaceId } = job.data;
  if (!workspaceId) {
    logger.error(
      "Missing workspaceId for compute_workspace job",
      new Error("Missing workspaceId")
    );
    return;
  }

  const { service } = initServices();
  const startTime = Date.now();

  try {
    const metrics = await service.computeWorkspaceMetrics(workspaceId);
    const durationMs = Date.now() - startTime;

    logger.info("Workspace metrics computed", {
      workspaceId,
      durationMs,
      computationDurationMs: metrics.computationDurationMs,
    });
  } catch (error) {
    logger.error(
      `Failed to compute metrics for workspace ${workspaceId}`,
      error as Error
    );
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Handle compute_all_stale job.
 * Finds workspaces with stale/missing metrics and refreshes them.
 */
async function handleComputeAllStale(
  job: Job<PipelineMetricsJobData>,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  const { service, repo } = initServices();
  const startTime = Date.now();

  // Find workspaces with stale or missing metrics (> 5 min old)
  const staleWorkspaces = await repo.getStale(5);
  logger.info(`Found ${staleWorkspaces.length} workspaces needing refresh`);

  let successCount = 0;
  let errorCount = 0;

  // Process each workspace
  for (const workspaceId of staleWorkspaces) {
    try {
      await service.computeWorkspaceMetrics(workspaceId);
      successCount++;

      // Update progress
      await job.updateProgress(
        Math.round((successCount / staleWorkspaces.length) * 100)
      );
    } catch (error) {
      errorCount++;
      logger.error(
        `Failed to compute metrics for workspace ${workspaceId}`,
        error as Error
      );
      // Continue with next workspace - don't fail entire batch
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info("Stale metrics refresh completed", {
    total: staleWorkspaces.length,
    success: successCount,
    errors: errorCount,
    durationMs,
  });
}
