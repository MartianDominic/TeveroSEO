"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import { TrendingUp, TrendingDown, Users, Search, Target, Loader2 } from "lucide-react";
import { PositionDistributionBar } from "./PositionDistributionBar";
import { usePortfolioAggregates } from "@/hooks/usePortfolioAggregates";
import type { PortfolioSummary } from "@/lib/dashboard/types";

interface PortfolioHealthSummaryProps {
  /** Legacy prop-based summary data (fallback) */
  summary?: PortfolioSummary;
  /** Workspace ID for fetching pre-computed aggregates */
  workspaceId?: string;
}

/**
 * Portfolio health summary displaying key KPIs.
 * When workspaceId is provided, fetches pre-computed aggregates for instant loading.
 * Falls back to summary prop when aggregates unavailable.
 */
export function PortfolioHealthSummary({ summary, workspaceId }: PortfolioHealthSummaryProps) {
  const { data: aggregates, isLoading } = usePortfolioAggregates(workspaceId);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number) => {
    const pct = (n * 100).toFixed(1);
    return n >= 0 ? `+${pct}%` : `${pct}%`;
  };

  // Prefer aggregates when available, fall back to summary
  const data = aggregates
    ? {
        totalClients: aggregates.totalClients,
        clientsOnTrack: aggregates.clientsOnTrack,
        clientsCritical: aggregates.clientsCritical,
        avgGoalAttainment: aggregates.avgGoalAttainment,
        avgGoalAttainmentTrend: aggregates.avgGoalAttainmentTrend ?? 0,
        goalsMet: aggregates.goalsMet,
        goalsTotal: aggregates.totalGoals,
        avgTrafficChange: aggregates.totalClicksTrend ?? 0,
        totalClicks30d: aggregates.totalClicks30d,
        keywordsTotal: aggregates.totalKeywordsTracked,
        keywordsTop10: aggregates.keywordsTop10,
        keywordsTop3: aggregates.keywordsTop3,
        keywordsPosition1: aggregates.keywordsPosition1,
      }
    : summary
      ? {
          totalClients: summary.totalClients,
          clientsOnTrack: summary.clientsOnTrack ?? 0,
          clientsCritical: summary.clientsCritical,
          avgGoalAttainment: summary.avgGoalAttainment ?? 0,
          avgGoalAttainmentTrend: summary.avgGoalAttainmentTrend,
          goalsMet: summary.goalsMet ?? 0,
          goalsTotal: summary.goalsTotal ?? 0,
          avgTrafficChange: summary.avgTrafficChange,
          totalClicks30d: summary.totalClicks30d,
          keywordsTotal: summary.keywordsTotal,
          keywordsTop10: summary.keywordsTop10,
          keywordsTop3: summary.keywordsTop3,
          keywordsPosition1: summary.keywordsPosition1,
        }
      : null;

  // Show loading skeleton when fetching aggregates
  if (isLoading && workspaceId) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Return empty state if no data
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="col-span-4">
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No portfolio data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalClients}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-emerald-600">{data.clientsOnTrack}</span> on track
            {data.clientsCritical > 0 && (
              <span className="text-red-600 ml-2">{data.clientsCritical} critical</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Goal Attainment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Goal Attainment</CardTitle>
          <Target className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.avgGoalAttainment.toFixed(0)}%
            {data.avgGoalAttainmentTrend > 0 && (
              <span className="text-sm text-emerald-600 ml-1">
                +{data.avgGoalAttainmentTrend.toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.goalsMet}/{data.goalsTotal} goals met
          </p>
        </CardContent>
      </Card>

      {/* Traffic Change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Traffic Change</CardTitle>
          {data.avgTrafficChange >= 0 ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${data.avgTrafficChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatPercent(data.avgTrafficChange)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(data.totalClicks30d)} clicks (30d)
          </p>
        </CardContent>
      </Card>

      {/* Keywords Distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Keyword Positions</CardTitle>
          <Search className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(data.keywordsTotal)}</div>
          <div className="mt-2">
            <PositionDistributionBar
              top10={data.keywordsTop10}
              top3={data.keywordsTop3}
              position1={data.keywordsPosition1}
              total={data.keywordsTotal}
              showLabels={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
