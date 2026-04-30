/**
 * Task Service
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Provides CRUD operations for tasks with D-11 Layer 2 user override operations:
 * - createTask: Create a task with source (default "manual")
 * - completeTask: Mark task complete
 * - pinTask: Pin task to My Focus section
 * - unpinTask: Remove from My Focus
 * - snoozeTask: Hide task until specified date
 * - updatePriority: Change task priority
 */
import { eq, and, isNull, or, lte, gte, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  tasks,
  type TaskInsert,
  type TaskSelect,
  type TaskPriority,
} from "@/db/tasks-schema";

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Create a new task.
 *
 * @param data - Task data (id, createdAt, updatedAt auto-generated)
 * @returns Created task
 */
export async function createTask(
  data: Omit<TaskInsert, "id" | "createdAt" | "updatedAt">
): Promise<TaskSelect> {
  const [task] = await db
    .insert(tasks)
    .values({
      ...data,
      id: nanoid(),
      source: data.source || "manual",
    })
    .returning();
  return task;
}

/**
 * Get a task by ID.
 *
 * @param taskId - Task ID
 * @returns Task or undefined
 */
export async function getTaskById(
  taskId: string
): Promise<TaskSelect | undefined> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  return task;
}

/**
 * Get all tasks for a workspace.
 *
 * @param workspaceId - Workspace ID
 * @param options - Filter options
 * @returns Array of tasks
 */
export async function getTasksByWorkspace(
  workspaceId: string,
  options?: {
    includeCompleted?: boolean;
    assignedTo?: string;
    clientId?: string;
  }
): Promise<TaskSelect[]> {
  const conditions = [eq(tasks.workspaceId, workspaceId)];

  if (!options?.includeCompleted) {
    conditions.push(isNull(tasks.completedAt));
  }

  if (options?.assignedTo) {
    conditions.push(eq(tasks.assignedTo, options.assignedTo));
  }

  if (options?.clientId) {
    conditions.push(eq(tasks.clientId, options.clientId));
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));
}

/**
 * Update a task.
 *
 * @param taskId - Task ID
 * @param data - Fields to update
 * @returns Updated task or undefined
 */
export async function updateTask(
  taskId: string,
  data: Partial<
    Omit<TaskInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">
  >
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set(data)
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Delete a task.
 *
 * @param taskId - Task ID
 */
export async function deleteTask(taskId: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, taskId));
}

// ============================================================================
// D-11 Layer 2: User Override Operations
// ============================================================================

/**
 * Mark a task as complete.
 *
 * @param taskId - Task ID
 * @param completedBy - User ID who completed the task
 * @returns Updated task or undefined
 */
export async function completeTask(
  taskId: string,
  completedBy: string
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({
      completedAt: new Date(),
      completedBy,
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Reopen a completed task.
 *
 * @param taskId - Task ID
 * @returns Updated task or undefined
 */
export async function reopenTask(
  taskId: string
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({
      completedAt: null,
      completedBy: null,
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Pin a task to My Focus section (D-11 Layer 2).
 * Sets pinnedAt to current timestamp.
 *
 * @param taskId - Task ID
 * @returns Updated task or undefined
 */
export async function pinTask(taskId: string): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({ pinnedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Unpin a task from My Focus section (D-11 Layer 2).
 * Sets pinnedAt to null.
 *
 * @param taskId - Task ID
 * @returns Updated task or undefined
 */
export async function unpinTask(
  taskId: string
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({ pinnedAt: null })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Snooze a task until specified date (D-11 Layer 2).
 * Task will be hidden from feed until the snooze date.
 *
 * @param taskId - Task ID
 * @param until - Date to show task again
 * @returns Updated task or undefined
 */
export async function snoozeTask(
  taskId: string,
  until: Date
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({ snoozedUntil: until })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Clear snooze from a task.
 *
 * @param taskId - Task ID
 * @returns Updated task or undefined
 */
export async function unsnoozeTask(
  taskId: string
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({ snoozedUntil: null })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Update task priority (D-11 Layer 2).
 *
 * @param taskId - Task ID
 * @param priority - New priority (high, medium, low)
 * @returns Updated task or undefined
 */
export async function updatePriority(
  taskId: string,
  priority: TaskPriority
): Promise<TaskSelect | undefined> {
  const [task] = await db
    .update(tasks)
    .set({ priority })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

/**
 * Get pinned tasks for My Focus section (D-11 Layer 5).
 * Returns up to 5 most recently pinned incomplete tasks.
 *
 * @param workspaceId - Workspace ID
 * @param userId - Optional user ID for assignment filter
 * @returns Array of pinned tasks (max 5)
 */
export async function getPinnedTasks(
  workspaceId: string,
  userId?: string
): Promise<TaskSelect[]> {
  const conditions = [
    eq(tasks.workspaceId, workspaceId),
    isNull(tasks.completedAt),
  ];

  // Pinned tasks have non-null pinnedAt
  // We'll filter in query by using SQL IS NOT NULL

  if (userId) {
    conditions.push(eq(tasks.assignedTo, userId));
  }

  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.pinnedAt));

  // Filter to only pinned and limit to 5
  return allTasks.filter((t) => t.pinnedAt !== null).slice(0, 5);
}

// ============================================================================
// Service Export
// ============================================================================

export const TaskService = {
  createTask,
  getTaskById,
  getTasksByWorkspace,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
  pinTask,
  unpinTask,
  snoozeTask,
  unsnoozeTask,
  updatePriority,
  getPinnedTasks,
};
