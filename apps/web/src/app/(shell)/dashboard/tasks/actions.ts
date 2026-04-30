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
 */
import { revalidatePath } from "next/cache";
import type { AggregatedTask } from "@/components/tasks/types";

// Base URL for open-seo-main API
const API_BASE = process.env.OPEN_SEO_API_URL ?? "http://localhost:3001";

/**
 * Fetch aggregated tasks for the workspace.
 */
export async function getTasks(
  workspaceId: string,
  userId: string
): Promise<AggregatedTask[]> {
  try {
    const response = await fetch(
      `${API_BASE}/api/tasks/aggregated?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("[getTasks] API error:", response.status);
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
    console.error("[getTasks] Error fetching tasks:", error);
    return [];
  }
}

/**
 * Mark a task as complete.
 */
export async function completeTask(taskId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
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
    console.error("[completeTask] Error:", error);
    throw error;
  }
}

/**
 * Pin a task to My Focus section (D-11 Layer 2).
 */
export async function pinTask(taskId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/pin`, {
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
    console.error("[pinTask] Error:", error);
    throw error;
  }
}

/**
 * Unpin a task from My Focus section (D-11 Layer 2).
 */
export async function unpinTask(taskId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/unpin`, {
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
    console.error("[unpinTask] Error:", error);
    throw error;
  }
}

/**
 * Snooze a task until specified date (D-11 Layer 2).
 */
export async function snoozeTask(taskId: string, until: Date): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/snooze`, {
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
    console.error("[snoozeTask] Error:", error);
    throw error;
  }
}

/**
 * Update task priority (D-11 Layer 2).
 */
export async function updateTaskPriority(
  taskId: string,
  priority: "high" | "medium" | "low"
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/priority`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task priority: ${response.status}`);
    }

    revalidatePath("/dashboard/tasks");
  } catch (error) {
    console.error("[updateTaskPriority] Error:", error);
    throw error;
  }
}
