/**
 * Sparkline Chart Component
 * Phase 96-02: Master Dashboard
 *
 * Uses Recharts for trend visualization.
 * Design System v6: hover-to-reveal with smooth motion.
 */
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface SparklineData {
  date: string;
  clicks: number;
}

interface SparklineChartProps {
  data: SparklineData[];
  height?: number;
  color?: string;
  showTooltip?: boolean;
}

export function SparklineChart({
  data,
  height = 40,
  color = '#8884d8',
  showTooltip = true,
}: SparklineChartProps) {
  // Determine trend color based on first vs last value
  const trendColor =
    data.length >= 2
      ? data[data.length - 1].clicks >= data[0].clicks
        ? '#1B6E45' // success
        : '#9B2C2C' // error
      : color;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        {showTooltip && (
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-surface border border-hairline rounded-md px-2 py-1 shadow-pop">
                    <p className="text-[12px] text-text-3">{payload[0].payload.date}</p>
                    <p className="text-[13px] font-medium text-text-1 tabular-nums">
                      {payload[0].value?.toLocaleString()} clicks
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="clicks"
          stroke={trendColor}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
