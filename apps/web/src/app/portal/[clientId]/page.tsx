"use client";

/**
 * Portal Dashboard Page
 *
 * Answers "Is my SEO working?" in 5 seconds with verified GSC metrics.
 * Per PRD: Hero metric (clicks), row of 3 metrics, wins, needs attention, activity preview.
 */

import * as React from "react";

import { useParams, useSearchParams } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import {
  MousePointerClick,
  Eye,
  ArrowUpRight,
  Target,
  RefreshCw,
} from "lucide-react";

import { ActivityFeed } from "@/components/portal/ActivityFeed";
import { NeedsAttentionList } from "@/components/portal/NeedsAttention";
import { StatCard } from "@/components/portal/StatCard";
import { WinCardList } from "@/components/portal/WinCard";
import { useDashboard } from "@/lib/portal/hooks";
import { useActivity } from "@/lib/portal/hooks";
import { cn } from "@/lib/utils";


export default function PortalDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;

  // Token from query param or cookie
  const token = searchParams.get("token") || "";

  // Fetch dashboard data
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboard(clientId, token);

  // Fetch recent activity for preview
  const { data: activityData, isLoading: activityLoading } = useActivity(
    clientId,
    token,
    { limit: 5 }
  );

  // Format large numbers
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Format position (1 decimal)
  const formatPosition = (n: number) => n.toFixed(1);

  // Loading state
  if (dashboardLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (dashboardError || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[14px] text-error mb-4">
          Failed to load dashboard data
        </p>
        <button
          onClick={() => refetchDashboard()}
          className={cn(
            "flex items-center gap-2 px-4 py-2",
            "bg-accent text-white rounded-[--radius-button]",
            "hover:bg-accent-2 transition-colors duration-150"
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const lastUpdated = dashboard.lastUpdated
    ? formatDistanceToNow(new Date(dashboard.lastUpdated), { addSuffix: true })
    : "Unknown";

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[clamp(24px,2vw,32px)] font-medium text-text-1 tracking-[-0.02em]">
            Dashboard
          </h1>
          <p className="text-[13px] text-text-3 mt-1">
            Last updated <span className="font-mono">{lastUpdated}</span>
          </p>
        </div>
        <button
          onClick={() => refetchDashboard()}
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            "text-[13px] text-text-2 bg-surface rounded-[--radius-button]",
            "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03)]",
            "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_2px_4px_rgba(20,20,26,0.04)]",
            "transition-all duration-150"
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Hero metric - Organic Clicks */}
      <StatCard
        icon={<MousePointerClick className="h-5 w-5" />}
        label="Organic Clicks"
        value={dashboard.metrics.clicks}
        delta={dashboard.metrics.deltas.clicks}
        deltaLabel="vs last month"
        source="verified"
        formatValue={formatNumber}
        hero
        className="max-w-md"
      />

      {/* Row of 3 metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="Top 10 Keywords"
          value={dashboard.metrics.top10Count}
          delta={dashboard.metrics.deltas.top10Count}
          deltaLabel="vs last month"
          source="verified"
        />

        <StatCard
          icon={<ArrowUpRight className="h-5 w-5" />}
          label="Avg Position"
          value={dashboard.metrics.avgPosition}
          delta={-dashboard.metrics.deltas.avgPosition} // Invert for position (lower is better)
          deltaLabel="vs last month"
          source="verified"
          formatValue={formatPosition}
        />

        <StatCard
          icon={<Eye className="h-5 w-5" />}
          label="Impressions"
          value={dashboard.metrics.impressions}
          delta={dashboard.metrics.deltas.impressions}
          deltaLabel="vs last month"
          source="verified"
          formatValue={formatNumber}
        />
      </div>

      {/* Wins and Needs Attention side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Wins */}
        <WinCardList wins={dashboard.recentWins} maxItems={5} />

        {/* Needs Attention */}
        <NeedsAttentionList items={dashboard.needsAttention} maxItems={5} />
      </div>

      {/* Recent Activity Preview */}
      <ActivityFeed
        activities={activityData?.activities || []}
        isLoading={activityLoading}
        compact
        maxItems={5}
      />
    </div>
  );
}

/**
 * Loading skeleton for dashboard
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 bg-surface-3 rounded skeleton" />
          <div className="h-4 w-32 bg-surface-3 rounded skeleton mt-2" />
        </div>
        <div className="h-9 w-24 bg-surface-3 rounded skeleton" />
      </div>

      {/* Hero metric skeleton */}
      <div className="h-40 max-w-md bg-surface rounded-[--radius-card] skeleton" />

      {/* Row of 3 metrics skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-surface rounded-[--radius-card] skeleton"
          />
        ))}
      </div>

      {/* Two columns skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-surface rounded-[--radius-card] skeleton" />
        <div className="h-64 bg-surface rounded-[--radius-card] skeleton" />
      </div>

      {/* Activity skeleton */}
      <div className="h-80 bg-surface rounded-[--radius-card] skeleton" />
    </div>
  );
}
