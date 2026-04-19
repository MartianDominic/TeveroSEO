"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { GSCDataPoint } from "@/lib/analytics/types";

interface GSCChartProps {
  data: GSCDataPoint[];
}

export function GSCChart({ data }: GSCChartProps) {
  const formatDate = (label: unknown) => {
    if (label == null) return "";
    const date = new Date(String(label));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={formatDate}
          className="text-muted-foreground"
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tick={{ fontSize: 12 }}
          tickFormatter={formatNumber}
          className="text-muted-foreground"
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          tickFormatter={formatNumber}
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
          labelFormatter={formatDate}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="clicks"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          name="Clicks"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="impressions"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={false}
          name="Impressions"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
