import { REPORT_COLORS } from "@/lib/reports/styles";
import type { ReportLabels } from "@/lib/reports/types";

interface ReportFooterProps {
  /** ISO8601 timestamp when report was generated */
  generatedAt: string;
  /** Locale for date/time formatting */
  locale: string;
  /** Localized labels */
  labels: Pick<ReportLabels, "generatedBy" | "generatedAt">;
}

/**
 * Report footer with generation attribution and timestamp.
 *
 * Server component - no "use client" directive.
 */
export function ReportFooter({
  generatedAt,
  locale,
  labels,
}: ReportFooterProps) {
  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <footer
      className="report-footer pt-6 mt-8 border-t text-center"
      style={{ borderColor: REPORT_COLORS.border }}
    >
      <p
        className="text-sm"
        style={{ color: REPORT_COLORS.textMuted }}
      >
        {labels.generatedBy}
      </p>
      <p
        className="text-xs mt-1"
        style={{ color: REPORT_COLORS.muted }}
      >
        {labels.generatedAt}: {formatTimestamp(generatedAt)}
      </p>
    </footer>
  );
}
