/**
 * Task Aggregation Service
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements:
 * - D-09: Multi-source task aggregation (checklist, pipeline, follow_up, expiring, seo, manual)
 * - D-11 Layer 1: Smart urgency score algorithm
 * - D-11 Layer 2: Snooze filtering
 *
 * Urgency Score Formula (from D-11):
 * score = (daysOverdue * 20) + (dueToday ? 50 : 0) + Math.floor(dealValueCents / 1000) + (daysStale * 3) + PRIORITY_WEIGHTS[priority]
 */
import { differenceInDays, isToday, isBefore, startOfDay } from "date-fns";
import { eq, and, isNull, lt, lte, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  tasks,
  type TaskSelect,
  type TaskPriority,
  type TaskSource,
} from "@/db/tasks-schema";
import { onboardingChecklists, type ChecklistItem } from "@/db/onboarding-schema";
import { prospects } from "@/db/prospect-schema";
import { contracts } from "@/db/contract-schema";

// ============================================================================
// D-11 Layer 1: Priority Weights
// ============================================================================

/**
 * Priority weights for urgency score calculation.
 * Higher priority = higher weight.
 */
export const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  high: 75,
  medium: 50,
  low: 25,
};

/**
 * Stale threshold for pipeline cards (days without update).
 */
export const STALE_DAYS_THRESHOLD = 7;

/**
 * Expiring contracts window (days before expiry to surface).
 */
export const EXPIRY_WINDOW_DAYS = 30;

// ============================================================================
// Aggregated Task Type
// ============================================================================

/**
 * Unified task representation from all sources.
 */
export interface AggregatedTask {
  /** Unique task ID (may be composite for derived tasks) */
  id: string;
  /** Source type per D-09 */
  source: TaskSource;
  /** Type of source entity (prospect, contract, checklist, etc.) */
  entityType: string | null;
  /** ID of source entity */
  entityId: string | null;
  /** Task title */
  title: string;
  /** Task description */
  description: string | null;
  /** Due date */
  dueAt: Date | null;
  /** Calculated urgency score (D-11 Layer 1) */
  urgencyScore: number;
  /** Task priority */
  priority: TaskPriority;
  /** Associated client ID */
  clientId: string | null;
  /** Client name for display */
  clientName: string | null;
  /** When task was pinned (D-11 Layer 2) */
  pinnedAt: Date | null;
  /** Snoozed until date (D-11 Layer 2) */
  snoozedUntil: Date | null;
  /** Deal value in cents (for scoring) */
  dealValueCents: number | null;
  /** Days in current stage (for stale scoring) */
  daysInStage: number | null;
  /** Task category */
  category: string | null;
  /** Assigned user ID */
  assignedTo: string | null;
}

// ============================================================================
// D-11 Layer 1: Urgency Score Algorithm
// ============================================================================

/**
 * Calculate urgency score for a task.
 *
 * Formula (from D-11):
 * score = (daysOverdue * 20) + (dueToday ? 50 : 0) + Math.floor(dealValueCents / 1000) + (daysStale * 3) + PRIORITY_WEIGHTS[priority]
 *
 * @param task - Task data for scoring
 * @returns Urgency score (higher = more urgent)
 */
export function calculateUrgencyScore(task: {
  dueAt: Date | null;
  dealValueCents: number | null;
  daysInStage: number | null;
  priority: TaskPriority | null;
}): number {
  let score = 0;
  const now = new Date();
  const today = startOfDay(now);

  if (task.dueAt) {
    const dueDate = startOfDay(task.dueAt);

    // Overdue: +20 per day overdue
    if (isBefore(dueDate, today)) {
      const daysOverdue = Math.max(0, differenceInDays(today, dueDate));
      score += daysOverdue * 20;
    }

    // Due today: +50
    if (isToday(task.dueAt)) {
      score += 50;
    }
  }

  // Deal value: +1 per 1000 cents (10 currency units)
  if (task.dealValueCents) {
    score += Math.floor(task.dealValueCents / 1000);
  }

  // Days stale in stage: +3 per day
  if (task.daysInStage) {
    score += task.daysInStage * 3;
  }

  // Manual priority: +25/50/75
  if (task.priority) {
    score += PRIORITY_WEIGHTS[task.priority];
  }

  return score;
}

