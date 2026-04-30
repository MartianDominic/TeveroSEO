/**
 * Modular section renderer for customizable PDF reports.
 *
 * Each section renders independently based on ReportRenderData.
 * Sections use RGB colors for Puppeteer PDF compatibility.
 *
 * Phase 53 Plan 02: Section-based PDF generation.
 */
import type { ReportRenderData, ReportLabels, ReportBranding } from "./report-renderer";

/**
 * Available report section types for template composition.
 * Matches packages/types/src/reports.ts for consistency.
 */
export type ReportSectionType =
  | "header"
  | "summary_stats"
  | "gsc_chart"
  | "ga4_chart"
  | "queries_table"
  | "footer";

/**
 * A single section within a report template.
 */
export interface ReportSection {
  /** The type of section to render */
  type: ReportSectionType;
  /** Display order within the report (lower = earlier) */
  order: number;
  /** Section-specific configuration options */
  config?: Record<string, unknown>;
}

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
 * Render header section with optional branding.
 * Includes logo, client name, date range, and report title.
 */
export function renderHeaderSection(
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
 * 4x2 grid of stat cards: clicks, impressions, sessions, users, CTR, position, conversions, bounce rate.
 */
export function renderSummaryStatsSection(
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
      <div class="label">${escapeHtml(s.label)}</div>
      <div class="value">${s.value}</div>
    </div>
  `).join("");

  return `<div class="stats-grid">${cards}</div>`;
}

/**
 * Render GSC chart section.
 * If chartImageUrl provided, render as <img>. Otherwise render as static table fallback.
 */
export function renderGSCChartSection(
  data: ReportRenderData,
  labels: ReportLabels,
  chartImageUrl?: string,
): string {
  const { gscDaily, metadata } = data;
  const locale = metadata.locale;

  if (chartImageUrl) {
    return `
      <div class="section">
        <h2>${labels.clicks} & ${labels.impressions}</h2>
        <img src="${chartImageUrl}" alt="GSC Performance Chart" style="width: 100%; max-width: 700px; height: auto;" />
      </div>
    `;
  }

  // Table fallback when chart snapshot not available
  if (gscDaily.length === 0) {
    return `<div class="section"><h2>${labels.clicks} & ${labels.impressions}</h2><p class="text-muted">No GSC data available</p></div>`;
  }

  // Show first and last 5 days as table fallback
  const displayRows = gscDaily.length <= 10
    ? gscDaily
    : [...gscDaily.slice(0, 5), ...gscDaily.slice(-5)];

  const rows = displayRows.map((d) => `
    <tr>
      <td>${formatDate(d.date, locale)}</td>
      <td class="text-right">${formatNumber(d.clicks, locale)}</td>
      <td class="text-right">${formatNumber(d.impressions, locale)}</td>
      <td class="text-right">${formatPercent(d.ctr, locale)}</td>
      <td class="text-right">${d.position.toFixed(1)}</td>
    </tr>
  `).join("");

  return `
    <div class="section">
      <h2>${labels.clicks} & ${labels.impressions}</h2>
      <table>
        <thead>
          <tr>
            <th>${labels.dateRange}</th>
            <th class="text-right">${labels.clicks}</th>
            <th class="text-right">${labels.impressions}</th>
            <th class="text-right">${labels.ctr}</th>
            <th class="text-right">${labels.position}</th>
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
 * Render GA4 chart section.
 * If chartImageUrl provided, render as <img>. Otherwise render as static table fallback.
 */
export function renderGA4ChartSection(
  data: ReportRenderData,
  labels: ReportLabels,
  chartImageUrl?: string,
): string {
  const { ga4Daily, metadata } = data;
  const locale = metadata.locale;

  if (chartImageUrl) {
    return `
      <div class="section">
        <h2>${labels.sessions} & ${labels.users}</h2>
        <img src="${chartImageUrl}" alt="GA4 Performance Chart" style="width: 100%; max-width: 700px; height: auto;" />
      </div>
    `;
  }

  // Table fallback when chart snapshot not available
  if (ga4Daily.length === 0) {
    return `<div class="section"><h2>${labels.sessions} & ${labels.users}</h2><p class="text-muted">No GA4 data available</p></div>`;
  }

  // Show first and last 5 days as table fallback
  const displayRows = ga4Daily.length <= 10
    ? ga4Daily
    : [...ga4Daily.slice(0, 5), ...ga4Daily.slice(-5)];

  const rows = displayRows.map((d) => `
    <tr>
      <td>${formatDate(d.date, locale)}</td>
      <td class="text-right">${formatNumber(d.sessions, locale)}</td>
      <td class="text-right">${formatNumber(d.users, locale)}</td>
      <td class="text-right">${formatPercent(d.bounce_rate / 100, locale)}</td>
    </tr>
  `).join("");

  return `
    <div class="section">
      <h2>${labels.sessions} & ${labels.users}</h2>
      <table>
        <thead>
          <tr>
            <th>${labels.dateRange}</th>
            <th class="text-right">${labels.sessions}</th>
            <th class="text-right">${labels.users}</th>
            <th class="text-right">${labels.bounceRate}</th>
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
 * Render top queries table section.
 * Shows query performance with position delta styling.
 */
export function renderQueriesTableSection(
  data: ReportRenderData,
  labels: ReportLabels,
): string {
  const { topQueries, metadata } = data;
  const locale = metadata.locale;

  if (topQueries.length === 0) {
    return `<div class="section"><h2>${labels.topQueries}</h2><p class="text-muted">No query data available</p></div>`;
  }

  const rows = topQueries.map((q, i) => {
    // Negative position_delta = improved (moved up), positive = declined
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
 * Render footer section with generation timestamp and optional branding.
 *
 * SECURITY NOTE: branding.footerText is pre-sanitized by the API layer
 * (Plan 16-03) using DOMPurify. Only safe tags are allowed.
 */
export function renderFooterSection(
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

/** Maps section type to renderer function */
const SECTION_RENDERERS: Record<
  ReportSectionType,
  (
    data: ReportRenderData,
    labels: ReportLabels,
    branding?: ReportBranding,
    chartUrls?: Record<string, string>,
  ) => string
> = {
  header: (d, l, b) => renderHeaderSection(d, l, b),
  summary_stats: (d, l) => renderSummaryStatsSection(d, l),
  gsc_chart: (d, l, _, charts) => renderGSCChartSection(d, l, charts?.gsc),
  ga4_chart: (d, l, _, charts) => renderGA4ChartSection(d, l, charts?.ga4),
  queries_table: (d, l) => renderQueriesTableSection(d, l),
  footer: (d, l, b) => renderFooterSection(d, l, b),
};

/**
 * Render a single section by type.
 */
export function renderSection(
  type: ReportSectionType,
  data: ReportRenderData,
  labels: ReportLabels,
  branding?: ReportBranding,
  chartUrls?: Record<string, string>,
): string {
  const renderer = SECTION_RENDERERS[type];
  return renderer ? renderer(data, labels, branding, chartUrls) : "";
}

/**
 * Render multiple sections in order.
 * @param sections - Ordered array of sections to include
 */
export function renderSections(
  sections: ReportSection[],
  data: ReportRenderData,
  labels: ReportLabels,
  branding?: ReportBranding,
  chartUrls?: Record<string, string>,
): string {
  // Sort by order, then map to HTML, join with dividers
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  return sorted
    .map((s) => renderSection(s.type, data, labels, branding, chartUrls))
    .filter(Boolean)
    .join('\n<div style="height: 24px;"></div>\n');
}

/**
 * Generate CSS styles for the PDF report.
 */
function getStyles(branding?: ReportBranding): string {
  const primaryColor = branding?.primaryColor
    ? hexToRgb(branding.primaryColor)
    : COLORS.primary;
  const secondaryColor = branding?.secondaryColor
    ? hexToRgb(branding.secondaryColor)
    : COLORS.secondary;

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
      color: ${primaryColor};
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
      color: ${primaryColor};
    }
    .section {
      margin-bottom: 32px;
    }
    .section h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: ${secondaryColor};
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
 * Generate complete HTML document from sections.
 */
export function renderSectionsToHTML(
  sections: ReportSection[],
  data: ReportRenderData,
  labels: ReportLabels,
  branding?: ReportBranding,
  chartUrls?: Record<string, string>,
): string {
  const content = renderSections(sections, data, labels, branding, chartUrls);
  return `<!DOCTYPE html>
<html lang="${data.metadata.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(labels.title)} - ${escapeHtml(data.metadata.clientName)}</title>
  <style>${getStyles(branding)}</style>
</head>
<body>
  <div class="report-container">
    ${content}
  </div>
</body>
</html>`;
}
