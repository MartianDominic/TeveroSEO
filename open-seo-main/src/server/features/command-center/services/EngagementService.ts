/**
 * EngagementService
 * Phase 62-03: Engagement Workflow Engine
 *
 * Manages workflow lifecycle: start, pause, resume, snooze, complete.
 * Enforces anti-annoyance safeguards and tracks engagement metrics.
 */
import type { Queue } from "bullmq";
import {
  WorkflowRepository,
  getWorkflowRepository,
} from "../repositories/WorkflowRepository";
import type {
  WorkflowInstanceSelect,
  WorkflowInstanceStatus,
  EntityType,
} from "@/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "EngagementService" });

export interface WorkflowJobData {
  type:
    | "execute_step"
    | "unsnooze"
    | "reset_weekly_touches"
    | "start_from_trigger";
  instanceId?: string;
  workspaceId?: string;
  templateId?: string;
  entityType?: EntityType;
  entityId?: string;
}

export class EngagementService {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly queue: Queue<WorkflowJobData>
  ) {}

  /**
   * Start a workflow instance for an entity.
   *
   * @param workspaceId - Workspace ID
   * @param templateId - Template to use
   * @param entityType - Type of entity (proposal, contract, etc.)
   * @param entityId - Entity ID
   * @param context - Additional context for step personalization
   * @returns Created workflow instance
   * @throws If active workflow already exists for the entity
   */
  async startWorkflow(
    workspaceId: string,
    templateId: string,
    entityType: EntityType,
    entityId: string,
    context: Record<string, unknown> = {}
  ): Promise<WorkflowInstanceSelect> {
    // Check for existing active workflow
    const existing = await this.workflowRepo.findByEntity(entityType, entityId);
    if (existing) {
      throw new Error(
        `Active workflow already exists for ${entityType}:${entityId}`
      );
    }

    // Verify template exists
    const template = await this.workflowRepo.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Create instance
    const instance = await this.workflowRepo.create({
      workspaceId,
      templateId,
      entityType,
      entityId,
      status: "active",
      currentStep: 0,
      touchesThisWeek: 0,
      context,
    });

    // Schedule first step execution
    await this.scheduleNextStep(instance);

    // Log event
    await this.workflowRepo.logEvent(instance.id, "started", {
      triggeredBy: "system",
      result: { templateId, entityType, entityId },
    });

    log.info("Workflow started", {
      instanceId: instance.id,
      templateId,
      entityType,
      entityId,
    });

    return instance;
  }

  /**
   * Snooze a workflow until a specific date.
   *
   * @param instanceId - Workflow instance ID
   * @param snoozedUntil - Date to resume
   * @param reason - Optional reason for snoozing
   */
  async snoozeWorkflow(
    instanceId: string,
    snoozedUntil: Date,
    reason?: string
  ): Promise<void> {
    const instance = await this.workflowRepo.findById(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Update status
    await this.workflowRepo.update(instanceId, {
      status: "snoozed",
      snoozedUntil,
      snoozeReason: reason ?? null,
    });

    // Schedule unsnooze job
    const delay = snoozedUntil.getTime() - Date.now();
    await this.queue.add(
      "unsnooze",
      { type: "unsnooze", instanceId },
      {
        delay: Math.max(delay, 0),
        jobId: `unsnooze-${instanceId}`,
      }
    );

    // Log event
    await this.workflowRepo.logEvent(instanceId, "snoozed", {
      result: { snoozedUntil: snoozedUntil.toISOString(), reason },
    });

    log.info("Workflow snoozed", { instanceId, snoozedUntil, reason });
  }

  /**
   * Pause a workflow.
   *
   * @param instanceId - Workflow instance ID
   */
  async pauseWorkflow(instanceId: string): Promise<void> {
    await this.workflowRepo.update(instanceId, {
      status: "paused",
    });

    await this.workflowRepo.logEvent(instanceId, "paused");
    log.info("Workflow paused", { instanceId });
  }

  /**
   * Resume a paused or snoozed workflow.
   *
   * @param instanceId - Workflow instance ID
   */
  async resumeWorkflow(instanceId: string): Promise<void> {
    const instance = await this.workflowRepo.findById(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Clear snooze and set active
    await this.workflowRepo.update(instanceId, {
      status: "active",
      snoozedUntil: null,
      snoozeReason: null,
    });

    // Schedule next step
    await this.scheduleNextStep(instance);

    // Log event
    await this.workflowRepo.logEvent(instanceId, "resumed");
    log.info("Workflow resumed", { instanceId });
  }

  /**
   * Complete a workflow with an outcome.
   *
   * @param instanceId - Workflow instance ID
   * @param outcome - Final status (won, lost, completed, cancelled)
   * @param reason - Optional reason
   */
  async completeWorkflow(
    instanceId: string,
    outcome: "won" | "lost" | "completed" | "cancelled",
    reason?: string
  ): Promise<void> {
    await this.workflowRepo.update(instanceId, {
      status: outcome,
      completedAt: new Date(),
      outcomeReason: reason ?? null,
    });

    await this.workflowRepo.logEvent(instanceId, "completed", {
      result: { outcome, reason },
    });

    log.info("Workflow completed", { instanceId, outcome, reason });
  }

  /**
   * Handle response detection (email reply, proposal viewed, etc.).
   * May pause the workflow if skipOnResponse is enabled.
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param responseType - Type of response detected
   */
  async handleResponseDetected(
    entityType: EntityType,
    entityId: string,
    responseType: string
  ): Promise<void> {
    // Find active workflow for entity
    const instance = await this.workflowRepo.findByEntity(entityType, entityId);
    if (!instance || instance.status !== "active") {
      return;
    }

    // Get template to check skipOnResponse setting
    const template = await this.workflowRepo.getTemplateById(
      instance.templateId
    );
    if (!template) {
      return;
    }

    // Update last response timestamp
    if (template.skipOnResponse) {
      // Pause workflow on response
      await this.workflowRepo.update(instance.id, {
        status: "paused",
        lastResponseAt: new Date(),
      });

      await this.workflowRepo.logEvent(instance.id, "response_detected", {
        result: { responseType, action: "paused" },
      });

      log.info("Workflow paused on response", {
        instanceId: instance.id,
        responseType,
      });
    } else {
      // Just update timestamp, continue workflow
      await this.workflowRepo.update(instance.id, {
        lastResponseAt: new Date(),
      });

      await this.workflowRepo.logEvent(instance.id, "response_detected", {
        result: { responseType, action: "continued" },
      });
    }
  }

  /**
   * Check if a touch can be executed (anti-annoyance safeguards).
   *
   * @param instance - Workflow instance
   * @returns true if touch is allowed
   */
  async canExecuteTouch(instance: WorkflowInstanceSelect): Promise<boolean> {
    const template = await this.workflowRepo.getTemplateById(
      instance.templateId
    );
    if (!template) {
      return false;
    }

    // Check weekly touch limit
    const touchesThisWeek = instance.touchesThisWeek ?? 0;
    if (touchesThisWeek >= template.maxTouchesPerWeek) {
      log.debug("Touch blocked: weekly limit reached", {
        instanceId: instance.id,
        touchesThisWeek,
        maxTouchesPerWeek: template.maxTouchesPerWeek,
      });
      return false;
    }

    // Check cooldown period
    if (instance.lastTouchAt) {
      const hoursSinceLastTouch =
        (Date.now() - instance.lastTouchAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastTouch < template.cooldownHours) {
        log.debug("Touch blocked: cooldown period", {
          instanceId: instance.id,
          hoursSinceLastTouch,
          cooldownHours: template.cooldownHours,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Increment touch count after executing a touch step.
   *
   * @param instanceId - Workflow instance ID
   */
  async incrementTouchCount(instanceId: string): Promise<void> {
    await this.workflowRepo.incrementTouchCount(instanceId);
  }

  /**
   * Schedule the next step for a workflow instance.
   *
   * @param instance - Workflow instance
   */
  private async scheduleNextStep(
    instance: WorkflowInstanceSelect
  ): Promise<void> {
    await this.queue.add(
      "execute-step",
      {
        type: "execute_step",
        instanceId: instance.id,
      },
      {
        jobId: `step-${instance.id}-${instance.currentStep}`,
      }
    );
  }

  /**
   * Advance to the next step.
   *
   * @param instanceId - Workflow instance ID
   */
  async advanceStep(instanceId: string): Promise<void> {
    const instance = await this.workflowRepo.findById(instanceId);
    if (!instance) return;

    await this.workflowRepo.update(instanceId, {
      currentStep: instance.currentStep + 1,
    });

    // Schedule execution of the new step
    await this.scheduleNextStep({
      ...instance,
      currentStep: instance.currentStep + 1,
    });
  }

  /**
   * Schedule step execution with delay.
   *
   * @param instanceId - Workflow instance ID
   * @param delayMs - Delay in milliseconds
   */
  async scheduleStepWithDelay(
    instanceId: string,
    delayMs: number
  ): Promise<void> {
    const instance = await this.workflowRepo.findById(instanceId);
    if (!instance) return;

    await this.queue.add(
      "execute-step",
      {
        type: "execute_step",
        instanceId: instance.id,
      },
      {
        delay: delayMs,
        jobId: `step-${instance.id}-${instance.currentStep}-delayed`,
      }
    );
  }
}

// Singleton instance
let engagementServiceInstance: EngagementService | null = null;

/**
 * Get the singleton EngagementService instance.
 * Requires queue to be passed on first call.
 *
 * @param queue - BullMQ queue for job scheduling
 */
export function getEngagementService(
  queue?: Queue<WorkflowJobData>
): EngagementService {
  if (!engagementServiceInstance) {
    if (!queue) {
      throw new Error("Queue required for first EngagementService initialization");
    }
    engagementServiceInstance = new EngagementService(
      getWorkflowRepository(),
      queue
    );
  }
  return engagementServiceInstance;
}
