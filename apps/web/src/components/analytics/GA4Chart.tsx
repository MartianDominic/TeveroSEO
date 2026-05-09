"use client";

/**
 * PERF FIX (MEDIUM-05): Dynamic import for Recharts to reduce initial bundle size.
 * Recharts is ~54KB and only needed when charts are rendered.
 */
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { GA4DataPoint } from "@/lib/analytics/types";

// Dynamically import Recharts components to reduce initial bundle
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <Skeleton className="w-full h-[280px]" /> }
);

interface GA4ChartProps {
  data: GA4DataPoint[];
}

export function GA4Chart({ data }: GA4ChartProps) {
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
        <Line
          type="monotone"
          dataKey="sessions"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          name="Sessions"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
