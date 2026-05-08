"use client";

/**
 * LossReasonChart Component
 * Phase 62-08: Win/Loss Analytics and Final Phase Completion
 *
 * Pie chart visualization of loss reason distribution.
 * Uses Recharts with donut-style inner radius.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  type PieLabelRenderProps,
} from "recharts";
import { useTranslations } from "next-intl";

/**
 * Color palette for chart segments.
 * Uses Design System v6 semantic colors for visual consistency.
 */
const COLORS = [
  "var(--error)",      // error red
  "var(--warning)",    // warning amber
  "var(--info)",       // info blue
  "var(--success)",    // success green
  "var(--accent)",     // accent emerald
  "var(--accent-2)",   // accent-2 lighter emerald
  "var(--accent-tint)", // accent-tint muted
  "var(--text-3)",     // text-3 gray
];

interface LossReasonData {
  reason: string;
  count: number;
  percentage: number;
}

interface LossReasonChartProps {
  data: LossReasonData[];
}

/**
 * Custom label renderer for pie chart segments.
 * Shows percentage for segments >= 5%.
 */
function renderCustomizedLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, outerRadius, payload } = props;

  // Extract percentage from payload
  const percentage = (payload as { percentage?: number })?.percentage ?? 0;

  // Only show label for segments with >= 5% to avoid clutter
  if (percentage < 5) return null;

  const RADIAN = Math.PI / 180;
  const radius = (outerRadius as number) + 25;
  const x = (cx as number) + radius * Math.cos(-(midAngle as number) * RADIAN);
  const y = (cy as number) + radius * Math.sin(-(midAngle as number) * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="hsl(var(--foreground))"
      textAnchor={x > (cx as number) ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
    >
      {`${percentage}%`}
    </text>
  );
}

export function LossReasonChart({ data }: LossReasonChartProps) {
  const t = useTranslations("commandCenter");

  // Map data with translated reason names
  const chartData = data.map((d) => ({
    name: t(`lossReasons.${d.reason}` as Parameters<typeof t>[0]),
    value: d.count,
    percentage: d.percentage,
    originalReason: d.reason,
  }));

  // Empty state
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground">
        {t("analytics.lossReasons.empty")}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          dataKey="value"
          label={renderCustomizedLabel}
          labelLine={false}
          animationDuration={500}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [value, ""]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