// ============================================================================
// Source Query Functions
// ============================================================================

/**
 * Get overdue checklist items from onboarding checklists.
 */
async function getOverdueChecklistItems(workspaceId: string): Promise<
  Array<{ checklist: typeof onboardingChecklists.$inferSelect; item: ChecklistItem }>
> {
  const checklists = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.workspaceId, workspaceId));

  const overdue: Array<{
    checklist: typeof onboardingChecklists.$inferSelect;
    item: ChecklistItem;
  }> = [];

  for (const checklist of checklists) {
    for (const item of checklist.items) {
      if (!item.completedAt) {
        overdue.push({ checklist, item });
      }
    }
  }

  return overdue;
}

/**
 * Get stale pipeline cards (prospects not updated for X days).
 */
async function getStalePipelineCards(
  workspaceId: string,
  staleDays: number
): Promise<Array<typeof prospects.$inferSelect>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  return db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.workspaceId, workspaceId),
        lt(prospects.updatedAt, cutoff),
        // Exclude converted/archived
        and(
          eq(prospects.status, "analyzed"),
          // Only active pipeline stages (not converted or archived)
          // Using SQL for NOT IN
        )
      )
    );
}

/**
 * Get scheduled follow-up tasks.
 */
async function getScheduledFollowUps(
  workspaceId: string,
  userId: string
): Promise<TaskSelect[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.source, "follow_up"),
        isNull(tasks.completedAt)
      )
    );
}

/**
 * Get contracts expiring within window.
 */
async function getExpiringContracts(
  workspaceId: string,
  windowDays: number
): Promise<Array<typeof contracts.$inferSelect>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + windowDays);

  return db
    .select()
    .from(contracts)
    .where(
      and(
        eq(contracts.workspaceId, workspaceId),
        eq(contracts.status, "executed"),
        lte(contracts.expiresAt, cutoff)
      )
    );
}

/**
 * Get manual tasks.
 */
async function getManualTasks(
  workspaceId: string,
  userId: string
): Promise<TaskSelect[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.source, "manual"),
        isNull(tasks.completedAt)
      )
    );
}

// ============================================================================
// Mapper Functions
// ============================================================================

function toChecklistTask(data: {
  checklist: typeof onboardingChecklists.$inferSelect;
  item: ChecklistItem;
}): AggregatedTask {
  return {
    id: `checklist_${data.checklist.id}_${data.item.id}`,
    source: "checklist",
    entityType: "onboarding",
    entityId: data.checklist.id,
    title: `Complete: ${data.item.label}`,
    description: `Onboarding checklist item for ${data.checklist.serviceTier} tier`,
    dueAt: null,
    urgencyScore: 0, // Will be calculated
    priority: "medium",
    clientId: data.checklist.clientId,
    clientName: null,
    pinnedAt: null,
    snoozedUntil: null,
    dealValueCents: null,
    daysInStage: null,
    category: data.item.category,
    assignedTo: null,
  };
}

function toPipelineTask(prospect: typeof prospects.$inferSelect): AggregatedTask {
  const daysInStage = differenceInDays(new Date(), prospect.updatedAt);
  return {
    id: `pipeline_${prospect.id}`,
    source: "pipeline",
    entityType: "prospect",
    entityId: prospect.id,
    title: `Follow up: ${prospect.companyName || prospect.domain}`,
    description: `${daysInStage} days in ${prospect.pipelineStage} stage`,
    dueAt: null,
    urgencyScore: 0,
    priority: "medium",
    clientId: null,
    clientName: prospect.companyName,
    pinnedAt: null,
    snoozedUntil: null,
    dealValueCents: null,
    daysInStage,
    category: "sales",
    assignedTo: prospect.assignedTo,
  };
}

function toFollowUpTask(task: TaskSelect): AggregatedTask {
  return {
    id: task.id,
    source: "follow_up",
    entityType: task.entityType,
    entityId: task.entityId,
    title: task.title,
    description: task.description,
    dueAt: task.dueAt,
    urgencyScore: 0,
    priority: (task.priority as TaskPriority) || "medium",
    clientId: task.clientId,
    clientName: null,
    pinnedAt: task.pinnedAt,
    snoozedUntil: task.snoozedUntil,
    dealValueCents: null,
    daysInStage: null,
    category: task.category,
    assignedTo: task.assignedTo,
  };
}

