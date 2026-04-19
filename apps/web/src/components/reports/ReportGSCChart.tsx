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
import type { GSCDataPoint } from "@/lib/analytics/types";
import { REPORT_COLORS, CHART_CONFIG } from "@/lib/reports/styles";

interface ReportGSCChartProps {
  /** Daily GSC data points */
  data: GSCDataPoint[];
  /** Optional chart title */
  title?: string;
  /** Locale for date formatting (e.g., "en-US", "de-DE") */
  locale: string;
}

/**
 * GSC performance chart for PDF reports.
 *
 * Key differences from interactive GSCChart:
 * - Uses RGB colors (not CSS variables) for Puppeteer PDF compatibility
 * - Uses explicit width/height (not ResponsiveContainer) for PDF stability
 * - Formats dates using provided locale
 */
export function ReportGSCChart({ data, title, locale }: ReportGSCChartProps) {
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
          yAxisId="left"
          orientation="left"
          tick={{ fontSize: 12, fill: REPORT_COLORS.textMuted }}
          tickFormatter={formatNumber}
          stroke={REPORT_COLORS.border}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
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
          yAxisId="left"
          type="monotone"
          dataKey="clicks"
          stroke={REPORT_COLORS.primary}
          strokeWidth={2}
          dot={false}
          name="Clicks"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="impressions"
          stroke={REPORT_COLORS.secondary}
          strokeWidth={2}
          dot={false}
          name="Impressions"
        />
      </LineChart>
    </div>
  );
}
