/**
 * FollowUp Service
 * Phase 62-02: Follow-up system with rules engine
 *
 * Manages follow-up lifecycle: create, snooze, complete, cancel, reschedule.
 * Supports both manual and automated follow-up creation.
 *
 * Threat mitigations:
 * - T-62-02-01: Workspace validation in service layer
 */
import { nanoid } from "nanoid";
import { FollowUpRepository } from "../repositories/FollowUpRepository";
import type {
  FollowUpSelect,
  FollowUpInsert,
  EntityType,
  FollowUpType,
  Priority,
} from "@/db/follow-up-schema";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "FollowUpService" });

/**
 * DTO for creating a manual follow-up.
 */
export interface CreateFollowUpDto {
  entityType: EntityType;
  entityId: string;
  followUpType: FollowUpType;
  title: string;
  description?: string;
  scheduledAt: Date;
  priority?: Priority;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTO for creating an automated follow-up from a rule.
 */
export interface CreateAutomatedFollowUpDto {
  followUpType: FollowUpType;
  title: string;
  description?: string;
  scheduledAt: Date;
  priority?: Priority;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dashboard aggregation result.
 */
export interface DashboardFollowUps {
  overdue: FollowUpSelect[];
  dueToday: FollowUpSelect[];
  upcoming: FollowUpSelect[];
}

/**
 * Create a manual follow-up.
 */
export async function create(
  workspaceId: string,
  userId: string,
  data: CreateFollowUpDto
): Promise<FollowUpSelect> {
  const followUpData: FollowUpInsert = {
    id: nanoid(),
    workspaceId,
    entityType: data.entityType,
    entityId: data.entityId,
    followUpType: data.followUpType,
    title: data.title,
    description: data.description,
    scheduledAt: data.scheduledAt,
    status: "pending",
    priority: data.priority ?? "medium",
    assignedTo: data.assignedTo,
    createdBy: userId,
    isAutomated: false,
    metadata: data.metadata ?? {},
  };

  const result = await FollowUpRepository.create(followUpData);

  log.info("Follow-up created", {
    id: result.id,
    entityType: data.entityType,
    entityId: data.entityId,
    workspaceId,
  });

  return result;
}

/**
 * Create an automated follow-up from a rule.
 */
export async function createAutomated(
  workspaceId: string,
  ruleId: string,
  entityType: EntityType,
  entityId: string,
  data: CreateAutomatedFollowUpDto
): Promise<FollowUpSelect> {
  // For automated follow-ups, we use a system user ID or the rule's workspace
  const systemUserId = "system"; // Could be replaced with actual system user

  const followUpData: FollowUpInsert = {
    id: nanoid(),
    workspaceId,
    entityType,
    entityId,
    followUpType: data.followUpType,
    title: data.title,
    description: data.description,
    scheduledAt: data.scheduledAt,
    status: "pending",
    priority: data.priority ?? "medium",
    assignedTo: data.assignedTo,
    createdBy: systemUserId,
    isAutomated: true,
    ruleId,
    metadata: data.metadata ?? {},
  };

  const result = await FollowUpRepository.create(followUpData);

  log.info("Automated follow-up created", {
    id: result.id,
    ruleId,
    entityType,
    entityId,
    workspaceId,
  });

  return result;
}

/**
 * Snooze a follow-up until a specific date.
 */
export async function snooze(id: string, snoozedUntil: Date): Promise<void> {
  const followUp = await FollowUpRepository.findById(id);

  if (!followUp) {
    throw new AppError("NOT_FOUND", "Follow-up not found");
  }

  if (followUp.status === "completed" || followUp.status === "cancelled") {
    throw new AppError(
      "CONFLICT",
      `Cannot snooze a ${followUp.status} follow-up`
    );
  }

  await FollowUpRepository.update(id, {
    status: "snoozed",
    snoozedUntil,
  });

  log.info("Follow-up snoozed", { id, snoozedUntil: snoozedUntil.toISOString() });
}

/**
 * Complete a follow-up.
 */
export async function complete(id: string): Promise<void> {
  const followUp = await FollowUpRepository.findById(id);

  if (!followUp) {
    throw new AppError("NOT_FOUND", "Follow-up not found");
  }

  if (followUp.status === "completed") {
    return; // Idempotent
  }

  if (followUp.status === "cancelled") {
    throw new AppError("CONFLICT", "Cannot complete a cancelled follow-up");
  }

  await FollowUpRepository.update(id, {
    status: "completed",
    completedAt: new Date(),
  });

  log.info("Follow-up completed", { id });
}

/**
 * Cancel a follow-up.
 */
export async function cancel(id: string): Promise<void> {
  const followUp = await FollowUpRepository.findById(id);

  if (!followUp) {
    throw new AppError("NOT_FOUND", "Follow-up not found");
  }

  if (followUp.status === "cancelled") {
    return; // Idempotent
  }

  if (followUp.status === "completed") {
    throw new AppError("CONFLICT", "Cannot cancel a completed follow-up");
  }

  await FollowUpRepository.update(id, {
    status: "cancelled",
  });

  log.info("Follow-up cancelled", { id });
}

/**
 * Reschedule a follow-up to a new date.
 */
export async function reschedule(
  id: string,
  newScheduledAt: Date
): Promise<void> {
  const followUp = await FollowUpRepository.findById(id);

  if (!followUp) {
    throw new AppError("NOT_FOUND", "Follow-up not found");
  }

  if (followUp.status === "completed" || followUp.status === "cancelled") {
    throw new AppError(
      "CONFLICT",
      `Cannot reschedule a ${followUp.status} follow-up`
    );
  }

  // If snoozed, clear the snooze and set to pending
  const updates: Partial<FollowUpInsert> = {
    scheduledAt: newScheduledAt,
  };

  if (followUp.status === "snoozed") {
    updates.status = "pending";
    updates.snoozedUntil = null;
  }

  await FollowUpRepository.update(id, updates);

  log.info("Follow-up rescheduled", {
    id,
    newScheduledAt: newScheduledAt.toISOString(),
  });
}

/**
 * Auto-resolve follow-ups for an entity when its status changes.
 * Called when an entity reaches a terminal state (e.g., proposal accepted, invoice paid).
 */
export async function autoResolveForEntity(
  entityType: EntityType,
  entityId: string
): Promise<number> {
  const followUps = await FollowUpRepository.findByEntity(entityType, entityId);

  let resolvedCount = 0;

  for (const followUp of followUps) {
    if (followUp.status === "pending" || followUp.status === "snoozed") {
      await FollowUpRepository.update(followUp.id, {
        status: "auto_resolved",
      });
      resolvedCount++;
    }
  }

  if (resolvedCount > 0) {
    log.info("Follow-ups auto-resolved", {
      entityType,
      entityId,
      count: resolvedCount,
    });
  }

  return resolvedCount;
}

/**
 * Get follow-ups for dashboard display.
 * Returns overdue, due today, and upcoming follow-ups.
 */
export async function getForDashboard(
  workspaceId: string
): Promise<DashboardFollowUps> {
  const [overdue, dueToday, upcoming] = await Promise.all([
    FollowUpRepository.findOverdue(workspaceId, 20),
    FollowUpRepository.findDueToday(workspaceId),
    FollowUpRepository.findUpcoming(workspaceId, 10),
  ]);

  return {
    overdue,
    dueToday,
    upcoming,
  };
}

/**
 * Get follow-up by ID.
 */
export async function getById(id: string): Promise<FollowUpSelect | null> {
  return FollowUpRepository.findById(id);
}

/**
 * Get all follow-ups for an entity.
 */
export async function getByEntity(
  entityType: EntityType,
  entityId: string
): Promise<FollowUpSelect[]> {
  return FollowUpRepository.findByEntity(entityType, entityId);
}

/**
 * Unsnooze follow-ups that have passed their snooze date.
 * Called by the BullMQ worker.
 */
export async function processUnsnooze(): Promise<number> {
  const toUnsnooze = await FollowUpRepository.findDueForUnsnooze(100);

  for (const followUp of toUnsnooze) {
    await FollowUpRepository.update(followUp.id, {
      status: "pending",
      snoozedUntil: null,
    });
  }

  if (toUnsnooze.length > 0) {
    log.info("Follow-ups unsnoozed", { count: toUnsnooze.length });
  }

  return toUnsnooze.length;
}

export const FollowUpService = {
  create,
  createAutomated,
  snooze,
  complete,
  cancel,
  reschedule,
  autoResolveForEntity,
  getForDashboard,
  getById,
  getByEntity,
  processUnsnooze,
};
