import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus, Target } from "lucide-react";

interface GoalAttainmentBadgeProps {
  attainmentPct: number | null;
  goalsMet: number;
  goalsTotal: number;
  trend?: string | null;
  showDetails?: boolean;
  size?: "sm" | "md";
}

function getTrendIcon(trend: string | null) {
  if (trend === "up") return <ArrowUp className="h-3 w-3" />;
  if (trend === "down") return <ArrowDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function getColorClass(pct: number): string {
  if (pct >= 100)
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  if (pct >= 80)
    return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
  if (pct >= 60)
    return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
  return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
}

export function GoalAttainmentBadge({
  attainmentPct,
  goalsMet,
  goalsTotal,
  trend,
  showDetails = true,
  size = "md",
}: GoalAttainmentBadgeProps) {
  const pct = attainmentPct ?? 0;

  if (goalsTotal === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded border bg-muted text-muted-foreground",
          size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs",
        )}
      >
        <Target className="h-3 w-3" />
        No goals
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded border",
        getColorClass(pct),
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs",
      )}
      title={
        showDetails
          ? `${goalsMet} of ${goalsTotal} goals met\nAverage attainment: ${pct.toFixed(1)}%`
          : undefined
      }
    >
      <Target className="h-3 w-3" />
      <span>{pct.toFixed(0)}%</span>
      {trend && (
        <span
          className={cn(
            trend === "up"
              ? "text-green-600"
              : trend === "down"
                ? "text-red-600"
                : "text-muted-foreground",
          )}
        >
          {getTrendIcon(trend)}
        </span>
      )}
      {showDetails && goalsTotal > 0 && (
        <span className="text-[10px] opacity-70">
          ({goalsMet}/{goalsTotal})
        </span>
      )}
    </span>
  );
}
