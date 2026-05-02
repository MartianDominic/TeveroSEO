/**
 * Rules Engine
 * Phase 62-02: Follow-up system with rules engine
 *
 * Evaluates trigger conditions and creates follow-ups based on rules.
 * Supports immediate and delayed follow-up creation via BullMQ.
 *
 * Threat mitigations:
 * - T-62-02-02: Rule conditions validated via Zod schema before storage
 * - T-62-02-03: Rate limit rule evaluations via queue backpressure
 */
import { FollowUpRulesRepository } from "../repositories/FollowUpRulesRepository";
import { FollowUpService } from "./FollowUpService";
import type {
  EntityType,
  TriggerConditions,
  ActionConfig,
  FollowUpRuleSelect,
  FollowUpSelect,
} from "@/db/follow-up-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "RulesEngine" });

/**
 * Entity event for rule evaluation.
 */
export interface EntityEvent {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  eventType: "status_changed" | "created" | "updated" | "overdue";
  previousStatus?: string;
  currentStatus?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Job data for scheduled follow-up creation.
 */
export interface FollowUpJobData {
  type: "create_scheduled" | "process_due" | "evaluate_rules";
  workspaceId: string;
  ruleId?: string;
  entityType?: EntityType;
  entityId?: string;
  followUpData?: {
    followUpType: string;
    title: string;
    description?: string;
    priority: string;
    assignedTo?: string;
  };
}

/**
 * Queue add function type (passed from outside to avoid circular deps).
 */
export type QueueAddFn = (
  name: string,
  data: FollowUpJobData,
  options?: { delay?: number; jobId?: string }
) => Promise<void>;

/**
 * Evaluate a single rule's trigger conditions against an event.
 *
 * Conditions use AND logic - all specified conditions must match.
 *
 * @param conditions - Trigger conditions from the rule
 * @param event - Entity event being processed
 * @param entityData - Current entity data for comparison
 * @returns true if all conditions match, false otherwise
 */
export function evaluateTriggerConditions(
  conditions: TriggerConditions,
  event: EntityEvent,
  entityData: Record<string, unknown>
): boolean {
  // Track if any condition was specified
  let hasConditions = false;
  let allMatch = true;

  // status_changed_to: Check if entity status changed to specific value
  if (conditions.status_changed_to !== undefined) {
    hasConditions = true;
    if (event.currentStatus !== conditions.status_changed_to) {
      allMatch = false;
    }
  }

  // status_equals: Check if current status equals value
  if (conditions.status_equals !== undefined) {
    hasConditions = true;
    if (entityData.status !== conditions.status_equals) {
      allMatch = false;
    }
  }

  // days_since: Check if N days have passed since creation
  if (conditions.days_since !== undefined) {
    hasConditions = true;
    const createdAt = entityData.created_at as string | undefined;
    if (createdAt) {
      const daysSince = getDaysSince(new Date(createdAt));
      if (daysSince < conditions.days_since) {
        allMatch = false;
      }
    } else {
      allMatch = false;
    }
  }

  // days_overdue_gte: Check if invoice is N+ days overdue
  if (conditions.days_overdue_gte !== undefined) {
    hasConditions = true;
    const dueDate = entityData.due_date as string | undefined;
    if (dueDate) {
      const daysOverdue = getDaysSince(new Date(dueDate));
      if (daysOverdue < conditions.days_overdue_gte) {
        allMatch = false;
      }
    } else {
      allMatch = false;
    }
  }

  // value_gte_cents: Check if entity value is >= threshold
  if (conditions.value_gte_cents !== undefined) {
    hasConditions = true;
    // Check multiple possible value fields
    const value =
      (entityData.total_value_cents as number) ??
      (entityData.deal_value_cents as number) ??
      (entityData.total_cents as number) ??
      0;
    if (value < conditions.value_gte_cents) {
      allMatch = false;
    }
  }

  // If no conditions specified, don't match
  if (!hasConditions) {
    return false;
  }

  return allMatch;
}

/**
 * Calculate days since a given date.
 */
function getDaysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Rules Engine class for processing entity events.
 */
export class RulesEngine {
  private queueAdd: QueueAddFn;

  constructor(queueAdd: QueueAddFn) {
    this.queueAdd = queueAdd;
  }

