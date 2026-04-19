import { Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import { TrendingUp, TrendingDown, Users, Trophy, Search } from "lucide-react";
import { PositionDistributionBar } from "./PositionDistributionBar";
import type { PortfolioSummary } from "@/lib/dashboard/types";

interface PortfolioHealthSummaryProps {
  summary: PortfolioSummary;
}

export function PortfolioHealthSummary({ summary }: PortfolioHealthSummaryProps) {
  const formatNumber = (n: number) => n.toLocaleString();
  const formatPercent = (n: number) => {
    const pct = (n * 100).toFixed(1);
    return n >= 0 ? `+${pct}%` : `${pct}%`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalClients}</div>
          <p className="text-xs text-muted-foreground">
            {summary.clientsNeedingAttention} need attention
          </p>
        </CardContent>
      </Card>

      {/* Wins This Week */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Wins This Week</CardTitle>
          <Trophy className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{summary.winsThisWeek}</div>
          <p className="text-xs text-muted-foreground">
            Milestones achieved
          </p>
        </CardContent>
      </Card>

      {/* Traffic Change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Traffic Change</CardTitle>
          {summary.avgTrafficChange >= 0 ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.avgTrafficChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatPercent(summary.avgTrafficChange)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(summary.totalClicks30d)} clicks (30d)
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
          <div className="text-2xl font-bold">{formatNumber(summary.keywordsTotal)}</div>
          <div className="mt-2">
            <PositionDistributionBar
              top10={summary.keywordsTop10}
              top3={summary.keywordsTop3}
              position1={summary.keywordsPosition1}
              total={summary.keywordsTotal}
              showLabels={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
