/**
 * Report HTML renderer for PDF generation.
 *
 * Generates static HTML from report data for Puppeteer PDF rendering.
 * Uses RGB colors (not hex/CSS variables) for Puppeteer compatibility.
 *
 * Note: This is a server-side HTML generator, not using React components
 * because those use "use client" directives and Recharts which don't
 * work well with server-side renderToString.
 */

/** PDF-safe RGB color palette matching apps/web styles */
const COLORS = {
  primary: "rgb(59, 130, 246)",
  secondary: "rgb(16, 185, 129)",
  accent: "rgb(245, 158, 11)",
  text: "rgb(17, 24, 39)",
  textMuted: "rgb(107, 114, 128)",
  border: "rgb(229, 231, 235)",
  background: "rgb(255, 255, 255)",
  positive: "rgb(16, 185, 129)",
  negative: "rgb(239, 68, 68)",
};

/** Report data types for rendering */
export interface ReportRenderData {
  metadata: {
    id: string;
    clientId: string;
    clientName: string;
    reportType: string;
    dateRange: { start: string; end: string };
    locale: string;
    generatedAt: string;
    contentHash: string;
  };
  gscDaily: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  gscSummary: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  ga4Daily: Array<{
    date: string;
    sessions: number;
    users: number;
    bounce_rate: number;
  }>;
  ga4Summary: {
    sessions: number;
    users: number;
    conversions: number;
    bounce_rate: number;
  };
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    position_delta: number;
  }>;
}

export interface ReportLabels {
  title: string;
  subtitle: string;
  dateRange: string;
  clicks: string;
  impressions: string;
  ctr: string;
  position: string;
  sessions: string;
  users: string;
  conversions: string;
  bounceRate: string;
  topQueries: string;
  query: string;
  wow: string;
  generatedBy: string;
  generatedAt: string;
}

/**
 * Client branding for white-label reports (Phase 16).
 */
export interface ReportBranding {
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string | null;
}

/**
 * Convert hex color (#RRGGBB) to RGB format for Puppeteer PDF compatibility.
 */
