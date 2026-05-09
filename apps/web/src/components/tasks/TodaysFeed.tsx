"use client";

/**
 * TodaysFeed Component
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Main task feed component implementing:
 * - D-11 Layer 3: Sort mode toggle (Smart Priority, Due Date, Deal Value, Client Name)
 * - D-11 Layer 5: My Focus section integration
 */
import { useState } from "react";

import { ArrowUpDown, Plus, ListTodo } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@tevero/ui";
import { Button } from "@tevero/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tevero/ui";

import { MyFocusSection } from "./MyFocusSection";
import { TaskItem } from "./TaskItem";
import { SORT_MODE_LABELS } from "./types";

import type { AggregatedTask, SortMode } from "./types";

interface TodaysFeedProps {
  /** All aggregated tasks */
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
  /** Add new task handler */
  onAddTask: () => void;
}

/**
 * Sort tasks based on the selected sort mode.
 */
function sortTasks(tasks: AggregatedTask[], mode: SortMode): AggregatedTask[] {
  const sorted = [...tasks];

  switch (mode) {
    case "smart":
      // Sort by urgency score descending (default from backend)
      sorted.sort((a, b) => b.urgencyScore - a.urgencyScore);
      break;

    case "due_date":
      // Sort by due date ascending (nulls last)
      sorted.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return a.dueAt.getTime() - b.dueAt.getTime();
      });
      break;

    case "deal_value":
      // Sort by deal value descending (nulls last)
      sorted.sort((a, b) => (b.dealValueCents ?? 0) - (a.dealValueCents ?? 0));
      break;

    case "client_name":
      // Sort alphabetically by client name (nulls last)
      sorted.sort((a, b) => {
        if (!a.clientName && !b.clientName) return 0;
        if (!a.clientName) return 1;
        if (!b.clientName) return -1;
        return a.clientName.localeCompare(b.clientName);
      });
      break;
  }

  return sorted;
}

/**
 * TodaysFeed displays the main task list with sort controls and My Focus section.
 *
 * D-11 Layer 3: Sort mode toggle allows switching between:
 * - Smart Priority (urgency score)
 * - Due Date
 * - Deal Value
 * - Client Name
 *
 * D-11 Layer 5: My Focus section shows pinned tasks separately.
 *
 * @example
 * <TodaysFeed
 *   tasks={tasks}
 *   onComplete={handleComplete}
 *   onPin={handlePin}
 *   onUnpin={handleUnpin}
 *   onSnooze={handleSnooze}
 *   onSetPriority={handlePriority}
 *   onClick={handleClick}
 *   onAddTask={handleAddTask}
 * />
 */
export function TodaysFeed({
  tasks,
  onComplete,
  onPin,
  onUnpin,
  onSnooze,
  onSetPriority,
  onClick,
  onAddTask,
}: TodaysFeedProps) {
  // D-11 Layer 3: Sort mode toggle
  const [sortMode, setSortMode] = useState<SortMode>("smart");

  // Sort tasks based on selected mode
  const sortedTasks = sortTasks(tasks, sortMode);

  // Separate pinned tasks (shown in My Focus) from unpinned
  const unpinnedTasks = sortedTasks.filter((t) => !t.pinnedAt);

  return (
    <div className="space-y-4">
      {/* D-11 Layer 5: My Focus section */}
      <MyFocusSection
        tasks={tasks}
        onComplete={onComplete}
        onPin={onPin}
        onUnpin={onUnpin}
        onSnooze={onSnooze}
        onSetPriority={onSetPriority}
        onClick={onClick}
      />

      {/* Main task list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" />
            Today&apos;s Tasks
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* D-11 Layer 3: Sort mode toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {SORT_MODE_LABELS[sortMode]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_MODE_LABELS) as SortMode[]).map((mode) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={sortMode === mode ? "bg-muted" : ""}
                  >
                    {SORT_MODE_LABELS[mode]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add task button */}
            <Button size="sm" onClick={onAddTask}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1">
          {unpinnedTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No tasks for today. Great job!
              </p>
            </div>
          ) : (
            unpinnedTasks.map((task) => (
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
