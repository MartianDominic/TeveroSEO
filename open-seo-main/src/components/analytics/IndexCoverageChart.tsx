/**
 * IndexCoverageChart
 * Phase 96-04: Index coverage stats visualization
 * UI-04/05/06: Uses design system tokens, error boundary, loading states.
 */
import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { IndexCoverageStats, IndexingQuota } from "@/server/features/analytics/types";
import { ChartErrorBoundary } from "@/components/charts/ChartErrorBoundary";
import { Skeleton } from "@/client/components/ui/skeleton";

interface IndexCoverageChartProps {
  stats: IndexCoverageStats;
  quota?: IndexingQuota;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Color mapping for coverage states using design tokens
const STATE_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  "Submitted and indexed": { bg: "bg-success/10", text: "text-success", icon: CheckCircle2 },
  "Crawled - currently not indexed": { bg: "bg-warning/10", text: "text-warning", icon: AlertCircle },
  "Discovered - currently not indexed": { bg: "bg-warning/20", text: "text-warning", icon: Clock },
  "URL is unknown to Google": { bg: "bg-muted", text: "text-muted-foreground", icon: XCircle },
  "Blocked by robots.txt": { bg: "bg-destructive/10", text: "text-destructive", icon: XCircle },
  "Blocked by noindex": { bg: "bg-destructive/10", text: "text-destructive", icon: XCircle },
  "Not found (404)": { bg: "bg-destructive/10", text: "text-destructive", icon: XCircle },
  "Page with redirect": { bg: "bg-primary/10", text: "text-primary", icon: AlertCircle },
};

/**
 * Loading skeleton for IndexCoverageChart
 */
function IndexCoverageChartSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-muted p-4">
            <Skeleton className="h-5 w-20 mb-2" />
            <Skeleton className="h-9 w-24 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-muted p-4">
        <div className="flex justify-between mb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-4 w-full rounded-full" />
      </div>
      <div className="rounded-lg border border-border">
        <div className="border-b border-border p-4">
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IndexCoverageChart({
  stats,
  quota,
  onRefresh,
  isLoading,
}: IndexCoverageChartProps) {
  const indexedPercent = useMemo(() => {
    if (stats.total === 0) return 0;
    return (stats.indexed / stats.total) * 100;
  }, [stats]);

  const sortedStates = useMemo(() => {
    return Object.entries(stats.byState)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [stats.byState]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // Show skeleton while loading
  if (isLoading) {
    return <IndexCoverageChartSkeleton />;
  }

  return (
    <ChartErrorBoundary fallbackHeight={400}>
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Index Coverage
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-success/10 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm text-success">
              Indexed
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-success">
            {stats.indexed.toLocaleString()}
          </p>
          <p className="text-sm text-success/80">
            {indexedPercent.toFixed(1)}% of total
          </p>
        </div>

        <div className="rounded-lg bg-destructive/10 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">
              Not Indexed
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-destructive">
            {stats.notIndexed.toLocaleString()}
          </p>
          <p className="text-sm text-destructive/80">
            {((stats.notIndexed / stats.total) * 100).toFixed(1)}% of total
          </p>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Total Pages
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Last updated: {formatDate(stats.lastUpdated)}
          </p>
        </div>
      </div>

      {/* Coverage bar */}
      <div className="rounded-lg bg-muted p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Index Rate</span>
          <span className="font-medium text-foreground">
            {indexedPercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-muted-foreground/20">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${indexedPercent}%` }}
          />
        </div>
      </div>

      {/* Breakdown by state */}
      <div className="rounded-lg border border-border">
        <div className="border-b border-border p-4">
          <h4 className="font-medium text-foreground">
            Coverage by State
          </h4>
        </div>
        <div className="divide-y divide-border">
          {sortedStates.map(([state, count]) => {
            const config = STATE_COLORS[state] || {
              bg: "bg-muted",
              text: "text-muted-foreground",
              icon: AlertCircle,
            };
            const Icon = config.icon;
            const percent = ((count / stats.total) * 100).toFixed(1);

            return (
              <div
                key={state}
                className="flex items-center justify-between p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-md p-1.5 ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.text}`} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {state}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-foreground">
                    {count.toLocaleString()}
                  </span>
                  <span className="w-12 text-right text-sm text-muted-foreground">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quota usage */}
      {quota && (
        <div className="rounded-lg border border-border p-4">
          <h4 className="mb-3 font-medium text-foreground">
            API Quota Usage (Today)
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Inspections
                </span>
                <span className="text-foreground">
                  {quota.inspectionsUsed} / {quota.inspectionsLimit}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    quota.inspectionsUsed / quota.inspectionsLimit > 0.9
                      ? "bg-destructive"
                      : "bg-primary"
                  }`}
                  style={{
                    width: `${(quota.inspectionsUsed / quota.inspectionsLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Indexing Requests
                </span>
                <span className="text-foreground">
                  {quota.indexingRequestsUsed} / {quota.indexingRequestsLimit}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    quota.indexingRequestsUsed / quota.indexingRequestsLimit > 0.9
                      ? "bg-destructive"
                      : "bg-accent"
                  }`}
                  style={{
                    width: `${(quota.indexingRequestsUsed / quota.indexingRequestsLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Resets at: {formatDate(quota.resetsAt)}
          </p>
        </div>
      )}
    </div>
    </ChartErrorBoundary>
  );
}
