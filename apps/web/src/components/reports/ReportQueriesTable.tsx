import { REPORT_COLORS } from "@/lib/reports/styles";
import type { TopQuery } from "@/lib/analytics/types";
import type { ReportLabels } from "@/lib/reports/types";

interface ReportQueriesTableProps {
  /** Top queries data */
  queries: TopQuery[];
  /** Maximum number of queries to display */
  limit?: number;
  /** Locale for number formatting */
  locale: string;
  /** Localized labels */
  labels: Pick<
    ReportLabels,
    "topQueries" | "query" | "clicks" | "impressions" | "ctr" | "position" | "wow"
  >;
}

/**
 * Top queries table for reports.
 *
 * Displays query performance metrics with position change indicators.
 * Position delta: negative = improved (green), positive = worsened (red).
 *
 * Server component - no "use client" directive.
 */
export function ReportQueriesTable({
  queries,
  limit = 20,
  locale,
  labels,
}: ReportQueriesTableProps) {
  const displayQueries = queries.slice(0, limit);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercent = (num: number) => {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPosition = (num: number) => {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(num);
  };

  const getDeltaColor = (delta: number) => {
    // Negative delta = improved position (moved up in rankings)
    if (delta < 0) return REPORT_COLORS.positive;
    // Positive delta = worsened position (moved down in rankings)
    if (delta > 0) return REPORT_COLORS.negative;
    return REPORT_COLORS.textMuted;
  };

  const formatDelta = (delta: number) => {
    if (delta === 0) return "-";
    // Negative delta = improved (show as positive change)
    // Positive delta = worsened (show as negative change)
    const sign = delta < 0 ? "+" : "";
    return `${sign}${Math.abs(delta).toFixed(1)}`;
  };

  return (
    <section className="report-queries-table mb-8">
      <h3
        className="text-lg font-semibold mb-4"
        style={{ color: REPORT_COLORS.text }}
      >
        {labels.topQueries}
      </h3>
      <div
        className="border rounded-lg overflow-hidden"
        style={{ borderColor: REPORT_COLORS.border }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "rgb(249, 250, 251)" }}>
              <th
                className="text-left px-4 py-3 font-medium"
                style={{ color: REPORT_COLORS.textMuted }}
              >
                {labels.query}
              </th>
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: REPORT_COLORS.textMuted }}
              >
                {labels.clicks}
              </th>
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: REPORT_COLORS.textMuted }}
              >
                {labels.impressions}
              </th>
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: REPORT_COLORS.textMuted }}
              >
                {labels.ctr}
              </th>
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: REPORT_COLORS.textMuted }}
              >
                {labels.position}
              </th>
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: REPORT_COLORS.textMuted }}
              >
                {labels.wow}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayQueries.map((query, index) => (
              <tr
                key={query.query}
                style={{
                  borderTop: `1px solid ${REPORT_COLORS.border}`,
                  backgroundColor:
                    index % 2 === 0
                      ? REPORT_COLORS.background
                      : "rgb(249, 250, 251)",
                }}
              >
                <td
                  className="px-4 py-3 max-w-[300px] truncate"
                  title={query.query}
                  style={{ color: REPORT_COLORS.text }}
                >
                  {query.query}
                </td>
                <td
                  className="text-right px-4 py-3"
                  style={{ color: REPORT_COLORS.text }}
                >
                  {formatNumber(query.clicks)}
                </td>
                <td
                  className="text-right px-4 py-3"
                  style={{ color: REPORT_COLORS.text }}
                >
                  {formatNumber(query.impressions)}
                </td>
                <td
                  className="text-right px-4 py-3"
                  style={{ color: REPORT_COLORS.text }}
                >
                  {formatPercent(query.ctr)}
                </td>
                <td
                  className="text-right px-4 py-3"
                  style={{ color: REPORT_COLORS.text }}
                >
                  {formatPosition(query.position)}
                </td>
                <td
                  className="text-right px-4 py-3 font-medium"
                  style={{ color: getDeltaColor(query.position_delta) }}
                >
                  {formatDelta(query.position_delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