function hexToRgb(hex: string): string {
  const cleanHex = hex.replace(/^#/, "");
  if (cleanHex.length !== 6) return hex;

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Format a number with locale-appropriate separators.
 */
function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format a percentage with one decimal place.
 */
function formatPercent(num: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num);
}

/**
 * Format a date for display.
 */
function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Generate CSS styles for the PDF report.
 */
function getStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: ${COLORS.text};
      background: ${COLORS.background};
    }
    .report-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
    }
    .header {
      margin-bottom: 32px;
      border-bottom: 2px solid ${COLORS.border};
      padding-bottom: 16px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header .subtitle {
      color: ${COLORS.textMuted};
      margin-bottom: 8px;
    }
    .header .date-range {
      font-size: 13px;
      color: ${COLORS.textMuted};
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: ${COLORS.background};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 16px;
    }
    .stat-card .label {
      font-size: 12px;
      color: ${COLORS.textMuted};
      margin-bottom: 4px;
    }
    .stat-card .value {
      font-size: 20px;
      font-weight: 600;
    }
    .section {
      margin-bottom: 32px;
    }
    .section h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 12px 8px;
      border-bottom: 2px solid ${COLORS.border};
      font-size: 12px;
      font-weight: 600;
      color: ${COLORS.textMuted};
    }
    td {
      padding: 12px 8px;
      border-bottom: 1px solid ${COLORS.border};
    }
    .text-right {
      text-align: right;
    }
    .text-muted {
      color: ${COLORS.textMuted};
    }
    .trend-up {
      color: ${COLORS.positive};
    }
    .trend-down {
      color: ${COLORS.negative};
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid ${COLORS.border};
      font-size: 12px;
      color: ${COLORS.textMuted};
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 1cm; }
    }
  `;
}

/**
 * Render header section with optional branding.
 */
function renderHeader(
  data: ReportRenderData,
  labels: ReportLabels,
  branding?: ReportBranding,
): string {
  const { metadata } = data;
  const dateRangeStr = `${formatDate(metadata.dateRange.start, metadata.locale)} - ${formatDate(metadata.dateRange.end, metadata.locale)}`;

  // Use branding primary color if provided, else default
  const primaryColor = branding?.primaryColor
    ? hexToRgb(branding.primaryColor)
    : COLORS.primary;

  // Logo HTML (only if branding.logoUrl is set)
  const logoHtml = branding?.logoUrl
    ? `<div class="logo" style="margin-bottom: 12px;">
        <img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(metadata.clientName)} logo" style="max-height: 48px; max-width: 200px; object-fit: contain;" />
      </div>`
    : "";

  return `
    <div class="header">
      ${logoHtml}
      <h1 style="color: ${primaryColor};">${escapeHtml(metadata.clientName)}</h1>
      <div class="subtitle">${labels.subtitle}</div>
      <div class="date-range">${labels.dateRange}: ${dateRangeStr}</div>
    </div>
  `;
}

/**
 * Render summary stats grid.
 */
function renderStats(
  data: ReportRenderData,
  labels: ReportLabels,
): string {
  const { gscSummary, ga4Summary, metadata } = data;
  const locale = metadata.locale;

  const stats = [
    { label: labels.clicks, value: formatNumber(gscSummary.clicks, locale) },
    { label: labels.impressions, value: formatNumber(gscSummary.impressions, locale) },
    { label: labels.sessions, value: formatNumber(ga4Summary.sessions, locale) },
    { label: labels.users, value: formatNumber(ga4Summary.users, locale) },
    { label: labels.ctr, value: formatPercent(gscSummary.ctr, locale) },
    { label: labels.position, value: gscSummary.position.toFixed(1) },
    { label: labels.conversions, value: formatNumber(ga4Summary.conversions, locale) },
    { label: labels.bounceRate, value: formatPercent(ga4Summary.bounce_rate / 100, locale) },
  ];

  const cards = stats.map((s) => `
    <div class="stat-card">
      <div class="label">${s.label}</div>
      <div class="value">${s.value}</div>
    </div>
  `).join("");

  return `<div class="stats-grid">${cards}</div>`;
}

/**
 * Render top queries table.
 */
function renderQueriesTable(
  data: ReportRenderData,
  labels: ReportLabels,
): string {
  const { topQueries, metadata } = data;
  const locale = metadata.locale;

  if (topQueries.length === 0) {
    return `<div class="section"><p class="text-muted">No query data available</p></div>`;
  }

  const rows = topQueries.map((q, i) => {
    const trendClass = q.position_delta < 0 ? "trend-up" : q.position_delta > 0 ? "trend-down" : "";
    const trendText = q.position_delta !== 0
      ? `${q.position_delta > 0 ? "+" : ""}${q.position_delta.toFixed(1)}`
      : "-";

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(q.query)}</td>
        <td class="text-right">${formatNumber(q.clicks, locale)}</td>
        <td class="text-right">${formatNumber(q.impressions, locale)}</td>
        <td class="text-right">${formatPercent(q.ctr, locale)}</td>
        <td class="text-right">${q.position.toFixed(1)}</td>
        <td class="text-right ${trendClass}">${trendText}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="section">
      <h2>${labels.topQueries}</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${labels.query}</th>
            <th class="text-right">${labels.clicks}</th>
            <th class="text-right">${labels.impressions}</th>
            <th class="text-right">${labels.ctr}</th>
            <th class="text-right">${labels.position}</th>
            <th class="text-right">${labels.wow}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render footer with generation timestamp and optional branding.
 *
 * SECURITY NOTE: branding.footerText is pre-sanitized by the API layer
 * (Plan 16-03) using DOMPurify. Only safe tags are allowed.
 */
function renderFooter(
  data: ReportRenderData,
  labels: ReportLabels,
  branding?: ReportBranding,
): string {
  const { metadata } = data;
  const generatedAt = formatDate(metadata.generatedAt, metadata.locale);

  // Use custom footer text if provided, else default attribution
  const footerContent = branding?.footerText
    ? branding.footerText // Pre-sanitized HTML from API
    : `<p>${labels.generatedBy}</p>`;

  return `
    <div class="footer">
      ${footerContent}
      <p>${labels.generatedAt}: ${generatedAt}</p>
    </div>
  `;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render complete report HTML document.
 *
 * @param data - Report data payload
 * @param labels - Localized labels
 * @param branding - Optional client branding for white-label reports
 * @returns Full HTML document string
 */
export function renderReportToHTML(
  data: ReportRenderData,
  labels: ReportLabels,
  branding?: ReportBranding,
): string {
  const html = `<!DOCTYPE html>
<html lang="${data.metadata.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${labels.title} - ${escapeHtml(data.metadata.clientName)}</title>
  <style>${getStyles()}</style>
</head>
<body>
  <div class="report-container">
    ${renderHeader(data, labels, branding)}
    ${renderStats(data, labels)}
    ${renderQueriesTable(data, labels)}
    ${renderFooter(data, labels, branding)}
  </div>
</body>
</html>`;

  return html;
}
