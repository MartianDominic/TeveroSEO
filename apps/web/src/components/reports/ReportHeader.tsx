import { REPORT_COLORS } from "@/lib/reports/styles";
import type { ReportLabels, ReportBranding } from "@/lib/reports/types";

/**
 * Convert hex color (#RRGGBB) to RGB format for Puppeteer PDF compatibility.
 * See: RESEARCH.md pitfall #2 - Puppeteer SVG hex color bug
 */
function hexToRgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, "");
  if (cleanHex.length !== 6) return hex;

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgb(${r}, ${g}, ${b})`;
}

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
  /** Optional client branding for white-label reports */
  branding?: ReportBranding;
}

/**
 * Report header section with client name and date range.
 *
 * Server component - no "use client" directive.
 * Uses Intl.DateTimeFormat for locale-aware date display.
 * Supports optional branding for white-label reports (Phase 16).
 */
export function ReportHeader({
  clientName,
  dateRange,
  locale,
  labels,
  branding,
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

  // Use branding colors if provided, else defaults
  // Convert hex to RGB for Puppeteer PDF compatibility
  const primaryColor = branding?.primaryColor
    ? hexToRgb(branding.primaryColor)
    : REPORT_COLORS.primary;

  return (
    <header className="report-header mb-8 pb-6 border-b" style={{ borderColor: REPORT_COLORS.border }}>
      {/* Logo row - only shown if branding.logoUrl is set */}
      {branding?.logoUrl && (
        <div className="mb-4">
          <img
            src={branding.logoUrl}
            alt={`${clientName} logo`}
            style={{ maxHeight: "48px", maxWidth: "200px", objectFit: "contain" }}
          />
        </div>
      )}
      <h1
        className="text-3xl font-bold mb-1"
        style={{ color: primaryColor }}
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
