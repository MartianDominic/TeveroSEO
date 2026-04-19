import { REPORT_COLORS } from "@/lib/reports/styles";
import type { ReportLabels } from "@/lib/reports/types";

interface ReportHeaderProps {
  /** Client/company name */
  clientName: string;
  /** Report date range */
  dateRange: {
    start: string;
    end: string;
  };
  /** Locale for date formatting */
  locale: string;
  /** Localized labels */
  labels: Pick<ReportLabels, "title" | "subtitle" | "dateRange">;
}

/**
 * Report header section with client name and date range.
 *
 * Server component - no "use client" directive.
 * Uses Intl.DateTimeFormat for locale-aware date display.
 */
export function ReportHeader({
  clientName,
  dateRange,
  locale,
  labels,
}: ReportHeaderProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const formattedStart = formatDate(dateRange.start);
  const formattedEnd = formatDate(dateRange.end);

  return (
    <header className="report-header mb-8 pb-6 border-b" style={{ borderColor: REPORT_COLORS.border }}>
      <h1
        className="text-3xl font-bold mb-1"
        style={{ color: REPORT_COLORS.text }}
      >
        {clientName}
      </h1>
      <h2
        className="text-xl font-medium mb-4"
        style={{ color: REPORT_COLORS.textMuted }}
      >
        {labels.title}
      </h2>
      <p
        className="text-sm"
        style={{ color: REPORT_COLORS.textMuted }}
      >
        {labels.dateRange}: {formattedStart} - {formattedEnd}
      </p>
    </header>
  );
}
