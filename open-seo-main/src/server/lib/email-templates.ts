/**
 * Email templates for report delivery.
 *
 * Generates professional HTML emails for report delivery with:
 * - Locale-aware date formatting
 * - PDF attachment or download link variants
 * - Clean, mobile-responsive layout
 * - Tevero branding colors
 */

/**
 * Data required to generate a report delivery email.
 */
export interface ReportEmailData {
  /** Client/organization name */
  clientName: string;
  /** Report type identifier */
  reportType: string;
  /** Date range covered by the report */
  dateRange: { start: string; end: string };
  /** Download URL (present when PDF too large for attachment) */
  downloadUrl?: string;
  /** Locale for date formatting (e.g., "en-US", "lt-LT") */
  locale: string;
}

/**
 * Result of template generation.
 */
export interface ReportEmailTemplate {
  /** Email subject line */
  subject: string;
  /** HTML email body */
  html: string;
}

/**
 * Maps report type to human-readable title.
 */
function getReportTitle(reportType: string): string {
  switch (reportType) {
    case "monthly-seo":
      return "Monthly SEO Report";
    case "weekly-summary":
      return "Weekly Summary Report";
    default:
      return "SEO Report";
  }
}

/**
 * Formats a date string according to the specified locale.
 */
function formatDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    // Fallback to ISO date if locale fails
    return dateStr;
  }
}

/**
 * Generates a report delivery email template.
 *
 * The email includes either:
 * - A note that the PDF is attached (when file < 10MB)
 * - A download button with link (when file >= 10MB)
 *
 * @param data - Report email data
 * @returns Subject line and HTML body
 *
 * @example
 * const { subject, html } = reportDeliveryTemplate({
 *   clientName: "Acme Corp",
 *   reportType: "monthly-seo",
 *   dateRange: { start: "2026-03-01", end: "2026-03-31" },
 *   locale: "en-US",
 * });
 */
export function reportDeliveryTemplate(data: ReportEmailData): ReportEmailTemplate {
  const reportTitle = getReportTitle(data.reportType);
  const startDate = formatDate(data.dateRange.start, data.locale);
  const endDate = formatDate(data.dateRange.end, data.locale);

  // Build subject line
  const subject = `${reportTitle} - ${data.clientName} (${startDate} - ${endDate})`;

  // Build download section (differs based on attachment vs link)
  const downloadSection = data.downloadUrl
    ? `
      <p style="margin-top: 24px;">
        <a href="${escapeHtml(data.downloadUrl)}"
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
          Download Report (PDF)
        </a>
      </p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">
        The report file is too large to attach. Please use the download link above.
      </p>
    `
    : `
      <p style="color: #4b5563; font-size: 14px; margin-top: 16px;">
        The report PDF is attached to this email.
      </p>
    `;

  // Build full HTML email
  const html = `
<!DOCTYPE html>
<html lang="${escapeHtml(data.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">
        ${escapeHtml(reportTitle)}
      </h1>
      <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
        ${escapeHtml(data.clientName)}
      </p>
    </div>

    <!-- Body -->
    <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
      Your scheduled report for the period <strong>${escapeHtml(startDate)}</strong> to <strong>${escapeHtml(endDate)}</strong> is ready.
    </p>

    ${downloadSection}

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        This is an automated email from Tevero. Please do not reply to this message.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
        &copy; ${new Date().getFullYear()} Tevero. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char);
}
