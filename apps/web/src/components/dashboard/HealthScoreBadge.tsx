import { cn } from "@/lib/utils";

interface HealthScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * @deprecated Use GoalAttainmentBadge instead.
 * Health scores are being replaced with goal-based tracking (Phase 22).
 * This component is maintained for backwards compatibility with clients
 * that don't have goals configured.
 */
export function HealthScoreBadge({ score, showLabel = true, size = "md" }: HealthScoreBadgeProps) {
  const getColor = (s: number) => {
    if (s >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
    if (s >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
    if (s >= 40) return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
  };

  const getLabel = (s: number) => {
    if (s >= 80) return "Healthy";
    if (s >= 60) return "Monitor";
    if (s >= 40) return "At Risk";
    return "Critical";
  };

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-md border font-medium",
      getColor(score),
      sizeClasses[size]
    )}>
      <span className="font-mono">{score}</span>
      {showLabel && <span>{getLabel(score)}</span>}
    </div>
  );
}
