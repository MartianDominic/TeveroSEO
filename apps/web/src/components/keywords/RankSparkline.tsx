"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface RankingDataPoint {
  date: string;
  position: number;
}

interface RankSparklineProps {
  data: RankingDataPoint[];
  onClick?: () => void;
}

/**
 * Compact 30-day position sparkline for keyword list.
 * Green stroke if improved (latest < first), red if declined.
 */
export function RankSparkline({ data, onClick }: RankSparklineProps) {
  if (data.length === 0) {
    return (
      <div className="w-24 h-8 flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  // Invert position for visual (lower position = higher on chart)
  const chartData = data.map((d) => ({
    date: d.date,
    value: 100 - d.position, // Invert so position 1 is at top
  }));

  // Determine trend color
  const firstPosition = data[0]?.position ?? 0;
  const lastPosition = data[data.length - 1]?.position ?? 0;
  const improved = lastPosition < firstPosition;
  const declined = lastPosition > firstPosition;

  const strokeColor = improved
    ? "hsl(142.1 76.2% 36.3%)" // green-600
    : declined
      ? "hsl(0 84.2% 60.2%)" // red-500
      : "hsl(var(--muted-foreground))";

  return (
    <div
      className="w-24 h-8 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
      title={`Position: ${lastPosition} (${improved ? "improved" : declined ? "declined" : "stable"})`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
