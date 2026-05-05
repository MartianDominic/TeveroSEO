"use client";

/**
 * ActivityFeed Component
 *
 * Displays work/activity entries grouped by date.
 * V6 design: Category icons, artifact chips, date grouping.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Wrench,
  TrendingUp,
  BarChart3,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import type { ActivityEntry, ActivityCategory } from "@/lib/portal/types";

export interface ActivityFeedProps {
  /** Activity entries to display */
  activities: ActivityEntry[];
  /** Optional category filter */
  categoryFilter?: ActivityCategory | null;
  /** Category filter change handler */
  onCategoryFilterChange?: (category: ActivityCategory | null) => void;
  /** Whether to show load more button */
  hasMore?: boolean;
  /** Load more handler */
  onLoadMore?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Compact mode (for dashboard preview) */
  compact?: boolean;
  /** Maximum items to show (for preview) */
  maxItems?: number;
  /** Additional CSS classes */
  className?: string;
}

const categoryConfig: Record<
  string,
  { icon: React.ElementType; label: string; colorClass: string }
> = {
  content: {
    icon: FileText,
    label: "Content",
    colorClass: "bg-info-soft text-info",
  },
  technical: {
    icon: Wrench,
    label: "Technical",
    colorClass: "bg-warning-soft text-warning",
  },
  ranking: {
    icon: TrendingUp,
    label: "Ranking",
    colorClass: "bg-success-soft text-success",
  },
  report: {
    icon: BarChart3,
    label: "Report",
    colorClass: "bg-accent-soft text-accent",
  },
  other: {
    icon: MoreHorizontal,
    label: "Other",
    colorClass: "bg-surface-2 text-text-3",
  },
};

const categories: (ActivityCategory | null)[] = [
  null,
  "content",
  "technical",
  "ranking",
  "report",
];

/**
 * Group activities by date bucket
 */
function groupByDate(
  activities: ActivityEntry[]
): { label: string; items: ActivityEntry[] }[] {
  const groups: Record<string, ActivityEntry[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };

  activities.forEach((activity) => {
    const date = new Date(activity.createdAt);
    if (isToday(date)) {
      groups.Today.push(activity);
    } else if (isYesterday(date)) {
      groups.Yesterday.push(activity);
    } else if (isThisWeek(date)) {
      groups["This Week"].push(activity);
    } else {
      groups.Older.push(activity);
    }
  });

  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function ActivityFeed({
  activities,
  categoryFilter,
  onCategoryFilterChange,
  hasMore,
  onLoadMore,
  isLoading,
  compact = false,
  maxItems,
  className,
}: ActivityFeedProps) {
  const displayActivities = maxItems
    ? activities.slice(0, maxItems)
    : activities;
  const groupedActivities = groupByDate(displayActivities);

  return (
    <div
      className={cn(
        "bg-surface rounded-[--radius-card]",
        "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]",
        className
      )}
    >
      {/* Header with category filters */}
      {!compact && onCategoryFilterChange && (
        <div className="flex items-center justify-between gap-4 p-5 border-b border-hairline-2">
          <h3 className="font-sans font-medium text-[15px] text-text-1">
            Recent Activity
          </h3>

          <div className="flex items-center gap-1.5">
            {categories.map((cat) => {
              const isActive = categoryFilter === cat;
              return (
                <button
                  key={cat || "all"}
                  onClick={() => onCategoryFilterChange(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-[--radius-button] text-[13px] font-medium",
                    "transition-colors duration-150",
                    isActive
                      ? "bg-accent-soft text-accent-ink"
                      : "bg-transparent text-text-2 hover:bg-surface-2"
                  )}
                >
                  {cat ? categoryConfig[cat].label : "All"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-between gap-4 p-5 border-b border-hairline-2">
          <h3 className="font-sans font-medium text-[15px] text-text-1">
            Recent Activity
          </h3>
        </div>
      )}

      {/* Activity list grouped by date */}
      <div className={cn("divide-y divide-hairline-3", compact && "max-h-[320px] overflow-y-auto")}>
        {isLoading && activities.length === 0 ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-surface-3 rounded-lg skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-surface-3 rounded skeleton" />
                  <div className="h-3 w-1/2 bg-surface-3 rounded skeleton" />
                </div>
              </div>
            </div>
          ))
        ) : groupedActivities.length === 0 ? (
          <div className="p-8 text-center text-text-3 text-[14px]">
            No activity yet
          </div>
        ) : (
          groupedActivities.map((group) => (
            <div key={group.label}>
              {/* Date group header */}
              <div className="px-5 py-2 bg-surface-2/50">
                <span className="text-[12px] font-medium text-text-3 uppercase tracking-[0.08em]">
                  {group.label}
                </span>
              </div>

              {/* Group items */}
              {group.items.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} compact={compact} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Load more button */}
      {hasMore && onLoadMore && !compact && (
        <div className="p-4 border-t border-hairline-2">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className={cn(
              "w-full py-2 text-[14px] font-medium text-accent",
              "hover:bg-accent-soft rounded-[--radius-button]",
              "transition-colors duration-150",
              "disabled:opacity-50"
            )}
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual activity item
 */
function ActivityItem({
  activity,
  compact,
}: {
  activity: ActivityEntry;
  compact: boolean;
}) {
  const config = categoryConfig[activity.category] || categoryConfig.other;
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="px-5 py-3 hover:bg-surface-2/50 transition-colors duration-150">
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div
          className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            config.colorClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] text-text-1 font-medium">
              {activity.title}
            </p>
            <span className="text-[12px] text-text-3 whitespace-nowrap font-mono">
              {timeAgo}
            </span>
          </div>

          {activity.description && !compact && (
            <p className="mt-1 text-[13px] text-text-2 line-clamp-2">
              {activity.description}
            </p>
          )}

          {/* Artifact chips */}
          {activity.artifacts.length > 0 && !compact && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activity.artifacts.map((artifact, idx) => (
                <a
                  key={idx}
                  href={artifact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1",
                    "text-[12px] text-accent font-medium",
                    "bg-accent-soft/50 rounded-[--radius-button]",
                    "hover:bg-accent-soft transition-colors duration-150"
                  )}
                >
                  {artifact.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
