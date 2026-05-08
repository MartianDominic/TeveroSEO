/**
 * Portfolio Metrics Component
 * Phase 96-05: Client Portal
 *
 * Dashboard widget showing cross-client aggregates for workspace.
 * Design System v6: Newsreader for numerals, ghost-edge shadows.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { SparklineChart } from './SparklineChart';

interface ClientPerformance {
  clientId: string;
  clientName: string;
  domain: string;
  clicks: number;
  impressions: number;
  position: number;
  changePercent: number;
}

interface PortfolioSummary {
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  avgCtr: number;
  clientCount: number;
  totalQueries: number;
  totalPages: number;
}

interface PortfolioTrend {
  date: string;
  clicks: number;
}

interface PortfolioMetricsProps {
  summary: PortfolioSummary;
  topClients?: ClientPerformance[];
  underperformingClients?: ClientPerformance[];
  trend?: PortfolioTrend[];
  isLoading?: boolean;
}

export function PortfolioMetrics({
  summary,
  topClients = [],
  underperformingClients = [],
  trend = [],
  isLoading = false,
}: PortfolioMetricsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="h-[200px] bg-surface-raised rounded-lg" />
        <div className="h-[200px] bg-surface-raised rounded-lg" />
        <div className="h-[200px] bg-surface-raised rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Clicks"
          value={formatCompact(summary.totalClicks)}
          subtitle={`${summary.clientCount} clients`}
        />
        <SummaryCard
          title="Total Impressions"
          value={formatCompact(summary.totalImpressions)}
          subtitle={`${formatCompact(summary.totalQueries)} queries`}
        />
        <SummaryCard
          title="Avg Position"
          value={summary.avgPosition.toFixed(1)}
          subtitle="Across portfolio"
        />
        <SummaryCard
          title="Avg CTR"
          value={`${(summary.avgCtr * 100).toFixed(1)}%`}
          subtitle={`${formatCompact(summary.totalPages)} pages`}
        />
      </div>

      {/* Portfolio Trend */}
      {trend.length > 0 && (
        <Card className="bg-surface shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-medium text-text-1">
              Portfolio Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[120px]">
              <SparklineChart data={trend} height={120} showTooltip={true} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing */}
        <Card className="bg-surface shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-medium text-text-1">
              Top Performing Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {topClients.length === 0 ? (
              <p className="text-[13px] text-text-3 py-4">No data available</p>
            ) : (
              <div className="space-y-1">
                {topClients.slice(0, 5).map((client, i) => (
                  <ClientRow
                    key={client.clientId}
                    rank={i + 1}
                    name={client.clientName}
                    domain={client.domain}
                    clicks={client.clicks}
                    changePercent={client.changePercent}
                    isPositive={true}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Needs Attention */}
        <Card className="bg-surface shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-medium text-text-1">
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {underperformingClients.length === 0 ? (
              <p className="text-[13px] text-text-3 py-4">All clients performing well</p>
            ) : (
              <div className="space-y-1">
                {underperformingClients.slice(0, 5).map((client, i) => (
                  <ClientRow
                    key={client.clientId}
                    rank={i + 1}
                    name={client.clientName}
                    domain={client.domain}
                    clicks={client.clicks}
                    changePercent={client.changePercent}
                    isPositive={false}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="bg-surface shadow-card">
      <CardContent className="pt-6 pb-4 px-6">
        <div className="font-display text-[clamp(28px,2.5vw,36px)] font-normal tracking-[-0.026em] tabular-nums lining-nums text-text-1">
          {value}
        </div>
        <div className="text-[13px] text-text-3 mt-1">{title}</div>
        <div className="text-[12px] text-text-3 mt-0.5">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function ClientRow({
  rank,
  name,
  domain,
  clicks,
  changePercent,
  isPositive,
}: {
  rank: number;
  name: string;
  domain: string;
  clicks: number;
  changePercent: number;
  isPositive: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-hairline last:border-0">
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 flex items-center justify-center text-[12px] font-medium text-text-3 bg-surface-raised rounded">
          {rank}
        </span>
        <div>
          <div className="text-[13px] font-medium text-text-1">{name}</div>
          <div className="text-sm text-text-3">{domain}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-medium tabular-nums text-text-1">
          {formatCompact(clicks)}
        </div>
        <div
          className={`text-sm font-medium tabular-nums ${
            isPositive ? 'text-success' : 'text-error'
          }`}
        >
          {changePercent > 0 ? '+' : ''}
          {changePercent.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
