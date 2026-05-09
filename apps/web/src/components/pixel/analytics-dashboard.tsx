"use client";

import * as React from "react";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  MetricCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Skeleton,
} from "@tevero/ui";

import { CwvCard, type CwvRating } from "./cwv-card";
import { TopPages, type TopPage } from "./top-pages";
import { TrafficChart, type TimeseriesDataPoint } from "./traffic-chart";

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsSummary {
  totalPageviews: number;
  totalSessions: number;
  totalUniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

export interface CwvMetricResult {
  p75: number;
  rating: CwvRating;
}

export interface CwvResult {
  lcp: CwvMetricResult;
  cls: CwvMetricResult;
  inp: CwvMetricResult;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  cwv: CwvResult;
  timeseries: TimeseriesDataPoint[];
  topPages: TopPage[];
}

export type DateRangePreset = "7d" | "30d" | "90d" | "custom";

export interface AnalyticsDashboardProps {
  siteId: string;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DATE_RANGE_OPTIONS: Array<{ value: DateRangePreset; label: string; days: number }> = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

// ============================================================================
// Helpers
// ============================================================================

function getDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ============================================================================
// API Fetch Functions
// ============================================================================

async function fetchAnalytics(
  siteId: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsResponse> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  const response = await fetch(`/api/pixel/${siteId}/analytics?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch analytics");
  }

  return response.json();
}

// ============================================================================
// Summary Cards Component
// ============================================================================

interface SummaryCardsProps {
  summary: AnalyticsSummary;
  loading?: boolean;
}

function SummaryCards({ summary, loading }: SummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Pageviews"
        value={formatNumber(summary.totalPageviews)}
        data-testid="pageviews-card"
      />
      <MetricCard
        label="Sessions"
        value={formatNumber(summary.totalSessions)}
        data-testid="sessions-card"
      />
      <MetricCard
        label="Unique Visitors"
        value={formatNumber(summary.totalUniqueVisitors)}
        data-testid="visitors-card"
      />
      <MetricCard
        label="Bounce Rate"
        value={formatPercent(summary.bounceRate)}
        unit="%"
        data-testid="bounce-rate-card"
      />
    </div>
  );
}

// ============================================================================
// CWV Section Component
// ============================================================================

interface CwvSectionProps {
  cwv: CwvResult;
  loading?: boolean;
}

function CwvSection({ cwv, loading }: CwvSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Core Web Vitals (p75)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CwvCard
          metric="lcp"
          value={cwv.lcp.p75}
          rating={cwv.lcp.rating}
          loading={loading}
        />
        <CwvCard
          metric="cls"
          value={cwv.cls.p75}
          rating={cwv.cls.rating}
          loading={loading}
        />
        <CwvCard
          metric="inp"
          value={cwv.inp.p75}
          rating={cwv.inp.rating}
          loading={loading}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnalyticsDashboard({ siteId, className }: AnalyticsDashboardProps) {
  // Date range state
  const [datePreset, setDatePreset] = React.useState<DateRangePreset>("30d");
  const [dateRange, setDateRange] = React.useState(() => getDateRange(30));

  // Update date range when preset changes
  React.useEffect(() => {
    const option = DATE_RANGE_OPTIONS.find((o) => o.value === datePreset);
    if (option) {
      setDateRange(getDateRange(option.days));
    }
  }, [datePreset]);

  // Fetch analytics data
  const {
    data: analytics,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["pixel-analytics", siteId, dateRange.startDate, dateRange.endDate],
    queryFn: () => fetchAnalytics(siteId, dateRange.startDate, dateRange.endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Handle error state
  if (error) {
    return (
      <Card className={cn("p-8", className)}>
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load analytics</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with date range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Traffic and performance metrics from your pixel
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <Select
            value={datePreset}
            onValueChange={(value) => setDatePreset(value as DateRangePreset)}
          >
            <SelectTrigger className="w-[160px]" data-testid="date-range-picker">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefetching && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryCards
        summary={
          analytics?.summary || {
            totalPageviews: 0,
            totalSessions: 0,
            totalUniqueVisitors: 0,
            avgTimeOnPage: 0,
            bounceRate: 0,
          }
        }
        loading={isLoading}
      />

      {/* Core Web Vitals */}
      <CwvSection
        cwv={
          analytics?.cwv || {
            lcp: { p75: 0, rating: "good" as CwvRating },
            cls: { p75: 0, rating: "good" as CwvRating },
            inp: { p75: 0, rating: "good" as CwvRating },
          }
        }
        loading={isLoading}
      />

      {/* Traffic chart */}
      <TrafficChart data={analytics?.timeseries || []} loading={isLoading} />

      {/* Top pages */}
      <TopPages pages={analytics?.topPages || []} loading={isLoading} />
    </div>
  );
}

AnalyticsDashboard.displayName = "AnalyticsDashboard";

// ============================================================================
// Exports
// ============================================================================

export { CwvCard } from "./cwv-card";
export { TrafficChart } from "./traffic-chart";
export { TopPages } from "./top-pages";
export type { CwvCardProps, CwvMetricType } from "./cwv-card";
export type { TrafficChartProps } from "./traffic-chart";
export type { TopPagesProps } from "./top-pages";
