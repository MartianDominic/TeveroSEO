"use client";

/**
 * Revenue trend chart component with period toggle.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-12: Trend chart with toggle for 3/6/12 months view.
 */

import { useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { formatCurrency } from "@/lib/currency";

import { Card, CardHeader, CardTitle, CardContent } from "@tevero/ui";
import { Button } from "@tevero/ui";

/**
 * Trend data point structure.
 */
export interface TrendDataPoint {
  month: string;
  mrr: number;
}

/**
 * Props for RevenueTrendChart component.
 */
export interface RevenueTrendChartProps {
  data3m: TrendDataPoint[];
  data6m: TrendDataPoint[];
  data12m: TrendDataPoint[];
  currency: string;
}

type Period = "3m" | "6m" | "12m";

/**
 * Displays MRR trend chart with period toggle per D-12.
 */
export function RevenueTrendChart({
  data3m,
  data6m,
  data12m,
  currency,
}: RevenueTrendChartProps) {
  // D-12: Toggle 3/6/12 months
  const [period, setPeriod] = useState<Period>("6m");

  const data = period === "3m" ? data3m : period === "6m" ? data6m : data12m;

  // Custom tooltip formatter
  const formatTooltipValue = (value: number) => {
    return formatCurrency(value, currency);
  };

  // Y-axis tick formatter
  const formatYAxisTick = (value: number) => {
    return formatCurrency(value, currency, { compact: true });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">MRR Trend</CardTitle>
        <div className="flex gap-1">
          {(["3m", "6m", "12m"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "ghost"}
              onClick={() => setPeriod(p)}
              className="h-7 px-2 text-xs-safe"
            >
              {p.toUpperCase()}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--hairline-1)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--hairline-1)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxisTick}
                width={60}
              />
              <Tooltip
                formatter={(value) => [formatTooltipValue(Number(value)), "MRR"]}
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--hairline-1)",
                  borderRadius: "var(--radius-card)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--text-1)" }}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--accent)",
                  stroke: "var(--surface)",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

RevenueTrendChart.displayName = "RevenueTrendChart";