  /**
   * Process an entity event and create follow-ups for matching rules.
   *
   * @param event - Entity event to process
   * @param entityData - Current entity data for condition evaluation
   * @returns Array of created follow-ups (only immediate ones)
   */
  async processEntityEvent(
    event: EntityEvent,
    entityData: Record<string, unknown>
  ): Promise<FollowUpSelect[]> {
    // Find active rules for this entity type
    const rules = await FollowUpRulesRepository.findByEntityType(
      event.workspaceId,
      event.entityType
    );

    const createdFollowUps: FollowUpSelect[] = [];

    for (const rule of rules) {
      try {
        // Evaluate trigger conditions
        const matches = evaluateTriggerConditions(
          rule.triggerConditions,
          event,
          entityData
        );

        if (!matches) {
          log.debug("Rule conditions not matched", {
            ruleId: rule.id,
            entityType: event.entityType,
            entityId: event.entityId,
          });
          continue;
        }

        log.info("Rule matched", {
          ruleId: rule.id,
          ruleName: rule.name,
          entityType: event.entityType,
          entityId: event.entityId,
        });

        // Check if delay is needed
        if (rule.delayHours && rule.delayHours > 0) {
          // Schedule delayed follow-up
          await this.scheduleDelayedFollowUp(rule, event);
        } else {
          // Create follow-up immediately
          const followUp = await this.createFollowUpFromRule(rule, event);
          if (followUp) {
            createdFollowUps.push(followUp);
          }
        }
      } catch (error) {
        log.error("Error processing rule", error instanceof Error ? error : new Error(String(error)), {
          ruleId: rule.id,
          entityType: event.entityType,
          entityId: event.entityId,
        });
      }
    }

    return createdFollowUps;
  }

  /**
   * Schedule a delayed follow-up via BullMQ.
   */
  async scheduleDelayedFollowUp(
    rule: FollowUpRuleSelect,
    event: EntityEvent
  ): Promise<void> {
    const delayMs = (rule.delayHours ?? 0) * 60 * 60 * 1000;
    const actionConfig = rule.actionConfig;

    const jobData: FollowUpJobData = {
      type: "create_scheduled",
      workspaceId: event.workspaceId,
      ruleId: rule.id,
      entityType: event.entityType,
      entityId: event.entityId,
      followUpData: {
        followUpType: actionConfig.follow_up_type,
        title: this.interpolateTemplate(
          actionConfig.title_template ?? `Follow-up: ${rule.name}`,
          event
        ),
        priority: actionConfig.priority,
        assignedTo:
          actionConfig.assign_to === "owner" ? undefined : actionConfig.assign_to,
      },
    };

    await this.queueAdd("create_scheduled", jobData, {
      delay: delayMs,
      jobId: `scheduled-${rule.id}-${event.entityId}`,
    });

    log.info("Delayed follow-up scheduled", {
      ruleId: rule.id,
      entityId: event.entityId,
      delayHours: rule.delayHours,
    });
  }

  /**
   * Create a follow-up immediately from a rule.
   */
  private async createFollowUpFromRule(
    rule: FollowUpRuleSelect,
    event: EntityEvent
  ): Promise<FollowUpSelect | null> {
    const actionConfig = rule.actionConfig;

    // Calculate scheduled_at - immediate follow-ups are scheduled for now
    const scheduledAt = new Date();

    try {
      const followUp = await FollowUpService.createAutomated(
        event.workspaceId,
        rule.id,
        event.entityType,
        event.entityId,
        {
          followUpType: actionConfig.follow_up_type,
          title: this.interpolateTemplate(
            actionConfig.title_template ?? `Follow-up: ${rule.name}`,
            event
          ),
          scheduledAt,
          priority: actionConfig.priority,
          assignedTo:
            actionConfig.assign_to === "owner"
              ? undefined
              : actionConfig.assign_to,
        }
      );

      return followUp;
    } catch (error) {
      log.error("Failed to create follow-up from rule", error instanceof Error ? error : new Error(String(error)), {
        ruleId: rule.id,
        entityType: event.entityType,
        entityId: event.entityId,
      });
      return null;
    }
  }

  /**
   * Interpolate variables in a title template.
   */
  private interpolateTemplate(
    template: string,
    event: EntityEvent
  ): string {
    return template
      .replace(/\{\{entity_type\}\}/g, event.entityType)
      .replace(/\{\{entity_id\}\}/g, event.entityId)
      .replace(/\{\{workspace_id\}\}/g, event.workspaceId);
  }
}