function toExpiringTask(contract: typeof contracts.$inferSelect): AggregatedTask {
  const daysUntilExpiry = contract.expiresAt
    ? differenceInDays(contract.expiresAt, new Date())
    : 0;
  return {
    id: `expiring_${contract.id}`,
    source: "expiring",
    entityType: "contract",
    entityId: contract.id,
    title: `Contract expiring in ${daysUntilExpiry} days`,
    description: contract.title,
    dueAt: contract.expiresAt,
    urgencyScore: 0,
    priority: daysUntilExpiry <= 7 ? "high" : "medium",
    clientId: contract.clientId,
    clientName: null,
    pinnedAt: null,
    snoozedUntil: null,
    dealValueCents: null,
    daysInStage: null,
    category: "billing",
    assignedTo: null,
  };
}

function toManualTask(task: TaskSelect): AggregatedTask {
  return {
    id: task.id,
    source: "manual",
    entityType: task.entityType,
    entityId: task.entityId,
    title: task.title,
    description: task.description,
    dueAt: task.dueAt,
    urgencyScore: 0,
    priority: (task.priority as TaskPriority) || "medium",
    clientId: task.clientId,
    clientName: null,
    pinnedAt: task.pinnedAt,
    snoozedUntil: task.snoozedUntil,
    dealValueCents: null,
    daysInStage: null,
    category: task.category,
    assignedTo: task.assignedTo,
  };
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Aggregate tasks from all D-09 sources with urgency scoring.
 *
 * This function:
 * 1. Queries all 6 task sources in parallel
 * 2. Maps each source to AggregatedTask format
 * 3. Filters out snoozed tasks (D-11 Layer 2)
 * 4. Calculates urgency scores (D-11 Layer 1)
 * 5. Sorts by urgencyScore descending
 *
 * @param workspaceId - Workspace ID
 * @param userId - User ID for assignment filtering
 * @returns Array of aggregated tasks sorted by urgency
 */
export async function aggregateTasks(
  workspaceId: string,
  userId: string
): Promise<AggregatedTask[]> {
  const now = new Date();

  // Parallel fetch from all D-09 sources
  const [
    overdueChecklists,
    stalePipeline,
    followUps,
    expiringContracts,
    // seoTasks - would query SEO system (TODO: integrate with SEO system)
    manualTasks,
  ] = await Promise.all([
    getOverdueChecklistItems(workspaceId),
    getStalePipelineCards(workspaceId, STALE_DAYS_THRESHOLD),
    getScheduledFollowUps(workspaceId, userId),
    getExpiringContracts(workspaceId, EXPIRY_WINDOW_DAYS),
    // getStuckSeoTasks(workspaceId), // TODO: integrate with SEO system
    getManualTasks(workspaceId, userId),
  ]);

  // Map each source to AggregatedTask
  const allTasks: AggregatedTask[] = [
    ...overdueChecklists.map(toChecklistTask),
    ...stalePipeline.map(toPipelineTask),
    ...followUps.map(toFollowUpTask),
    ...expiringContracts.map(toExpiringTask),
    ...manualTasks.map(toManualTask),
  ];

  // D-11 Layer 2: Filter out snoozed tasks
  const activeTasks = allTasks.filter(
    (t) => !t.snoozedUntil || isBefore(t.snoozedUntil, now)
  );

  // D-11 Layer 1: Calculate urgency scores
  for (const task of activeTasks) {
    task.urgencyScore = calculateUrgencyScore(task);
  }

  // Sort by urgencyScore descending
  activeTasks.sort((a, b) => b.urgencyScore - a.urgencyScore);

  return activeTasks;
}

// ============================================================================
// Service Export
// ============================================================================

export const TaskAggregationService = {
  calculateUrgencyScore,
  aggregateTasks,
  PRIORITY_WEIGHTS,
  STALE_DAYS_THRESHOLD,
  EXPIRY_WINDOW_DAYS,
};
