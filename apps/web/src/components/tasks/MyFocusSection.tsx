"use client";

/**
 * MyFocusSection Component
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements D-11 Layer 5: My Focus section
 * - Shows up to 5 pinned tasks
 * - Allows user to focus on specific tasks
 */
import { Card, CardHeader, CardTitle, CardContent } from "@tevero/ui";
import { Target } from "lucide-react";
import { TaskItem } from "./TaskItem";
import type { AggregatedTask } from "./types";

interface MyFocusSectionProps {
  /** All tasks (will filter to pinned) */
  tasks: AggregatedTask[];
  /** Complete a task */
  onComplete: (taskId: string) => Promise<void>;
  /** Pin a task */
  onPin: (taskId: string) => Promise<void>;
  /** Unpin a task */
  onUnpin: (taskId: string) => Promise<void>;
  /** Snooze a task */
  onSnooze: (taskId: string, until: Date) => Promise<void>;
  /** Set task priority */
  onSetPriority: (
    taskId: string,
    priority: "high" | "medium" | "low"
  ) => Promise<void>;
  /** Click handler for task navigation */
  onClick: (taskId: string) => void;
}

/**
 * Maximum number of tasks in My Focus section (D-11 Layer 5).
 */
const MAX_FOCUS_TASKS = 5;

/**
 * MyFocusSection displays up to 5 pinned tasks for focused attention.
 *
 * D-11 Layer 5: Users can pin tasks to this section for daily focus.
 * Only the most recently pinned tasks are shown (max 5).
 *
 * @example
 * <MyFocusSection
 *   tasks={allTasks}
 *   onComplete={handleComplete}
 *   onPin={handlePin}
 *   onUnpin={handleUnpin}
 *   onSnooze={handleSnooze}
 *   onSetPriority={handlePriority}
 *   onClick={handleClick}
 * />
 */
export function MyFocusSection({
  tasks,
  onComplete,
  onPin,
  onUnpin,
  onSnooze,
  onSetPriority,
  onClick,
}: MyFocusSectionProps) {
  // D-11 Layer 5: Filter to pinned tasks and limit to 5
  const focusTasks = tasks
    .filter((t) => t.pinnedAt !== null)
    .sort((a, b) => {
      // Sort by pinnedAt descending (most recently pinned first)
      if (!a.pinnedAt || !b.pinnedAt) return 0;
      return b.pinnedAt.getTime() - a.pinnedAt.getTime();
    })
    .slice(0, MAX_FOCUS_TASKS);

  // Don't render if no pinned tasks
  if (focusTasks.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-blue-500" />
          My Focus ({focusTasks.length}/{MAX_FOCUS_TASKS})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {focusTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onComplete={() => onComplete(task.id)}
            onPin={() => onPin(task.id)}
            onUnpin={() => onUnpin(task.id)}
            onSnooze={(until) => onSnooze(task.id, until)}
            onSetPriority={(p) => onSetPriority(task.id, p)}
            onClick={() => onClick(task.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
