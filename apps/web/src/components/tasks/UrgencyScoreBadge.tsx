"use client";

/**
 * UrgencyScoreBadge Component
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements D-11 Layer 4: Visual urgency indicators
 * - Red for overdue tasks
 * - Yellow for tasks due today
 * - Blue for stale pipeline cards
 */
import { cn } from "@/lib/utils";

interface UrgencyScoreBadgeProps {
  /** Calculated urgency score */
  score: number;
  /** Task is past due date */
  isOverdue: boolean;
  /** Task is due today */
  isDueToday: boolean;
  /** Pipeline card has been stale for 7+ days */
  isStale: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get the visual variant based on urgency state.
 * Priority: overdue > dueToday > stale > default
 */
function getVariant(
  isOverdue: boolean,
  isDueToday: boolean,
  isStale: boolean
): "overdue" | "due-today" | "stale" | "default" {
  if (isOverdue) return "overdue";
  if (isDueToday) return "due-today";
  if (isStale) return "stale";
  return "default";
}

/**
 * UrgencyScoreBadge displays a task's urgency score with visual indicators.
 *
 * D-11 Layer 4 visual indicators:
 * - Red (overdue): Task is past its due date
 * - Yellow (due today): Task is due today
 * - Blue (stale): Pipeline card hasn't been updated in 7+ days
 *
 * @example
 * <UrgencyScoreBadge score={85} isOverdue={true} isDueToday={false} isStale={false} />
 */
export function UrgencyScoreBadge({
  score,
  isOverdue,
  isDueToday,
  isStale,
  className,
}: UrgencyScoreBadgeProps) {
  const variant = getVariant(isOverdue, isDueToday, isStale);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs-safe font-medium tabular-nums",
        variant === "overdue" && "bg-red-500/10 text-red-600 dark:text-red-400",
        variant === "due-today" &&
          "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        variant === "stale" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        variant === "default" && "bg-muted text-muted-foreground",
        className
      )}
    >
      {/* Score */}
      <span>{score}</span>

      {/* Indicator dot for urgent states */}
      {variant !== "default" && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "overdue" && "bg-red-500",
            variant === "due-today" && "bg-yellow-500",
            variant === "stale" && "bg-blue-500"
          )}
        />
      )}
    </span>
  );
}
