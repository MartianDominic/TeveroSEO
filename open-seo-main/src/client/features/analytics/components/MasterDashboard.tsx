/**
 * Master Dashboard Component
 * Phase 96-02: Master Dashboard
 *
 * Main dashboard showing all sites with KPIs, filters, and site table.
 * Design System v6: one editorial moment (total clicks KPI).
 */
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { MetricCard, type MetricDelta } from '@tevero/ui';
import { SiteTable } from './SiteTable';
import { DateRangePicker } from './DateRangePicker';
import { TagFilter } from './TagFilter';
import { useDashboardData, useTags } from '../hooks/useDashboardData';
import type { ComparisonPeriod, DashboardFilters } from '@/server/features/analytics/types';

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

export function MasterDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    dateRange: {
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'), // Yesterday (GSC latency)
    },
    comparison: 'WoW' as ComparisonPeriod,
    tags: [],
  }));

  const { data, isLoading, error } = useDashboardData({ filters });
  const { data: tags } = useTags();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-error">{error.message}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { totals, comparison, sites, meta } = data;

  return (
    <div className="space-y-8 p-7">
      {/* Header with filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display text-[clamp(30px,2.4vw,40px)] font-normal tracking-[-0.024em] text-text-1">
          Analytics
        </h1>

        <div className="flex items-center gap-3">
          <DateRangePicker
            dateRange={filters.dateRange}
            comparison={filters.comparison}
            onDateRangeChange={(dateRange) => setFilters((f) => ({ ...f, dateRange }))}
            onComparisonChange={(comparison) => setFilters((f) => ({ ...f, comparison }))}
          />

          <TagFilter
            tags={tags ?? []}
            selected={filters.tags ?? []}
            onChange={(tags) => setFilters((f) => ({ ...f, tags }))}
          />
        </div>
      </div>

      {/* KPI Grid - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Clicks"
          value={formatValue(totals.clicks)}
          delta={toMetricDelta(comparison.clicksChange)}
        />
        <MetricCard
          label="Total Impressions"
          value={formatValue(totals.impressions)}
          delta={toMetricDelta(comparison.impressionsChange)}
        />
        <MetricCard
          label="Avg Position"
          value={formatValue(totals.avgPosition, 'decimal')}
          delta={toMetricDelta(comparison.positionChange, true)}
        />
        <MetricCard
          label="Avg CTR"
          value={formatValue(totals.avgCtr, 'percent')}
          delta={toMetricDelta(comparison.ctrChange)}
        />
      </div>

      {/* Site count */}
      <div className="text-[13px] text-text-3">
        Showing {meta.siteCount} sites
        {filters.tags?.length ? ` filtered by ${filters.tags.length} tag(s)` : ''}
      </div>

      {/* Site table with sparklines */}
      <SiteTable sites={sites} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-7">
      <div className="h-10 w-48 bg-surface-2 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-surface-2 rounded-[12px] animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-surface-2 rounded-[12px] animate-pulse" />
    </div>
  );
}
