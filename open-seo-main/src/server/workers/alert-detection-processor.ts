/**
 * Alert Detection Processor
 * Phase 62-07: Smart Alert Detection
 *
 * Processes alert detection jobs:
 * - detect_workspace: Detect alerts for a single workspace
 * - detect_all: Run detection for all active workspaces
 *
 * Integrates with:
 * - AlertDetectionService for rule evaluation
 * - MetricsService for current pipeline metrics
 * - Socket.IO for real-time alert notifications
 */

import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db, organization, pipelineMetrics } from "@/db";
import { createLogger } from "@/server/lib/logger";
import type { AlertDetectionJobData } from "@/server/queues/alertDetectionQueue";
import {
  AlertDetectionService,
  type ExtendedPipelineMetrics,
} from "@/server/features/command-center/services/AlertDetectionService";
import { getSmartAlertRepository } from "@/server/features/command-center/repositories/SmartAlertRepository";
import { emitActivityEvent } from "@/server/websocket/socket-server";
import { nanoid } from "nanoid";

const log = createLogger({ module: "alert-detection-processor" });

/**
 * Notification service that emits alerts via Socket.IO.
 */
const notificationService = {
  async sendAlertNotification(
    workspaceId: string,
    alert: { alertType: string; title: string; severity: string; description: string }
  ): Promise<void> {
    // Emit activity event for the alert
    emitActivityEvent(workspaceId, {
      id: nanoid(),
      type: "alert_created",
      data: {
        alertType: alert.alertType,
        title: alert.title,
        severity: alert.severity,
        description: alert.description,
      },
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Process alert detection jobs.
 */
export async function processAlertDetection(
  job: Job<AlertDetectionJobData>
): Promise<void> {
  const startTime = Date.now();

  log.info("Processing alert detection job", {
    jobId: job.id,
    type: job.data.type,
    workspaceId: job.data.workspaceId,
  });

  const alertRepo = getSmartAlertRepository();
  const alertService = new AlertDetectionService(
    alertRepo,
    db,
    notificationService
  );

  try {
    if (job.data.type === "detect_workspace" && job.data.workspaceId) {
      // Detect alerts for a single workspace
      await detectForWorkspace(alertService, job.data.workspaceId);
    } else if (job.data.type === "detect_all") {
      // Detect alerts for all active workspaces
      await detectForAllWorkspaces(alertService);
    } else {
      log.warn("Unknown job type", { type: job.data.type });
    }

    const durationMs = Date.now() - startTime;
    log.info("Alert detection job completed", {
      jobId: job.id,
      durationMs,
    });
  } catch (error) {
    log.error(
      "Alert detection job failed",
      error instanceof Error ? error : new Error(String(error)),
      { jobId: job.id }
    );
    throw error;
  }
}

/**
 * Detect alerts for a single workspace.
 */
async function detectForWorkspace(
  alertService: AlertDetectionService,
  workspaceId: string
): Promise<void> {
  // Get current metrics for the workspace
  const metrics = await db.query.pipelineMetrics.findFirst({
    where: eq(pipelineMetrics.workspaceId, workspaceId),
  });

  if (!metrics) {
    log.debug("No metrics found for workspace, skipping", { workspaceId });
    return;
  }

  // Convert to extended metrics with historical data
  const extendedMetrics: ExtendedPipelineMetrics = {
    ...metrics,
    // TODO: In production, fetch historical rates from a separate table
    // For now, we set undefined to skip rate-based alerts
    winRatePreviousPct: undefined,
    avgCollectionDaysHistorical: undefined,
  };

  await alertService.detectAlerts(workspaceId, extendedMetrics);

  log.debug("Alert detection completed for workspace", { workspaceId });
}

/**
 * Detect alerts for all active workspaces.
 */
async function detectForAllWorkspaces(
  alertService: AlertDetectionService
): Promise<void> {
  // Get all active workspaces
  const workspaces = await db.query.organization.findMany({
    columns: { id: true },
  });

  log.info("Running alert detection for all workspaces", {
    count: workspaces.length,
  });

  let successCount = 0;
  let errorCount = 0;

  for (const workspace of workspaces) {
    try {
      await detectForWorkspace(alertService, workspace.id);
      successCount++;
    } catch (error) {
      errorCount++;
      log.error(
        `Alert detection failed for workspace ${workspace.id}`,
        error instanceof Error ? error : new Error(String(error)),
        { workspaceId: workspace.id }
      );
    }
  }

  log.info("Alert detection batch completed", {
    total: workspaces.length,
    success: successCount,
    errors: errorCount,
  });

  // Also expire old alerts
  try {
    const alertRepo = getSmartAlertRepository();
    const expiredCount = await alertRepo.expireOld();
    if (expiredCount > 0) {
      log.info("Expired old alerts", { count: expiredCount });
    }
  } catch (error) {
    log.error(
      "Failed to expire old alerts",
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
