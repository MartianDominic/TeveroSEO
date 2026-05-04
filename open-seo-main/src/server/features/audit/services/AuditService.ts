import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import {
  MAX_USER_AUDIT_USAGE,
  clampAuditMaxPages,
  getEstimatedAuditCapacity,
} from "@/server/features/audit/services/audit-capacity";
import { AppError } from "@/server/lib/errors";
import { AuditProgressKV } from "@/server/lib/audit/progress-kv";
import {
  parseAuditConfig,
  type AuditConfig,
  type LighthouseStrategy,
} from "@/server/lib/audit/types";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { auditQueue, AUDIT_STEP, type AuditJobData } from "@/server/queues/auditQueue";
import {
  addJobWithBackpressure,
  QueueBackpressureError,
} from "@/server/lib/queue-utils";

async function startAudit(input: {
  actorUserId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  maxPages?: number;
  lighthouseStrategy?: LighthouseStrategy;
  clientId?: string | null;
}) {
  const maxPages = clampAuditMaxPages(input.maxPages);
  const lighthouseStrategy = input.lighthouseStrategy ?? "auto";
  const reservation = getEstimatedAuditCapacity({
    maxPages,
    lighthouseStrategy,
  });

  const currentUsage = await AuditRepository.getAuditCapacityUsageForUser(
    input.actorUserId,
  );

  if (currentUsage + reservation.total > MAX_USER_AUDIT_USAGE) {
    throw new AppError("AUDIT_CAPACITY_REACHED");
  }

  const auditId = crypto.randomUUID();
  const config: AuditConfig = { maxPages, lighthouseStrategy };
  const startUrl = await normalizeAndValidateStartUrl(input.startUrl);

  await AuditRepository.createAudit({
    id: auditId,
    projectId: input.projectId,
    startedByUserId: input.actorUserId,
    startUrl,
    workflowInstanceId: auditId,
    config,
    pagesTotal: reservation.pagesTotal,
    lighthouseTotal: reservation.lighthouseTotal,
    clientId: input.clientId ?? null,
  });

  const jobData: AuditJobData = {
    auditId,
    projectId: input.projectId,
    startUrl,
    config,
    billingCustomer: input.billingCustomer,
    step: AUDIT_STEP.DISCOVER,
  };

  try {
    // jobId: auditId → BQ-02 deduplication. A second startAudit with the
    // same auditId is a no-op on the queue side (BullMQ rejects duplicates).
    // Backpressure: reject new audits if queue is overwhelmed (BQ-06).
    await addJobWithBackpressure(
      auditQueue,
      `audit-${auditId}`,
      jobData,
      { jobId: auditId },
      { maxQueueSize: 5000, allowDegradedMode: true },
    );
  } catch (err) {
    // Rollback DB insert so we don't leave an orphaned audit row if enqueue
    // fails (e.g., Redis down, or backpressure). Preserves Phase-2 rollback semantics.
    await AuditRepository.deleteAuditForProject(auditId, input.projectId);

    // Provide user-friendly error for backpressure
    if (err instanceof QueueBackpressureError) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Audit system is at capacity. Please try again in a few minutes.",
      );
    }

    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to enqueue audit job: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { auditId };
}

async function getStatus(auditId: string, projectId: string) {
  const audit = await AuditRepository.getAuditForProject(auditId, projectId);
  if (!audit) throw new AppError("NOT_FOUND");

  return {
    id: audit.id,
    startUrl: audit.startUrl,
    status: audit.status,
    pagesCrawled: audit.pagesCrawled,
    pagesTotal: audit.pagesTotal,
    lighthouseTotal: audit.lighthouseTotal,
    lighthouseCompleted: audit.lighthouseCompleted,
    lighthouseFailed: audit.lighthouseFailed,
    currentPhase: audit.currentPhase,
    startedAt: audit.startedAt,
    completedAt: audit.completedAt,
  };
}

async function getResults(auditId: string, projectId: string) {
  const { audit, pages, lighthouse } =
    await AuditRepository.getAuditResultsForProject(auditId, projectId);

  if (!audit) throw new AppError("NOT_FOUND");

  const parsedConfig = parseAuditConfig(audit.config);
  if (!parsedConfig) {
    throw new AppError("INTERNAL_ERROR", "Invalid audit configuration");
  }

  return {
    audit: {
      id: audit.id,
      startUrl: audit.startUrl,
      status: audit.status,
      pagesCrawled: audit.pagesCrawled,
      pagesTotal: audit.pagesTotal,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      config: parsedConfig,
    },
    pages: pages.map((p) => ({
      id: p.id,
      auditId: p.auditId,
      url: p.url,
      statusCode: p.statusCode,
      redirectUrl: p.redirectUrl,
      title: p.title,
      metaDescription: p.metaDescription,
      canonicalUrl: p.canonicalUrl,
      robotsMeta: p.robotsMeta,
      ogTitle: p.ogTitle,
      ogDescription: p.ogDescription,
      ogImage: p.ogImage,
      h1Count: p.h1Count,
      h2Count: p.h2Count,
      h3Count: p.h3Count,
      h4Count: p.h4Count,
      h5Count: p.h5Count,
      h6Count: p.h6Count,
      headingOrderJson: p.headingOrderJson as number[] | null,
      wordCount: p.wordCount,
      imagesTotal: p.imagesTotal,
      imagesMissingAlt: p.imagesMissingAlt,
      imagesJson: p.imagesJson as Array<{ src: string | null; alt: string | null }> | null,
      internalLinkCount: p.internalLinkCount,
      externalLinkCount: p.externalLinkCount,
      hasStructuredData: p.hasStructuredData,
      hreflangTagsJson: p.hreflangTagsJson as string[] | null,
      isIndexable: p.isIndexable,
      responseTimeMs: p.responseTimeMs,
    })),
    lighthouse,
  };
}

