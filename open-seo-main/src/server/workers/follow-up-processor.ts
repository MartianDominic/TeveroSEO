/**
 * BullMQ Processor for follow-up jobs.
 * Phase 62-02: Follow-up system with rules engine
 *
 * Handles:
 * - create_scheduled: Create follow-up from rule after delay
 * - process_due: Find all due follow-ups and process them
 * - evaluate_rules: Re-evaluate rules for an entity (after status change)
 *
 * This file is loaded as a sandboxed processor by the worker.
 */
import type { Job } from "bullmq";
import { FollowUpService } from "@/server/features/command-center/services/FollowUpService";
import { FollowUpRepository } from "@/server/features/command-center/repositories/FollowUpRepository";
import type { FollowUpJobData } from "@/server/queues/followUpQueue";
import type { FollowUpType, Priority } from "@/db/follow-up-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "follow-up-processor" });

/**
 * Process a follow-up job.
 */
export default async function processFollowUpJob(
  job: Job<FollowUpJobData>
): Promise<void> {
  const { data } = job;

  log.info("Processing follow-up job", {
    jobId: job.id,
    type: data.type,
    workspaceId: data.workspaceId,
  });

  switch (data.type) {
    case "create_scheduled":
      await handleCreateScheduled(job, data);
      break;

    case "process_due":
      await handleProcessDue(job, data);
      break;

    case "evaluate_rules":
      await handleEvaluateRules(job, data);
      break;

    default:
      log.warn("Unknown job type", { type: data.type });
  }
}

/**
 * Handle scheduled follow-up creation.
 * Called when delay_hours has elapsed for a rule.
 */
async function handleCreateScheduled(
  job: Job<FollowUpJobData>,
  data: FollowUpJobData
): Promise<void> {
  if (!data.ruleId || !data.entityType || !data.entityId || !data.followUpData) {
    log.error("Missing required data for scheduled follow-up", undefined, {
      jobId: job.id,
      hasRuleId: !!data.ruleId,
      hasEntityType: !!data.entityType,
      hasEntityId: !!data.entityId,
      hasFollowUpData: !!data.followUpData,
    });
    return;
  }

  const scheduledAt = new Date();

  try {
    const followUp = await FollowUpService.createAutomated(
      data.workspaceId,
      data.ruleId,
      data.entityType,
      data.entityId,
      {
        followUpType: data.followUpData.followUpType as FollowUpType,
        title: data.followUpData.title,
        description: data.followUpData.description,
        scheduledAt,
        priority: data.followUpData.priority as Priority,
        assignedTo: data.followUpData.assignedTo,
      }
    );

    log.info("Scheduled follow-up created", {
      jobId: job.id,
      followUpId: followUp.id,
      ruleId: data.ruleId,
      entityType: data.entityType,
      entityId: data.entityId,
    });
  } catch (error) {
    log.error("Failed to create scheduled follow-up", error instanceof Error ? error : new Error(String(error)), {
      jobId: job.id,
      ruleId: data.ruleId,
      entityType: data.entityType,
      entityId: data.entityId,
    });
    throw error; // Re-throw for retry
  }
}

/**
 * Handle processing of due follow-ups.
 * Runs every 5 minutes to find and process follow-ups.
 */
async function handleProcessDue(
  job: Job<FollowUpJobData>,
  _data: FollowUpJobData
): Promise<void> {
  try {
    // Process unsnoozed follow-ups (snooze time has passed)
    const unsnoozeCount = await FollowUpService.processUnsnooze();

    if (unsnoozeCount > 0) {
      log.info("Unsnoozed follow-ups", {
        jobId: job.id,
        count: unsnoozeCount,
      });
    }

    // Find overdue follow-ups across all workspaces
    // Note: In production, you might want to iterate by workspace
    // For now, we use the repository's findDueForUnsnooze which handles snoozed items
    // Additional processing (like sending notifications) would go here

    log.info("Due follow-up processing completed", {
      jobId: job.id,
      unsnoozed: unsnoozeCount,
    });
  } catch (error) {
    log.error("Failed to process due follow-ups", error instanceof Error ? error : new Error(String(error)), {
      jobId: job.id,
    });
    throw error;
  }
}

/**
 * Handle rule evaluation for an entity.
 * Called when an entity status changes.
 */
async function handleEvaluateRules(
  job: Job<FollowUpJobData>,
  data: FollowUpJobData
): Promise<void> {
  if (!data.entityType || !data.entityId) {
    log.error("Missing entity info for rule evaluation", undefined, {
      jobId: job.id,
    });
    return;
  }

  // Rule evaluation is handled by the caller via RulesEngine
  // This job is for async/deferred evaluation if needed
  log.info("Rule evaluation job processed", {
    jobId: job.id,
    workspaceId: data.workspaceId,
    entityType: data.entityType,
    entityId: data.entityId,
  });
}
