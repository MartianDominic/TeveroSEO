import { REPORT_COLORS } from "@/lib/reports/styles";
import type { ReportLabels, ReportBranding } from "@/lib/reports/types";

interface ReportFooterProps {
  /** ISO8601 timestamp when report was generated */
  generatedAt: string;
  /** Locale for date/time formatting */
  locale: string;
  /** Localized labels */
  labels: Pick<ReportLabels, "generatedBy" | "generatedAt">;
  /** Optional client branding for white-label reports */
  branding?: ReportBranding;
}

/**
 * Report footer with generation attribution and timestamp.
 *
 * Server component - no "use client" directive.
 * Supports optional branding for white-label reports (Phase 16).
 *
 * SECURITY NOTE: branding.footerText is pre-sanitized by the API layer
 * (Plan 16-03) using DOMPurify before storage. Only safe tags are allowed
 * (p, br, a, span). The render side trusts the stored content is safe.
 */
export function ReportFooter({
  generatedAt,
  locale,
  labels,
  branding,
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
      {branding?.footerText ? (
        // Custom footer text (pre-sanitized HTML from API - see Plan 16-03)
        // eslint-disable-next-line react/no-danger
        <div
          className="text-sm"
          style={{ color: REPORT_COLORS.textMuted }}
          dangerouslySetInnerHTML={{ __html: branding.footerText }}
        />
      ) : (
        // Default Tevero attribution
        <p
          className="text-sm"
          style={{ color: REPORT_COLORS.textMuted }}
        >
          {labels.generatedBy}
        </p>
      )}
      <p
        className="text-xs mt-1"
        style={{ color: REPORT_COLORS.muted }}
      >
        {labels.generatedAt}: {formatTimestamp(generatedAt)}
      </p>
    </footer>
  );
}
