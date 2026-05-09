"use client";

/**
 * WinLossAnalytics Component
 * Phase 62-08: Win/Loss Analytics and Final Phase Completion
 *
 * Displays win/loss analytics with:
 * - Summary stats (win rate, avg cycle, won/lost counts)
 * - Loss reason chart
 * - Top competitors
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { LossReasonChart } from "./LossReasonChart";



/**
 * Win/Loss analytics data structure.
 */
interface WinLossAnalyticsData {
  summary: {
    totalDeals: number;
    won: number;
    lost: number;
    winRate: number;
    avgCycleDays: number;
  };
  lossReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  topCompetitors: Array<{
    name: string;
    count: number;
  }>;
}

interface WinLossAnalyticsProps {
  workspaceId: string;
}

/**
 * Loading skeleton for analytics section.
 */
function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function WinLossAnalytics({ workspaceId }: WinLossAnalyticsProps) {
  const t = useTranslations("commandCenter");

  const { data, isLoading } = useQuery<WinLossAnalyticsData>({
    queryKey: ["win-loss-analytics", workspaceId],
    queryFn: async () => {
      const res = await fetch("/api/command-center/analytics/win-loss", {
        headers: { "X-Workspace-Id": workspaceId },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch win/loss analytics");
      }
      return res.json();
    },
    // Refresh every 5 minutes
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  if (isLoading) return <AnalyticsSkeleton />;

  const { summary, lossReasons, topCompetitors } = data ?? {
    summary: { totalDeals: 0, won: 0, lost: 0, winRate: 0, avgCycleDays: 0 },
    lossReasons: [],
    topCompetitors: [],
  };

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      data-testid="win-loss-analytics"
    >
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.winLoss.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("analytics.winLoss.winRate")}
              </p>
              <p className="text-3xl font-bold text-green-600">
                {summary.winRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("analytics.winLoss.avgCycle")}
              </p>
              <p className="text-3xl font-bold">
                {summary.avgCycleDays} {t("common.days")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("analytics.winLoss.won")}
              </p>
              <p className="text-2xl font-bold text-green-600">{summary.won}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("analytics.winLoss.lost")}
              </p>
              <p className="text-2xl font-bold text-red-600">{summary.lost}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.lossReasons.title")}</CardTitle>
        </CardHeader>
        <CardContent data-testid="loss-reason-chart">
          <LossReasonChart data={lossReasons} />
        </CardContent>
      </Card>

      {topCompetitors.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("analytics.competitors.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topCompetitors.map((c) => (
                <div
                  key={c.name}
                  className="px-3 py-1 bg-muted rounded-full text-sm"
                >
                  {c.name} ({c.count})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
