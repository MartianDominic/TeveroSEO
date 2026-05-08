/**
 * Client Portal Dashboard Component
 * Phase 96-05: Client Portal
 *
 * Main dashboard for client-facing analytics portal.
 * Respects visibility configuration to show/hide metrics.
 *
 * Design System v6: Newsreader headers, ghost-edge shadows, grid layout.
 */
import { MetricCard, type MetricDelta, Card, CardContent, CardHeader, CardTitle } from '@tevero/ui';
import { BrandedSplitCard } from './BrandedSplitCard';
import { CtrBenchmarkChart } from './CtrBenchmarkChart';
import { SparklineChart } from './SparklineChart';
import type { VisibilityConfig } from '../hooks/useClientVisibility';

/**
 * Convert percentage change to MetricDelta format
 * @param change - Percentage change (e.g., 15.2 for +15.2%)
 * @param invertChange - For metrics where lower is better (e.g., position)
 */
function toMetricDelta(change: number, invertChange = false): MetricDelta | undefined {
  if (change === 0) return undefined;
  const isPositive = invertChange ? change < 0 : change > 0;
  return {
    value: Math.abs(change),
    direction: isPositive ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

/**
 * Format value based on type
 */
function formatValue(value: number, format: 'number' | 'decimal' | 'percent' = 'number'): string {
  switch (format) {
    case 'decimal':
      return value.toFixed(1);
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    default:
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
      } else if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
      }
      return value.toLocaleString();
  }
}

interface ClientMetrics {
  clicks: number;
  clicksChange: number;
  impressions: number;
  impressionsChange: number;
  position: number;
  positionChange: number;
  ctr: number;
  ctrChange: number;
  trend: Array<{ date: string; clicks: number }>;
}

interface BrandedData {
  branded: { clicks: number; impressions: number };
  nonBranded: { clicks: number; impressions: number };
  brandedPercent: number;
  nonBrandedPercent: number;
}

interface CtrBenchmarkData {
  position: number;
  benchmarkCtr: number;
  actualCtr?: number;
  status?: 'above' | 'at' | 'below';
}

interface ClientPortalDashboardProps {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  workspaceId: string;
  visibilityConfig: VisibilityConfig;
  metrics?: ClientMetrics;
  brandedData?: BrandedData;
  ctrBenchmarkData?: CtrBenchmarkData[];
  onExport?: (type: 'csv' | 'sheets') => void;
  isLoading?: boolean;
}

export function ClientPortalDashboard({
  clientId,
  clientName,
  clientLogo,
  workspaceId,
  visibilityConfig,
  metrics,
  brandedData,
  ctrBenchmarkData,
  onExport,
  isLoading = false,
}: ClientPortalDashboardProps) {
  const {
    showClicks,
    showImpressions,
    showPosition,
    showCtr,
    canExport,
  } = visibilityConfig;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[14px] text-text-3">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with client branding */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {clientLogo && (
            <img
              src={clientLogo}
              alt={`${clientName} logo`}
              className="h-10 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="font-display text-[24px] font-medium text-text-1">
              {clientName}
            </h1>
            <p className="text-[13px] text-text-3">SEO Performance Dashboard</p>
          </div>
        </div>

        {/* Export buttons */}
        {canExport && onExport && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport('csv')}
              className="px-3 py-1.5 text-[13px] font-medium text-text-2 bg-surface-raised hover:bg-surface-active rounded-md transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => onExport('sheets')}
              className="px-3 py-1.5 text-[13px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md transition-colors"
            >
              Export to Sheets
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {showClicks && metrics && (
          <MetricCard
            label="Clicks"
            value={formatValue(metrics.clicks)}
            delta={toMetricDelta(metrics.clicksChange)}
          />
        )}
        {showImpressions && metrics && (
          <MetricCard
            label="Impressions"
            value={formatValue(metrics.impressions)}
            delta={toMetricDelta(metrics.impressionsChange)}
          />
        )}
        {showPosition && metrics && (
          <MetricCard
            label="Avg Position"
            value={formatValue(metrics.position, 'decimal')}
            delta={toMetricDelta(metrics.positionChange, true)}
          />
        )}
        {showCtr && metrics && (
          <MetricCard
            label="CTR"
            value={formatValue(metrics.ctr, 'percent')}
            delta={toMetricDelta(metrics.ctrChange)}
          />
        )}
      </div>

      {/* Traffic Trend */}
      {showClicks && metrics?.trend && metrics.trend.length > 0 && (
        <Card className="bg-surface shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-medium text-text-1">
              Traffic Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[120px]">
              <SparklineChart data={metrics.trend} height={120} showTooltip={true} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout for branded split and CTR benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branded vs Non-Branded */}
        {(showClicks || showImpressions) && brandedData && (
          <BrandedSplitCard
            branded={brandedData.branded}
            nonBranded={brandedData.nonBranded}
            brandedPercent={brandedData.brandedPercent}
            nonBrandedPercent={brandedData.nonBrandedPercent}
            showClicks={showClicks}
            showImpressions={showImpressions}
          />
        )}

        {/* CTR Benchmark Chart */}
        {showCtr && ctrBenchmarkData && ctrBenchmarkData.length > 0 && (
          <CtrBenchmarkChart
            data={ctrBenchmarkData}
            maxPosition={20}
            showActual={true}
          />
        )}
      </div>

      {/* Empty state */}
      {!metrics && !brandedData && !ctrBenchmarkData && (
        <Card className="bg-surface shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-[14px] text-text-3">
              No analytics data available yet. Data will appear once your site is connected and starts receiving traffic.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Loading skeleton for the dashboard
 */
export function ClientPortalDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-surface-raised rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[120px] bg-surface-raised rounded-lg" />
        ))}
      </div>
      <div className="h-[160px] bg-surface-raised rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[200px] bg-surface-raised rounded-lg" />
        <div className="h-[200px] bg-surface-raised rounded-lg" />
      </div>
    </div>
  );
}
