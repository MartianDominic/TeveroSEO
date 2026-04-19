"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { GA4DataPoint } from "@/lib/analytics/types";
import { REPORT_COLORS, CHART_CONFIG } from "@/lib/reports/styles";

interface ReportGA4ChartProps {
  /** Daily GA4 data points */
  data: GA4DataPoint[];
  /** Optional chart title */
  title?: string;
  /** Locale for date formatting (e.g., "en-US", "de-DE") */
  locale: string;
}

/**
 * GA4 traffic chart for PDF reports.
 *
 * Key differences from interactive GA4Chart:
 * - Uses RGB colors (not CSS variables) for Puppeteer PDF compatibility
 * - Uses explicit width/height (not ResponsiveContainer) for PDF stability
 * - Formats dates using provided locale
 */
export function ReportGA4Chart({ data, title, locale }: ReportGA4ChartProps) {
  const formatDate = (label: unknown) => {
    if (label == null) return "";
    const date = new Date(String(label));
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(num);
    }
    return new Intl.NumberFormat(locale).format(num);
  };

  return (
    <div className="report-chart">
      {title && (
        <h3
          className="text-sm font-medium mb-2"
          style={{ color: REPORT_COLORS.text }}
        >
          {title}
        </h3>
      )}
      <LineChart
        width={CHART_CONFIG.width}
        height={CHART_CONFIG.height}
        data={data}
        margin={CHART_CONFIG.margin}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={REPORT_COLORS.grid} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: REPORT_COLORS.textMuted }}
          tickFormatter={formatDate}
          stroke={REPORT_COLORS.border}
        />
        <YAxis
          tick={{ fontSize: 12, fill: REPORT_COLORS.textMuted }}
          tickFormatter={formatNumber}
          stroke={REPORT_COLORS.border}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: REPORT_COLORS.background,
            border: `1px solid ${REPORT_COLORS.border}`,
            borderRadius: "0.5rem",
            color: REPORT_COLORS.text,
          }}
          labelFormatter={formatDate}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="sessions"
          stroke={REPORT_COLORS.primary}
          strokeWidth={2}
          dot={false}
          name="Sessions"
        />
        <Line
          type="monotone"
          dataKey="users"
          stroke={REPORT_COLORS.accent}
          strokeWidth={2}
          dot={false}
          name="Users"
        />
      </LineChart>
    </div>
  );
}
