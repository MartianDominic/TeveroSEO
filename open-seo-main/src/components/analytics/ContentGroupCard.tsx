/**
 * ContentGroupCard
 * Phase 96-04: Content Group display with metrics
 * UI-04/05/06: Uses design system tokens, loading states.
 */
import { Folder, Hash, Settings, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import type { ContentGroupWithMetrics } from "@/server/features/analytics/types";
import { Skeleton } from "@/client/components/ui/skeleton";

interface ContentGroupCardProps {
  group: ContentGroupWithMetrics;
  onEdit?: (group: ContentGroupWithMetrics) => void;
  onDelete?: (group: ContentGroupWithMetrics) => void;
  onClick?: (group: ContentGroupWithMetrics) => void;
  isLoading?: boolean;
}

/**
 * Loading skeleton for ContentGroupCard
 */
export function ContentGroupCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm animate-pulse">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md bg-muted p-2">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContentGroupCard({
  group,
  onEdit,
  onDelete,
  onClick,
}: ContentGroupCardProps) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const getMatchTypeIcon = () => {
    switch (group.matchType) {
      case "folder":
        return <Folder className="h-4 w-4" />;
      case "regex":
        return <Hash className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-success" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return null;
  };

  return (
    <div
      className="group relative rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onClick?.(group)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary"
            style={{ backgroundColor: group.color || undefined }}
          >
            <span className="text-primary-foreground">{getMatchTypeIcon()}</span>
          </div>
          <div>
            <h3 className="font-medium text-foreground">
              {group.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {group.matchPattern || "Manual selection"}
            </p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(group);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(group);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted p-2">
          <p className="text-sm text-muted-foreground">Clicks</p>
          <div className="flex items-center gap-1">
            <p className="text-lg font-semibold text-foreground">
              {formatNumber(group.metrics.totalClicks)}
            </p>
            {getTrendIcon(group.metrics.clicksChange)}
            {group.metrics.clicksChange !== 0 && (
              <span
                className={`text-sm ${
                  group.metrics.clicksChange > 0
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {group.metrics.clicksChange > 0 ? "+" : ""}
                {group.metrics.clicksChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <div className="rounded-md bg-muted p-2">
          <p className="text-sm text-muted-foreground">Impressions</p>
          <div className="flex items-center gap-1">
            <p className="text-lg font-semibold text-foreground">
              {formatNumber(group.metrics.totalImpressions)}
            </p>
            {getTrendIcon(group.metrics.impressionsChange)}
          </div>
        </div>

        <div className="rounded-md bg-muted p-2">
          <p className="text-sm text-muted-foreground">Avg Position</p>
          <p className="text-lg font-semibold text-foreground">
            {group.metrics.avgPosition.toFixed(1)}
          </p>
        </div>

        <div className="rounded-md bg-muted p-2">
          <p className="text-sm text-muted-foreground">Pages</p>
          <p className="text-lg font-semibold text-foreground">
            {group.pageCount}
          </p>
        </div>
      </div>

      {/* Auto-generated badge */}
      {group.isAutoGenerated && (
        <div className="mt-2 flex justify-end">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">
            Auto-generated
          </span>
        </div>
      )}
    </div>
  );
}
