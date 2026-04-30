"use client";

/**
 * ReportDataPreview component for showing live data preview.
 *
 * Fetches and displays aggregated analytics data for selected
 * report sections before generation.
 */

import { useEffect, useState, useMemo, type FC } from "react";
import { Card, CardContent, Skeleton, cn } from "@tevero/ui";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  MousePointerClick,
  Eye,
  Users,
  Activity,
  Search,
} from "lucide-react";
import type { ReportSection, ReportSectionType } from "@tevero/types";
import type { ReportData } from "@/lib/reports/types";
import { aggregateReportData } from "@/lib/reports/builder";

interface ReportDataPreviewProps {
  /** Client UUID */
  clientId: string;
  /** Date range for data aggregation */
  dateRange: { start: string; end: string };
  /** Selected report sections */
  sections: ReportSection[];
}

interface MetricPreviewProps {
  label: string;
  value: string | number;
  icon: FC<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}

/**
 * Individual metric preview card.
 */
const MetricPreview: FC<MetricPreviewProps> = ({
  label,
  value,
  icon: Icon,
  trend,
}) => (
  <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
    <div className="p-2 bg-[var(--accent-soft)] rounded-lg">
      <Icon className="h-4 w-4 text-[var(--accent)]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-[var(--text-3)] truncate">{label}</p>
      <p className="text-sm font-semibold text-[var(--text-1)] tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
    {trend && trend !== "neutral" && (
      <div
        className={cn(
          "flex items-center",
          trend === "up" ? "text-[var(--success)]" : "text-[var(--error)]"
        )}
      >
        {trend === "up" ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        )}
      </div>
    )}
  </div>
);

/**
 * Loading skeleton for preview.
 */
const PreviewSkeleton: FC = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-24 rounded-lg" />
  </div>
);

/**
 * Error state for preview.
 */
const PreviewError: FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-3 p-4 bg-[var(--error-soft)] rounded-lg">
    <AlertCircle className="h-5 w-5 text-[var(--error)] flex-shrink-0" />
    <p className="text-sm text-[var(--error)]">{message}</p>
  </div>
);

/**
 * Empty state when no data sections are selected.
 */
const PreviewEmpty: FC = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Search className="h-8 w-8 text-[var(--text-4)] mb-3" />
    <p className="text-sm text-[var(--text-3)]">
      Select data sections to see preview
    </p>
  </div>
);

/**
 * Preview of top queries.
 */
const QueriesPreview: FC<{
  queries: { query: string; clicks: number; position: number }[];
}> = ({ queries }) => {
  if (queries.length === 0) {
    return (
      <p className="text-sm text-[var(--text-3)] text-center py-4">
        No query data available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider">
        Top Queries Preview
      </p>
      <div className="space-y-1">
        {queries.slice(0, 3).map((q, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 px-3 bg-[var(--surface-2)] rounded"
          >
            <span className="text-sm text-[var(--text-2)] truncate max-w-[60%]">
              {q.query}
            </span>
            <div className="flex items-center gap-3 text-xs text-[var(--text-3)]">
              <span className="tabular-nums">{q.clicks} clicks</span>
              <span className="tabular-nums">#{Math.round(q.position)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Live data preview component for the report builder.
 *
 * Shows a debounced preview of aggregated metrics based on:
 * - Selected date range
 * - Enabled report sections
 *
 * Data is fetched only for sections that require it.
 */
export const ReportDataPreview: FC<ReportDataPreviewProps> = ({
  clientId,
  dateRange,
  sections,
}) => {
  const [data, setData] = useState<Partial<ReportData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine which sections need data
  const sectionTypes = useMemo(
    () => new Set(sections.map((s) => s.type)),
    [sections]
  );

  const needsData = useMemo(
    () =>
      sectionTypes.has("summary_stats") ||
      sectionTypes.has("gsc_chart") ||
      sectionTypes.has("ga4_chart") ||
      sectionTypes.has("queries_table"),
    [sectionTypes]
  );

  // Fetch data when inputs change (debounced)
  useEffect(() => {
    if (!needsData) {
      setData(null);
      setLoading(false);
      return;
    }

    // Debounce fetches to avoid rapid API calls
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await aggregateReportData(clientId, dateRange, sections);
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load preview data"
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [clientId, dateRange, sections, needsData]);

  // Show loading state
  if (loading) {
    return <PreviewSkeleton />;
  }

  // Show error state
  if (error) {
    return <PreviewError message={error} />;
  }

  // Show empty state if no data sections selected
  if (!needsData) {
    return <PreviewEmpty />;
  }

  // Show preview data
  const showGSC =
    sectionTypes.has("summary_stats") || sectionTypes.has("gsc_chart");
  const showGA4 =
    sectionTypes.has("summary_stats") || sectionTypes.has("ga4_chart");
  const showQueries = sectionTypes.has("queries_table");

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        {showGSC && (
          <>
            <MetricPreview
              label="Clicks"
              value={data?.gscSummary?.clicks ?? 0}
              icon={MousePointerClick}
            />
            <MetricPreview
              label="Impressions"
              value={data?.gscSummary?.impressions ?? 0}
              icon={Eye}
            />
          </>
        )}
        {showGA4 && (
          <>
            <MetricPreview
              label="Sessions"
              value={data?.ga4Summary?.sessions ?? 0}
              icon={Activity}
            />
            <MetricPreview
              label="Users"
              value={data?.ga4Summary?.users ?? 0}
              icon={Users}
            />
          </>
        )}
      </div>

      {/* CTR and Position for GSC */}
      {showGSC && (
        <div className="grid grid-cols-2 gap-3">
          <MetricPreview
            label="Avg CTR"
            value={`${((data?.gscSummary?.ctr ?? 0) * 100).toFixed(1)}%`}
            icon={TrendingUp}
          />
          <MetricPreview
            label="Avg Position"
            value={(data?.gscSummary?.position ?? 0).toFixed(1)}
            icon={Search}
          />
        </div>
      )}

      {/* Queries preview */}
      {showQueries && data?.topQueries && (
        <QueriesPreview queries={data.topQueries} />
      )}

      {/* Date range info */}
      <p className="text-xs text-[var(--text-3)] text-center">
        Data from {dateRange.start} to {dateRange.end}
      </p>
    </div>
  );
};
