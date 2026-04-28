/**
 * TrafficChart component
 * Phase 30: Interactive Proposal Page
 *
 * Recharts-based line chart for showing traffic trends.
 * Animated on scroll into view.
 */

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useInView } from "framer-motion";

interface ChartDataPoint {
  month: string;
  traffic: number;
}

interface TrafficChartProps {
  /** Chart data points */
  data: ChartDataPoint[];
  /** Primary color for the chart */
  primaryColor?: string;
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS class */
  className?: string;
  /** Whether to show gradient fill */
  showGradient?: boolean;
  /** Format for Y-axis values */
  yAxisFormatter?: (value: number) => string;
}

/**
 * Custom tooltip component for the chart.
 */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {payload[0].value.toLocaleString("lt-LT")} lankytojų
      </p>
    </div>
  );
}

/**
 * Default Y-axis formatter - abbreviates large numbers.
 */
function defaultYAxisFormatter(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

/**
 * Renders an animated area chart showing traffic trends.
 */
export function TrafficChart({
  data,
  primaryColor = "#2563eb",
  height = 200,
  className = "",
  showGradient = true,
  yAxisFormatter = defaultYAxisFormatter,
}: TrafficChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [animatedData, setAnimatedData] = useState<ChartDataPoint[]>([]);

  // Animate data points when in view
  useEffect(() => {
    if (!isInView) {
      setAnimatedData(data.map((d) => ({ ...d, traffic: 0 })));
      return;
    }

    // Animate the data over time
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedData(
        data.map((d) => ({
          ...d,
          traffic: Math.round(d.traffic * eased),
        })),
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, data]);

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-[${height}px] text-muted-foreground ${className}`}
      >
        Nėra duomenų
      </div>
    );
  }

  const gradientId = `traffic-gradient-${primaryColor.replace("#", "")}`;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={animatedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            {showGradient && (
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.1}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#888" }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: "#888" }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="traffic"
            stroke={primaryColor}
            strokeWidth={2}
            fill={showGradient ? `url(#${gradientId})` : primaryColor}
            fillOpacity={showGradient ? 1 : 0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
