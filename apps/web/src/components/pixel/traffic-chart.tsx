"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface TimeseriesDataPoint {
  date: string;
  pageviews: number;
  sessions: number;
  uniqueVisitors: number;
}

export interface TrafficChartProps {
  data: TimeseriesDataPoint[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SERIES_CONFIG = {
  pageviews: {
    name: "Pageviews",
    color: "hsl(var(--primary))",
    strokeWidth: 2,
  },
  sessions: {
    name: "Sessions",
    color: "hsl(var(--accent))",
    strokeWidth: 2,
  },
  uniqueVisitors: {
    name: "Unique Visitors",
    color: "hsl(var(--success))",
    strokeWidth: 2,
  },
} as const;

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="text-sm font-medium text-foreground mb-2">
        {label ? formatDate(label) : ""}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function TrafficChart({ data, loading = false, className }: TrafficChartProps) {
  // Track which series are visible
  const [visibleSeries, setVisibleSeries] = React.useState<Set<string>>(
    new Set(["pageviews", "sessions", "uniqueVisitors"])
  );

  // Toggle series visibility
  const toggleSeries = React.useCallback((dataKey: string) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        // Don't allow hiding all series
        if (next.size > 1) {
          next.delete(dataKey);
        }
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            No data available for this period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Traffic Overview</CardTitle>
        {/* Series toggles */}
        <div className="flex items-center gap-3">
          {Object.entries(SERIES_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-opacity",
                visibleSeries.has(key) ? "opacity-100" : "opacity-40"
              )}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span>{config.name}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              {Object.entries(SERIES_CONFIG).map(([key, config]) => (
                <linearGradient
                  key={key}
                  id={`gradient-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={config.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-border"
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              interval="preserveStartEnd"
              minTickGap={50}
            />

            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              width={45}
            />

            <Tooltip content={<CustomTooltip />} />

            {Object.entries(SERIES_CONFIG).map(([key, config]) =>
              visibleSeries.has(key) ? (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={config.name}
                  stroke={config.color}
                  strokeWidth={config.strokeWidth}
                  fill={`url(#gradient-${key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ) : null
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

TrafficChart.displayName = "TrafficChart";
