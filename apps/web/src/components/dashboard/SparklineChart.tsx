"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export interface SparklineDataPoint {
  value: number;
  label?: string;
}

interface SparklineChartProps {
  data: SparklineDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showTooltip?: boolean;
  className?: string;
  trend?: "up" | "down" | "neutral";
}

export function SparklineChart({
  data,
  width = 100,
  height = 30,
  color,
  showTooltip = false,
  className,
  trend = "neutral",
}: SparklineChartProps) {
  // Determine color based on trend if not explicitly provided
  const strokeColor = color ?? (
    trend === "up" ? "hsl(142, 76%, 36%)" :    // emerald-600
    trend === "down" ? "hsl(0, 84%, 60%)" :    // red-500
    "hsl(var(--primary))"
  );

  if (data.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-muted-foreground text-xs", className)}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  return (
    <div className={className} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          {showTooltip && (
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const point = payload[0].payload as SparklineDataPoint;
                return (
                  <div className="bg-popover border rounded px-2 py-1 text-xs shadow-md">
                    {point.label && <div className="text-muted-foreground">{point.label}</div>}
                    <div className="font-medium">{point.value.toLocaleString()}</div>
                  </div>
                );
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Helper to determine trend from data
export function getTrend(data: SparklineDataPoint[]): "up" | "down" | "neutral" {
  if (data.length < 2) return "neutral";
  const first = data[0].value;
  const last = data[data.length - 1].value;
  if (last > first * 1.05) return "up";
  if (last < first * 0.95) return "down";
  return "neutral";
}
