"use client";

/**
 * TodaysFeedClient Component
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Client component wrapper for TodaysFeed that handles:
 * - Server action callbacks
 * - Client-side navigation
 * - Add task modal state
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TodaysFeed, type AggregatedTask } from "@/components/tasks";
import {
  completeTask,
  pinTask,
  unpinTask,
  snoozeTask,
  updateTaskPriority,
} from "./actions";

interface TodaysFeedClientProps {
  /** Initial tasks from server */
  initialTasks: AggregatedTask[];
}

/**
 * Client wrapper for TodaysFeed component.
 *
 * Handles server action calls and provides optimistic updates.
 */
export function TodaysFeedClient({ initialTasks }: TodaysFeedClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState<AggregatedTask[]>(initialTasks);

  /**
   * Handle task completion with optimistic update.
   */
  const handleComplete = async (taskId: string) => {
    // Optimistic: remove from list
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await completeTask(taskId);
    } catch (error) {
      // Revert on error
      setTasks(initialTasks);
      throw error;
    }
  };

  /**
   * Handle task pin with optimistic update.
   */
  const handlePin = async (taskId: string) => {
    // Optimistic: set pinnedAt
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, pinnedAt: new Date() } : t))
    );

    try {
      await pinTask(taskId);
    } catch (error) {
      setTasks(initialTasks);
      throw error;
    }
  };

  /**
   * Handle task unpin with optimistic update.
   */
  const handleUnpin = async (taskId: string) => {
    // Optimistic: clear pinnedAt
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, pinnedAt: null } : t))
    );

    try {
      await unpinTask(taskId);
    } catch (error) {
      setTasks(initialTasks);
      throw error;
    }
  };

  /**
   * Handle task snooze with optimistic update.
   */
  const handleSnooze = async (taskId: string, until: Date) => {
    // Optimistic: remove from list (snoozed tasks are filtered)
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await snoozeTask(taskId, until);
    } catch (error) {
      setTasks(initialTasks);
      throw error;
    }
  };

  /**
   * Handle task priority change with optimistic update.
   */
  const handleSetPriority = async (
    taskId: string,
    priority: "high" | "medium" | "low"
  ) => {
    // Optimistic: update priority
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, priority } : t))
    );

    try {
      await updateTaskPriority(taskId, priority);
    } catch (error) {
      setTasks(initialTasks);
      throw error;
    }
  };

  /**
   * Handle task click - navigate to task detail or source entity.
   */
  const handleClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Navigate based on source
    switch (task.source) {
      case "pipeline":
        if (task.entityId) {
          router.push(`/prospects/${task.entityId}`);
        }
        break;
      case "checklist":
        if (task.clientId) {
          router.push(`/onboarding/${task.clientId}`);
        }
        break;
      case "expiring":
        if (task.entityId) {
          router.push(`/contracts/${task.entityId}`);
        }
        break;
      default:
        // For manual and other tasks, could open a detail modal
        break;
    }
  };

  /**
   * Handle add task - open modal (TODO: implement modal).
   */
  const handleAddTask = () => {
    // TODO: Open add task modal
    console.log("[TodaysFeedClient] Add task clicked");
  };

  return (
    <TodaysFeed
      tasks={tasks}
      onComplete={handleComplete}
      onPin={handlePin}
      onUnpin={handleUnpin}
      onSnooze={handleSnooze}
      onSetPriority={handleSetPriority}
      onClick={handleClick}
      onAddTask={handleAddTask}
    />
  );
}
