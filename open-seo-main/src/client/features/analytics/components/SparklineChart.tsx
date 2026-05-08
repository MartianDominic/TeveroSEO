/**
 * Sparkline Chart Component
 * Phase 96-02: Master Dashboard
 *
 * Uses Recharts for trend visualization.
 * Design System v6: hover-to-reveal with smooth motion.
 * WCAG 2.1 AA compliant: role="img", aria-label for screen readers
 * UI-04: Uses chart theme CSS variables for consistent colors.
 */
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS } from '@/components/charts/chart-theme';

interface SparklineData {
  date: string;
  clicks: number;
}

interface SparklineChartProps {
  data: SparklineData[];
  height?: number;
  color?: string;
  showTooltip?: boolean;
  /** Optional label for accessibility (defaults to auto-generated) */
  ariaLabel?: string;
}

export function SparklineChart({
  data,
  height = 40,
  color = '#8884d8',
  showTooltip = true,
  ariaLabel,
}: SparklineChartProps) {
  // Determine trend color based on first vs last value using design system colors
  const trendColor =
    data.length >= 2
      ? data[data.length - 1].clicks >= data[0].clicks
        ? CHART_COLORS.success
        : CHART_COLORS.destructive
      : color;

  // Calculate trend direction and percentage for accessibility
  const accessibilityInfo = useMemo(() => {
    if (data.length < 2) {
      return {
        trend: 'stable',
        changePercent: 0,
        startValue: data[0]?.clicks || 0,
        endValue: data[0]?.clicks || 0,
      };
    }
    const startValue = data[0].clicks;
    const endValue = data[data.length - 1].clicks;
    const changePercent = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
    const trend = endValue > startValue ? 'increasing' : endValue < startValue ? 'decreasing' : 'stable';
    return { trend, changePercent, startValue, endValue };
  }, [data]);

  // Generate accessible description
  const generatedAriaLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    const { trend, changePercent, endValue } = accessibilityInfo;
    const trendText = trend === 'increasing' ? 'upward' : trend === 'decreasing' ? 'downward' : 'stable';
    const changeText = Math.abs(changePercent) > 0.1
      ? `, ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% change`
      : '';
    return `Sparkline chart showing ${trendText} trend over ${data.length} data points. Current value: ${endValue.toLocaleString()} clicks${changeText}.`;
  }, [ariaLabel, accessibilityInfo, data.length]);

  return (
    <div
      role="img"
      aria-label={generatedAriaLabel}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
      tabIndex={0}
    >
      {/* Visually hidden summary for screen readers */}
      <span className="sr-only">
        {data.length > 0 && (
          <>
            Data range: {data[0].date} to {data[data.length - 1]?.date || data[0].date}.
            Values range from {Math.min(...data.map(d => d.clicks)).toLocaleString()} to {Math.max(...data.map(d => d.clicks)).toLocaleString()} clicks.
          </>
        )}
      </span>
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
    </div>
  );
}
