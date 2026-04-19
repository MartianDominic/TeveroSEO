"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Button } from "@tevero/ui";

interface RankingDataPoint {
  date: string;
  position: number;
  url?: string | null;
  serpFeatures?: string[] | null;
}

interface RankHistoryChartProps {
  data30: RankingDataPoint[];
  data90: RankingDataPoint[];
}

/**
 * Full position history chart with 30/90 day toggle.
 * Shows position over time with inverted Y-axis (position 1 at top).
 */
export function RankHistoryChart({ data30, data90 }: RankHistoryChartProps) {
  const [range, setRange] = useState<30 | 90>(30);
  const data = range === 30 ? data30 : data90;

  const formatDate = (label: unknown) => {
    if (label == null) return "";
    const date = new Date(String(label));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Custom tooltip showing position, URL, and SERP features
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ payload: RankingDataPoint }>;
    label?: string;
  }) => {
    if (!active || !payload?.[0]) return null;

    const point = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{formatDate(label)}</p>
        <p className="text-lg">
          Position: <span className="font-bold">{point.position}</span>
        </p>
        {point.url && (
          <p className="text-xs text-muted-foreground truncate max-w-48">
            {point.url}
          </p>
        )}
        {point.serpFeatures && point.serpFeatures.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {point.serpFeatures.map((feature) => (
              <span
                key={feature}
                className="text-xs bg-muted px-1.5 py-0.5 rounded"
              >
                {feature.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No ranking history available
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <Button
          variant={range === 30 ? "default" : "outline"}
          size="sm"
          onClick={() => setRange(30)}
        >
          30 Days
        </Button>
        <Button
          variant={range === 90 ? "default" : "outline"}
          size="sm"
          onClick={() => setRange(90)}
        >
          90 Days
        </Button>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={formatDate}
            className="text-muted-foreground"
          />
          <YAxis
            reversed // Position 1 at top
            domain={[1, "auto"]}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            label={{
              value: "Position",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Reference lines for top 10 and top 3 */}
          <ReferenceLine
            y={10}
            stroke="hsl(var(--muted))"
            strokeDasharray="5 5"
          />
          <ReferenceLine
            y={3}
            stroke="hsl(142.1 76.2% 36.3%)"
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="position"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <span>
          <span className="inline-block w-3 h-0.5 bg-green-500 mr-1 align-middle" />
          Top 3
        </span>
        <span>
          <span className="inline-block w-3 h-0.5 bg-muted mr-1 align-middle" />
          Top 10
        </span>
      </div>
    </div>
  );
}
