"use client";

import { ReactNode, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@tevero/ui";
import { SparklineChart, getTrend } from "./SparklineChart";
import type { SparklineDataPoint } from "./SparklineChart";
import type { HealthBreakdown } from "@/lib/dashboard/types";

interface BreakdownItem {
  label: string;
  value: number | string;
  color?: string;
}

interface ClientTableHoverPopoverProps {
  children: ReactNode;
  title?: string;
  sparklineData?: SparklineDataPoint[];
  breakdown?: BreakdownItem[];
  width?: number;
}

export function ClientTableHoverPopover({
  children,
  title,
  sparklineData,
  breakdown,
  width = 280,
}: ClientTableHoverPopoverProps) {
  const [open, setOpen] = useState(false);

  // If no data to show, just render children without popover
  if (!sparklineData?.length && !breakdown?.length) {
    return <>{children}</>;
  }

  const trend = sparklineData ? getTrend(sparklineData) : "neutral";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="cursor-help hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="p-4"
        style={{ width }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={() => setOpen(false)}
      >
        <div className="space-y-3">
          {title && (
            <h4 className="font-medium text-sm">{title}</h4>
          )}

          {sparklineData && sparklineData.length > 0 && (
            <div className="space-y-1">
              <SparklineChart
                data={sparklineData}
                width={width - 32}
                height={60}
                trend={trend}
                showTooltip
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          )}

          {breakdown && breakdown.length > 0 && (
            <div className="space-y-1.5">
              {breakdown.map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span
                    className="font-medium tabular-nums"
                    style={item.color ? { color: item.color } : undefined}
                  >
                    {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Pre-built popover configurations for common use cases
export interface HealthPopoverData {
  score: number;
  breakdown: HealthBreakdown;
  issues?: string[];
}

export function HealthHoverPopover({
  children,
  data
}: {
  children: ReactNode;
  data: HealthPopoverData;
}) {
  const breakdown: BreakdownItem[] = [
    { label: "Traffic", value: `${data.breakdown.traffic}/30` },
    { label: "Rankings", value: `${data.breakdown.rankings}/25` },
    { label: "Technical", value: `${data.breakdown.technical}/20` },
    { label: "Backlinks", value: `${data.breakdown.backlinks}/15` },
    { label: "Content", value: `${data.breakdown.content}/10` },
  ];

  return (
    <ClientTableHoverPopover
      title={`Health Score: ${data.score}`}
      breakdown={breakdown}
    >
      {children}
    </ClientTableHoverPopover>
  );
}

export interface TrafficPopoverData {
  current: number;
  previous: number;
  trendPct: number;
  dailyData: SparklineDataPoint[];
}

export function TrafficHoverPopover({
  children,
  data,
}: {
  children: ReactNode;
  data: TrafficPopoverData;
}) {
  const breakdown: BreakdownItem[] = [
    { label: "Current (30d)", value: data.current },
    { label: "Previous (30d)", value: data.previous },
    {
      label: "Change",
      value: `${data.trendPct >= 0 ? "+" : ""}${(data.trendPct * 100).toFixed(1)}%`,
      color: data.trendPct >= 0 ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"
    },
  ];

  return (
    <ClientTableHoverPopover
      title="Traffic Trend"
      sparklineData={data.dailyData}
      breakdown={breakdown}
    >
      {children}
    </ClientTableHoverPopover>
  );
}

export interface KeywordsPopoverData {
  total: number;
  top10: number;
  top3: number;
  position1: number;
  recentChanges?: { keyword: string; change: number }[];
}

export function KeywordsHoverPopover({
  children,
  data,
}: {
  children: ReactNode;
  data: KeywordsPopoverData;
}) {
  const breakdown: BreakdownItem[] = [
    { label: "Position #1", value: data.position1 },
    { label: "Top 3", value: data.top3 },
    { label: "Top 10", value: data.top10 },
    { label: "Total Tracked", value: data.total },
  ];

  return (
    <ClientTableHoverPopover
      title="Keyword Distribution"
      breakdown={breakdown}
    >
      {children}
    </ClientTableHoverPopover>
  );
}