async function getHistory(
  projectId: string,
  opts?: { clientId?: string | null },
) {
  const auditList = await AuditRepository.getAuditsByProject(projectId, opts);

  return auditList.map((audit) => {
    const parsedConfig = parseAuditConfig(audit.config);
    const ranLighthouse = parsedConfig?.lighthouseStrategy !== "none";

    return {
      id: audit.id,
      startUrl: audit.startUrl,
      status: audit.status,
      pagesCrawled: audit.pagesCrawled,
      pagesTotal: audit.pagesTotal,
      ranLighthouse,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
    };
  });
}

async function getCrawlProgress(auditId: string, projectId: string) {
  const audit = await AuditRepository.getAuditForProject(auditId, projectId);
  if (!audit) {
    throw new AppError("NOT_FOUND");
  }

  return AuditProgressKV.getCrawledUrls(auditId);
}

/**
 * Cancel a running audit by removing the BullMQ job and marking as cancelled.
 * H-AUDIT-01: Provides user-visible cancellation for stuck audits.
 * H-AUDIT-03: Ensures job is cancelled before any cleanup.
 */
async function cancelAudit(auditId: string, projectId: string) {
  const audit = await AuditRepository.getAuditForProject(auditId, projectId);
  if (!audit) {
    throw new AppError("NOT_FOUND");
  }

  if (audit.status !== "running") {
    throw new AppError("VALIDATION_ERROR", "Audit is not running");
  }

  if (!audit.workflowInstanceId) {
    throw new AppError("INTERNAL_ERROR", "Audit has no workflow instance");
  }

  const workflowInstanceId = audit.workflowInstanceId;

  // Cancel the BullMQ job first (H-AUDIT-03)
  const job = await auditQueue.getJob(auditId);
  if (job) {
    try {
      // Try to remove the job. If active, moveToFailed is called in catch.
      await job.remove();
    } catch {
      // Job is active or already completed/failed - try to mark as failed
      try {
        await job.moveToFailed(new Error("Cancelled by user"), auditId);
      } catch {
        // Job may already be in a terminal state
      }
    }
  }

  // Mark audit as cancelled in database
  await AuditRepository.cancelAudit(auditId, workflowInstanceId);

  return { success: true };
}

/**
 * Retry a failed audit by re-enqueueing the job.
 * M-AUDIT-02: Provides retry UI for failed audits.
 */
async function retryAudit(
  auditId: string,
  projectId: string,
  billingCustomer: {
    organizationId: string;
    userEmail: string;
    userId: string;
  },
) {
  const audit = await AuditRepository.getAuditForProject(auditId, projectId);
  if (!audit) {
    throw new AppError("NOT_FOUND");
  }

  if (audit.status !== "failed" && audit.status !== "cancelled") {
    throw new AppError("VALIDATION_ERROR", "Only failed or cancelled audits can be retried");
  }

  // For retries, workflowInstanceId may be null if the original audit failed before workflow started
  // In that case, we generate a new one in resetAuditForRetry
  const workflowInstanceId = audit.workflowInstanceId ?? auditId;

  const parsedConfig = parseAuditConfig(audit.config);
  if (!parsedConfig) {
    throw new AppError("INTERNAL_ERROR", "Invalid audit configuration");
  }

  // Reset audit to running state
  await AuditRepository.resetAuditForRetry(auditId, workflowInstanceId);

  const jobData: AuditJobData = {
    auditId,
    projectId,
    startUrl: audit.startUrl,
    config: parsedConfig,
    billingCustomer,
    step: AUDIT_STEP.DISCOVER,
  };

  try {
    await addJobWithBackpressure(
      auditQueue,
      `audit-${auditId}-retry-${Date.now()}`,
      jobData,
      { jobId: `${auditId}-retry-${Date.now()}` },
      { maxQueueSize: 5000, allowDegradedMode: true },
    );
  } catch (err) {
    // Rollback status change - use the same workflowInstanceId we used for reset
    await AuditRepository.failAudit(auditId, workflowInstanceId);

    if (err instanceof QueueBackpressureError) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Audit system is at capacity. Please try again in a few minutes.",
      );
    }

    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to retry audit: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { auditId };
}

async function remove(auditId: string, projectId: string) {
  const audit = await AuditRepository.getAuditForProject(auditId, projectId);
  if (!audit) {
    throw new AppError("NOT_FOUND");
  }

  // H-AUDIT-03: Cancel job before delete to prevent orphan data
  if (audit.status === "running") {
    const job = await auditQueue.getJob(auditId);
    if (job) {
      try {
        await job.remove();
      } catch {
        // Job is active or already completed/failed - try to mark as failed
        try {
          await job.moveToFailed(new Error("Audit deleted"), auditId);
        } catch {
          // Job may already be in a terminal state
        }
      }
    }
  }

  await AuditRepository.deleteAuditForProject(auditId, projectId);
}

export const AuditService = {
  startAudit,
  getStatus,
  getCrawlProgress,
  getResults,
  getHistory,
  cancelAudit,
  retryAudit,
  remove,
} as const;
