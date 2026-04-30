"use client";

/**
 * TaskItem Component
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Displays a single task in the Today's Feed with:
 * - Urgency score badge (D-11 Layer 4)
 * - Pin/complete/snooze actions (D-11 Layer 2)
 * - Priority setting
 * - Source tag
 */
import { useState } from "react";
import { isBefore, isToday } from "date-fns";
import { TodayFeedItem } from "@tevero/ui";
import { Button } from "@tevero/ui";
import { Pin, Clock, Check, MoreHorizontal, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@tevero/ui";
import { cn } from "@/lib/utils";
import { UrgencyScoreBadge } from "./UrgencyScoreBadge";
import type { AggregatedTask } from "./types";

interface TaskItemProps {
  /** Task data */
  task: AggregatedTask;
  /** Mark task as complete */
  onComplete: () => Promise<void>;
  /** Pin task to My Focus section */
  onPin: () => Promise<void>;
  /** Remove task from My Focus section */
  onUnpin: () => Promise<void>;
  /** Snooze task until specified date */
  onSnooze: (until: Date) => Promise<void>;
  /** Change task priority */
  onSetPriority: (priority: "high" | "medium" | "low") => Promise<void>;
  /** Click handler for navigation */
  onClick: () => void;
}

/**
 * Map task source to tag variant for visual differentiation.
 */
const SOURCE_TAG_VARIANTS: Record<
  string,
  "ranking" | "audit" | "alert" | "report" | "connection"
> = {
  checklist: "connection",
  pipeline: "ranking",
  follow_up: "report",
  expiring: "alert",
  seo: "audit",
  manual: "report",
};

/**
 * Get tomorrow at 9am.
 */
function getTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Get next week at 9am.
 */
function getNextWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * TaskItem displays a single task with urgency indicators and action buttons.
 *
 * D-11 Layer 2: User override actions (pin, snooze, priority)
 * D-11 Layer 4: Visual urgency indicators via UrgencyScoreBadge
 *
 * @example
 * <TaskItem
 *   task={task}
 *   onComplete={handleComplete}
 *   onPin={handlePin}
 *   onUnpin={handleUnpin}
 *   onSnooze={handleSnooze}
 *   onSetPriority={handlePriority}
 *   onClick={handleClick}
 * />
 */
export function TaskItem({
  task,
  onComplete,
  onPin,
  onUnpin,
  onSnooze,
  onSetPriority,
  onClick,
}: TaskItemProps) {
  const [loading, setLoading] = useState(false);

  // Determine urgency state for visual indicators
  const isOverdue = task.dueAt ? isBefore(task.dueAt, new Date()) : false;
  const isDueToday = task.dueAt ? isToday(task.dueAt) : false;
  const isStale = (task.daysInStage ?? 0) > 7;

  /**
   * Wrap action handlers with loading state.
   */
  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  const tagVariant = SOURCE_TAG_VARIANTS[task.source] ?? "report";

  return (
    <div className="group relative">
      <TodayFeedItem
        timestamp={task.dueAt ?? new Date()}
        title={task.title}
        description={task.description ?? undefined}
        tag={{ label: task.source, variant: tagVariant }}
        onClick={onClick}
      />

      {/* Urgency badge - positioned top right */}
      <div className="absolute top-2 right-12">
        <UrgencyScoreBadge
          score={task.urgencyScore}
          isOverdue={isOverdue}
          isDueToday={isDueToday}
          isStale={isStale}
        />
      </div>

      {/* Pin indicator */}
      {task.pinnedAt && (
        <Pin className="absolute top-2 right-2 h-4 w-4 text-blue-500 fill-blue-500" />
      )}

      {/* Actions on hover */}
      <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        {/* Complete button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => handleAction(onComplete)}
          disabled={loading}
          title="Mark complete"
        >
          <Check className="h-4 w-4" />
        </Button>

        {/* Pin/Unpin button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => handleAction(task.pinnedAt ? onUnpin : onPin)}
          disabled={loading}
          title={task.pinnedAt ? "Unpin from My Focus" : "Pin to My Focus"}
        >
          <Pin
            className={cn(
              "h-4 w-4",
              task.pinnedAt && "fill-blue-500 text-blue-500"
            )}
          />
        </Button>

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={loading}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Snooze options */}
            <DropdownMenuItem
              onClick={() => handleAction(() => onSnooze(getTomorrow()))}
            >
              <Clock className="mr-2 h-4 w-4" />
              Snooze until tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction(() => onSnooze(getNextWeek()))}
            >
              <Clock className="mr-2 h-4 w-4" />
              Snooze for a week
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Priority options */}
            <DropdownMenuItem
              onClick={() => handleAction(() => onSetPriority("high"))}
            >
              <Bell className="mr-2 h-4 w-4 text-red-500" />
              Set High Priority
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction(() => onSetPriority("medium"))}
            >
              <Bell className="mr-2 h-4 w-4 text-yellow-500" />
              Set Medium Priority
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction(() => onSetPriority("low"))}
            >
              <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
              Set Low Priority
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
