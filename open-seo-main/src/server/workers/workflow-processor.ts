/**
 * BullMQ sandboxed processor for engagement workflow jobs.
 * Phase 62-03: Engagement Workflow Engine
 *
 * Handles:
 * - execute_step: Execute current workflow step
 * - unsnooze: Resume snoozed workflow
 * - reset_weekly_touches: Reset touch counts for all instances
 * - start_from_trigger: Start new workflow from event trigger
 */
import type { Job } from "bullmq";
import type { WorkflowJobData } from "@/server/queues/workflowQueue";
import { createLogger } from "@/server/lib/logger";
import {
  WorkflowRepository,
  getWorkflowRepository,
} from "@/server/features/command-center/repositories/WorkflowRepository";
import {
  WorkflowExecutor,
  getWorkflowExecutor,
} from "@/server/features/command-center/services/WorkflowExecutor";
import {
  EngagementService,
  getEngagementService,
} from "@/server/features/command-center/services/EngagementService";
import { workflowQueue } from "@/server/queues/workflowQueue";

const log = createLogger({ module: "workflow-processor" });

// Lazy-initialized services
let workflowRepo: WorkflowRepository | null = null;
let engagementService: EngagementService | null = null;
let workflowExecutor: WorkflowExecutor | null = null;

/**
 * Initialize services lazily.
 * Services depend on queue, so we need to initialize after import.
 */
function initServices(): {
  repo: WorkflowRepository;
  engagement: EngagementService;
  executor: WorkflowExecutor;
} {
  if (!workflowRepo) {
    workflowRepo = getWorkflowRepository();
  }
  if (!engagementService) {
    engagementService = getEngagementService(workflowQueue);
  }
  if (!workflowExecutor) {
    // Create mock services for now - these will be replaced with real services
    // when the full command center is wired up
    const mockFollowUpService = {
      create: async () => ({ id: `followup-${Date.now()}` }),
    };
    const mockEmailService = {
      sendEmail: async () => ({ success: true, messageId: `msg-${Date.now()}` }),
    };
    const mockAlertService = {
      create: async () => ({ id: `alert-${Date.now()}` }),
      notifyUsers: async () => {},
    };

    workflowExecutor = getWorkflowExecutor(
      workflowRepo,
      engagementService,
      mockFollowUpService,
      mockEmailService,
      mockAlertService,
      workflowQueue,
    );
  }
  return {
    repo: workflowRepo,
    engagement: engagementService,
    executor: workflowExecutor,
  };
}

/**
 * Process a workflow job.
 * Routes to appropriate handler based on job type.
 */
export default async function processWorkflowJob(
  job: Job<WorkflowJobData>,
): Promise<void> {
  const logger = createLogger({
    module: "workflow-processor",
    jobId: job.id,
  });

  const { type } = job.data;
  logger.info("Processing workflow job", { type, data: job.data });

  switch (type) {
    case "execute_step":
      await handleExecuteStep(job, logger);
      break;

    case "unsnooze":
      await handleUnsnooze(job, logger);
      break;

    case "reset_weekly_touches":
      await handleResetWeeklyTouches(job, logger);
      break;

    case "start_from_trigger":
      await handleStartFromTrigger(job, logger);
      break;

    default:
      logger.warn("Unknown job type", { type });
  }
}

/**
 * Handle execute_step job.
 * Executes the current step of a workflow instance.
 */
async function handleExecuteStep(
  job: Job<WorkflowJobData>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const { instanceId } = job.data;
  if (!instanceId) {
    logger.error("Missing instanceId for execute_step job", new Error("Missing instanceId"));
    return;
  }

  const { executor } = initServices();
  const result = await executor.executeStep(instanceId);

  logger.info("Step executed", {
    instanceId,
    result: result.type,
    scheduled: result.scheduled,
    conditionResult: result.conditionResult,
    error: result.error,
    reason: result.reason,
  });
}

/**
 * Handle unsnooze job.
 * Resumes a snoozed workflow.
 */
async function handleUnsnooze(
  job: Job<WorkflowJobData>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const { instanceId } = job.data;
  if (!instanceId) {
    logger.error("Missing instanceId for unsnooze job", new Error("Missing instanceId"));
    return;
  }

  const { repo, engagement } = initServices();

  // Check if still snoozed
  const instance = await repo.findById(instanceId);
  if (!instance) {
    logger.warn("Instance not found for unsnooze", { instanceId });
    return;
  }

  if (instance.status !== "snoozed") {
    logger.info("Instance not snoozed, skipping unsnooze", {
      instanceId,
      status: instance.status,
    });
    return;
  }

  // Check if snooze time has passed
  if (instance.snoozedUntil && instance.snoozedUntil > new Date()) {
    logger.info("Snooze time not reached yet", {
      instanceId,
      snoozedUntil: instance.snoozedUntil.toISOString(),
    });
    return;
  }

  await engagement.resumeWorkflow(instanceId);
  logger.info("Workflow unsnoozed", { instanceId });
}

/**
 * Handle reset_weekly_touches job.
 * Resets touch counts for all active workflow instances.
 */
async function handleResetWeeklyTouches(
  job: Job<WorkflowJobData>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const { repo } = initServices();

  const resetCount = await repo.resetWeeklyTouchCounts();
  logger.info("Weekly touch counts reset", { resetCount });
}

/**
 * Handle start_from_trigger job.
 * Starts a new workflow from an event trigger.
 */
async function handleStartFromTrigger(
  job: Job<WorkflowJobData>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const { workspaceId, templateId, entityType, entityId, context } = job.data;

  if (!workspaceId || !templateId || !entityType || !entityId) {
    logger.error("Missing required fields for start_from_trigger", new Error("Missing fields"), {
      workspaceId,
      templateId,
      entityType,
      entityId,
    });
    return;
  }

  const { engagement } = initServices();

  try {
    const instance = await engagement.startWorkflow(
      workspaceId,
      templateId,
      entityType,
      entityId,
      context ?? {},
    );

    logger.info("Workflow started from trigger", {
      instanceId: instance.id,
      templateId,
      entityType,
      entityId,
    });
  } catch (err) {
    // Check for duplicate workflow error
    if (err instanceof Error && err.message.includes("already exists")) {
      logger.info("Workflow already exists for entity, skipping", {
        entityType,
        entityId,
      });
      return;
    }
    throw err;
  }
}
