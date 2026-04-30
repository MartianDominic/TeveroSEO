"use client";

import { cn } from "@/lib/utils";

interface CategoryCount {
  category: string;
  completed: number;
  total: number;
}

export interface ChecklistProgressProps {
  completedCount: number;
  totalCount: number;
  categories: CategoryCount[];
  className?: string;
}

/**
 * ChecklistProgress - Overall + per-category progress visualization.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements D-04: Progress bar + percentage at top, per-category counts below.
 */
export function ChecklistProgress({
  completedCount,
  totalCount,
  categories,
  className,
}: ChecklistProgressProps) {
  const overallPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Overall progress bar + percentage at top per D-04 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Overall Progress
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {overallPercent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full transition-all duration-300",
              overallPercent === 100 ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* Per-category counts per D-04 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((cat) => (
          <div key={cat.category} className="text-center">
            <span className="text-xs text-muted-foreground capitalize">
              {cat.category}
            </span>
            <p className="text-sm font-medium text-foreground">
              {cat.completed}/{cat.total}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
