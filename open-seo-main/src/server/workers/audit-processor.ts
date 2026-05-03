/**
 * Sandboxed BullMQ processor for site-audit jobs.
 *
 * Runs in a child process (spawned by BullMQ when the Worker is configured with
 * a path string instead of an inline function) so Lighthouse's heavy Node-internal
 * work cannot stall the main event loop — satisfies BQ-04.
 *
 * The processor reuses Phase-2 runAuditPhases() verbatim by providing a
 * BullMQ-backed WorkflowStep adapter that persists `job.data.step` before each
 * named step, enabling step-level resume on retry.
 */
import type { Job } from "bullmq";
import { z } from "zod";
import type { AuditJobData } from "@/server/queues/auditQueue";
import { AUDIT_STEP } from "@/server/queues/auditQueue";
import type { WorkflowStep } from "@/server/workflows/workflow-types";
import { runAuditPhases } from "@/server/workflows/siteAuditWorkflowPhases";
import { validateJobData, safeUrlSchema } from "@/server/lib/queue-utils";

/**
 * Zod schema for audit job data validation.
 * Validates critical fields and ensures URL is safe (SSRF prevention).
 * Uses passthrough() to allow additional fields from BillingCustomerContext
 * and AuditConfig without strict type matching.
 */
const auditJobDataSchema = z.object({
  auditId: z.string().uuid("Invalid audit ID"),
  projectId: z.string().uuid("Invalid project ID"),
  startUrl: safeUrlSchema,
  config: z.object({
    maxPages: z.number().int().min(1).max(10000),
    lighthouseStrategy: z.string(), // Allow any valid strategy string
  }).passthrough(),
  billingCustomer: z.object({
    organizationId: z.string(),
    userId: z.string(),
  }).passthrough(), // Allow additional billing context fields
  step: z.string(), // Allow any step string
  // Optional resume state
  sitemapUrls: z.array(z.string()).optional(),
  crawlBatchIndex: z.number().int().min(0).optional(),
  lighthouseBatchIndex: z.number().int().min(0).optional(),
}).passthrough();

/**
 * Map each named step in Phase-2 code to an AUDIT_STEP enum value.
 * Unknown names fall through without updating job.data.step (safe default).
 */
function mapNameToStep(name: string): AuditJobData["step"] | null {
  if (name === "discover-urls") return AUDIT_STEP.DISCOVER;
  if (
    name.startsWith("crawl-batch-") ||
    name.startsWith("kv-progress-batch-") ||
    name.startsWith("progress-batch-")
  )
    return AUDIT_STEP.CRAWL;
  if (name === "select-lighthouse-sample") return AUDIT_STEP.LIGHTHOUSE_SELECT;
  if (
    name.startsWith("lighthouse-batch-") ||
    name.startsWith("lighthouse-progress-batch-")
  )
    return AUDIT_STEP.LIGHTHOUSE_RUN;
  if (name === "finalize") return AUDIT_STEP.FINALIZE;
  return null;
}

/**
 * MED-QUEUE-01 FIX: Map step to progress percentage for job.updateProgress().
 * Provides visibility into audit job progress at key milestones.
 */
function stepToProgress(step: AuditJobData["step"]): number {
  switch (step) {
    case AUDIT_STEP.DISCOVER:
      return 10;
    case AUDIT_STEP.CRAWL:
      return 40;
    case AUDIT_STEP.LIGHTHOUSE_SELECT:
      return 60;
    case AUDIT_STEP.LIGHTHOUSE_RUN:
      return 80;
    case AUDIT_STEP.FINALIZE:
      return 95;
    default:
      return 0;
  }
}

/**
 * Build a WorkflowStep adapter whose .do() persists step-enum progress
 * (via job.updateData) before invoking fn. BullMQ itself handles retry —
 * on retry the processor starts fresh, but runAuditPhases is idempotent
 * per step (DB upserts, Redis set/del) so re-running a completed step
 * is safe. The enum in job.data.step exposes progress to observers.
 *
 * MED-QUEUE-01 FIX: Also calls job.updateProgress() at key milestones
 * to provide visibility into audit job progress.
 */
function buildStep(job: Job<AuditJobData>): WorkflowStep {
  return {
    async do(name, fn) {
      const nextStep = mapNameToStep(name);
      if (nextStep && nextStep !== job.data.step) {
        await job.updateData({ ...job.data, step: nextStep });
        // MED-QUEUE-01 FIX: Report progress at key milestones
        const progress = stepToProgress(nextStep);
        await job.updateProgress({ stage: nextStep, percent: progress });
      }
      return fn();
    },
  };
}

export default async function processAuditJob(
  job: Job<AuditJobData>,
): Promise<void> {
  // Validate job data before processing (SSRF prevention + data integrity)
  // This is a secondary defense - primary validation happens in AuditService
  // We validate the schema but use the original typed job.data to preserve types
  validateJobData(auditJobDataSchema, job.data, job.name);

  // Use original job.data to preserve correct types (BillingCustomerContext, AuditConfig)
  const { auditId, projectId, startUrl, config, billingCustomer } = job.data;
  const step = buildStep(job);
  await runAuditPhases(step, {
    auditId,
    // Phase 2 uses workflowInstanceId for audit progress writes. We reuse the
    // BullMQ jobId (which we set to auditId in Plan 04 for deduplication).
    workflowInstanceId: job.id ?? auditId,
    billingCustomer,
    projectId,
    startUrl,
    config,
  });

  // MED-QUEUE-01 FIX: Final progress update on completion
  await job.updateProgress({ stage: "completed", percent: 100 });
}
