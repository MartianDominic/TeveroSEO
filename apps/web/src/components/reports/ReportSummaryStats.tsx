import { REPORT_COLORS } from "@/lib/reports/styles";
import type { GSCSummary, GA4Summary } from "@/lib/analytics/types";
import type { ReportLabels } from "@/lib/reports/types";

interface SummaryStatProps {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Optional trend data */
  trend?: {
    value: number;
    label: string;
  };
}

/**
 * Single stat card for summary section.
 * Uses inline styles for PDF compatibility.
 */
function SummaryStat({ label, value, trend }: SummaryStatProps) {
  const getTrendColor = (val: number) => {
    if (val > 0) return REPORT_COLORS.positive;
    if (val < 0) return REPORT_COLORS.negative;
    return REPORT_COLORS.textMuted;
  };

  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        borderColor: REPORT_COLORS.border,
        backgroundColor: REPORT_COLORS.background,
      }}
    >
      <p
        className="text-xs uppercase tracking-wide"
        style={{ color: REPORT_COLORS.textMuted }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-semibold mt-1"
        style={{ color: REPORT_COLORS.text }}
      >
        {value}
      </p>
      {trend && (
        <p
          className="text-xs mt-1"
          style={{ color: getTrendColor(trend.value) }}
        >
          {trend.value > 0 ? "+" : ""}
          {trend.value.toFixed(1)}% {trend.label}
        </p>
      )}
    </div>
  );
}

interface ReportSummaryStatsProps {
  /** GSC summary metrics */
  gscSummary: GSCSummary;
  /** GA4 summary metrics */
  ga4Summary: GA4Summary;
  /** Locale for number formatting */
  locale: string;
  /** Localized labels */
  labels: Pick<
    ReportLabels,
    | "clicks"
    | "impressions"
    | "ctr"
    | "position"
    | "sessions"
    | "users"
    | "conversions"
    | "bounceRate"
    | "wow"
  >;
  /** Optional trend data for comparison */
  trends?: {
    clicks?: number;
    impressions?: number;
    sessions?: number;
    conversions?: number;
  };
}

/**
 * Summary statistics section with 4-column grid.
 *
 * Displays key metrics from GSC and GA4 data.
 * Server component - no "use client" directive.
 */
export function ReportSummaryStats({
  gscSummary,
  ga4Summary,
  locale,
  labels,
  trends,
}: ReportSummaryStatsProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(locale, {
      notation: num >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(num);
  };

  const formatPercent = (num: number) => {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <section className="report-summary-stats mb-8">
      <div className="grid grid-cols-4 gap-4">
        <SummaryStat
          label={labels.clicks}
          value={formatNumber(gscSummary.clicks)}
          trend={
            trends?.clicks !== undefined
              ? { value: trends.clicks, label: labels.wow }
              : undefined
          }
        />
        <SummaryStat
          label={labels.impressions}
          value={formatNumber(gscSummary.impressions)}
          trend={
            trends?.impressions !== undefined
              ? { value: trends.impressions, label: labels.wow }
              : undefined
          }
        />
        <SummaryStat
          label={labels.sessions}
          value={formatNumber(ga4Summary.sessions)}
          trend={
            trends?.sessions !== undefined
              ? { value: trends.sessions, label: labels.wow }
              : undefined
          }
        />
        <SummaryStat
          label={labels.conversions}
          value={formatNumber(ga4Summary.conversions)}
          trend={
            trends?.conversions !== undefined
              ? { value: trends.conversions, label: labels.wow }
              : undefined
          }
        />
      </div>
    </section>
  );
}
