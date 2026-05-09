"use server";

/**
 * Tasks Page Server Actions
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Server actions for task operations:
 * - getTasks: Fetch aggregated tasks
 * - completeTask: Mark task complete
 * - pinTask/unpinTask: D-11 Layer 2 pin operations
 * - snoozeTask: D-11 Layer 2 snooze operation
 * - updateTaskPriority: D-11 Layer 2 priority operation
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 * CRIT-NX-02 FIX: Added requireActionAuth and validateWorkspaceMembership
 */
import { revalidatePath } from "next/cache";

import { z } from "zod";

import type { AggregatedTask } from "@/components/tasks/types";
import { requireActionAuth, validateWorkspaceMembership } from "@/lib/auth/action-auth";
import { getOpenSeoUrl } from "@/lib/env";
import { logger } from '@/lib/logger';

// Validation schemas
const workspaceIdSchema = z.string().min(1, "Workspace ID is required");
const userIdSchema = z.string().min(1, "User ID is required");
const taskIdSchema = z.string().min(1, "Task ID is required");
const prioritySchema = z.enum(["high", "medium", "low"]);
// CFG-CRIT-01 FIX: Use centralized env validation
const API_BASE = getOpenSeoUrl();

/**
 * Fetch aggregated tasks for the workspace.
 * CRIT-NX-02 FIX: Added auth and workspace validation to prevent IDOR
 */
export async function getTasks(
  workspaceId: string,
  userId: string
): Promise<AggregatedTask[]> {
  try {
    // SECURITY: Validate authentication and workspace membership
    const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);
    const validatedUserId = userIdSchema.parse(userId);
    const auth = await requireActionAuth();

    // IDOR FIX: Verify caller has access to this workspace
    await validateWorkspaceMembership(validatedWorkspaceId, auth);

    // IDOR FIX: Verify the userId matches the authenticated user
    // This prevents fetching another user's tasks
    if (validatedUserId !== auth.userId) {
      logger.warn("[getTasks] User ID mismatch", { requestedUserId: validatedUserId, authUserId: auth.userId });
      return [];
    }

    const response = await fetch(
      `${API_BASE}/api/tasks/aggregated?workspaceId=${encodeURIComponent(validatedWorkspaceId)}&userId=${encodeURIComponent(validatedUserId)}`,
      {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      logger.error("[getTasks] API error", { status: response.status });
      return [];
    }

    const data = await response.json();

    // Convert date strings to Date objects
    return (data.tasks ?? []).map((task: Record<string, unknown>) => ({
      ...task,
      dueAt: task.dueAt ? new Date(task.dueAt as string) : null,
      pinnedAt: task.pinnedAt ? new Date(task.pinnedAt as string) : null,
      snoozedUntil: task.snoozedUntil
        ? new Date(task.snoozedUntil as string)
        : null,
    }));
  } catch (error) {
    logger.error("[getTasks] Error fetching tasks", error instanceof Error ? error : { error: String(error) });
    return [];
  }
}

/**
 * Mark a task as complete.
 * CRIT-NX-02 FIX: Added auth validation
 */
export async function completeTask(taskId: string): Promise<void> {
  try {
    const validatedTaskId = taskIdSchema.parse(taskId);
    await requireActionAuth();

    const response = await fetch(`${API_BASE}/api/tasks/${validatedTaskId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to complete task: ${response.status}`);
    }

    revalidatePath("/dashboard/tasks");
  } catch (error) {
    logger.error("[completeTask] Error", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

/**
 * Pin a task to My Focus section (D-11 Layer 2).
 * CRIT-NX-02 FIX: Added auth validation
 */
export async function pinTask(taskId: string): Promise<void> {
  try {
    const validatedTaskId = taskIdSchema.parse(taskId);
    await requireActionAuth();

    const response = await fetch(`${API_BASE}/api/tasks/${validatedTaskId}/pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to pin task: ${response.status}`);
    }

    revalidatePath("/dashboard/tasks");
  } catch (error) {
    logger.error("[pinTask] Error", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

/**
 * Unpin a task from My Focus section (D-11 Layer 2).
 * CRIT-NX-02 FIX: Added auth validation
 */
export async function unpinTask(taskId: string): Promise<void> {
  try {
    const validatedTaskId = taskIdSchema.parse(taskId);
    await requireActionAuth();

    const response = await fetch(`${API_BASE}/api/tasks/${validatedTaskId}/unpin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to unpin task: ${response.status}`);
    }

    revalidatePath("/dashboard/tasks");
  } catch (error) {
    logger.error("[unpinTask] Error", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

/**
 * Snooze a task until specified date (D-11 Layer 2).
 * CRIT-NX-02 FIX: Added auth validation
 */
export async function snoozeTask(taskId: string, until: Date): Promise<void> {
  try {
    const validatedTaskId = taskIdSchema.parse(taskId);
    await requireActionAuth();

    const response = await fetch(`${API_BASE}/api/tasks/${validatedTaskId}/snooze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ until: until.toISOString() }),
    });

    if (!response.ok) {
      throw new Error(`Failed to snooze task: ${response.status}`);
    }

    revalidatePath("/dashboard/tasks");
  } catch (error) {
    logger.error("[snoozeTask] Error", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

/**
 * Update task priority (D-11 Layer 2).
 * CRIT-NX-02 FIX: Added auth validation
 */
export async function updateTaskPriority(
  taskId: string,
  priority: "high" | "medium" | "low"
): Promise<void> {
  try {
    const validatedTaskId = taskIdSchema.parse(taskId);
    const validatedPriority = prioritySchema.parse(priority);
    await requireActionAuth();

    const response = await fetch(`${API_BASE}/api/tasks/${validatedTaskId}/priority`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority: validatedPriority }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task priority: ${response.status}`);
    }

    revalidatePath("/dashboard/tasks");
  } catch (error) {
    logger.error("[updateTaskPriority] Error", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}
