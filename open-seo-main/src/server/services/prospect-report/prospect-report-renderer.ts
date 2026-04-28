/**
 * Prospect Report HTML Renderer for PDF generation.
 * Phase 30-05: Analysis PDF Export
 *
 * Generates static HTML from prospect analysis data for Puppeteer PDF rendering.
 * Uses RGB colors (not hex/CSS variables) for Puppeteer compatibility.
 *
 * Note: This is a server-side HTML generator, not using React components
 * because those use "use client" directives which don't work with server-side rendering.
 */

import type {
  ProspectSelect,
  ProspectAnalysisSelect,
  DomainMetrics,
  KeywordGap,
  OpportunityKeyword,
  OrganicKeywordItem,
} from "@/db/prospect-schema";

/** PDF-safe RGB color palette */
const COLORS = {
  primary: "rgb(59, 130, 246)", // Blue
  secondary: "rgb(16, 185, 129)", // Emerald
  accent: "rgb(245, 158, 11)", // Amber
  text: "rgb(17, 24, 39)", // Gray-900
  textMuted: "rgb(107, 114, 128)", // Gray-500
  border: "rgb(229, 231, 235)", // Gray-200
  background: "rgb(255, 255, 255)",
  positive: "rgb(16, 185, 129)", // Emerald
  negative: "rgb(239, 68, 68)", // Red
  warning: "rgb(245, 158, 11)", // Amber
  cardBg: "rgb(249, 250, 251)", // Gray-50
};

/** Data for prospect report rendering */
export interface ProspectReportData {
  prospect: ProspectSelect;
  analysis: ProspectAnalysisSelect;
  generatedAt: string;
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
function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "-";
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Format a date for display.
 */
function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format currency (CPC values).
 */
function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Get achievability badge text.
 */
function getAchievabilityText(score: number | undefined): string {
  if (score === undefined) return "-";
  if (score >= 70) return "Easy";
  if (score >= 40) return "Moderate";
  return "Hard";
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
      font-size: 12px;
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
      margin-bottom: 24px;
      border-bottom: 3px solid ${COLORS.primary};
      padding-bottom: 16px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: ${COLORS.primary};
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 14px;
      color: ${COLORS.textMuted};
      margin-bottom: 8px;
    }
    .header .date-info {
      font-size: 11px;
      color: ${COLORS.textMuted};
    }
    .company-info {
      background: ${COLORS.cardBg};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .company-info h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .company-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .company-info-item {
      font-size: 11px;
    }
    .company-info-item .label {
      color: ${COLORS.textMuted};
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: ${COLORS.cardBg};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .metric-card .label {
      font-size: 10px;
      color: ${COLORS.textMuted};
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-card .value {
      font-size: 18px;
      font-weight: 700;
      color: ${COLORS.text};
    }
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${COLORS.border};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 2px solid ${COLORS.border};
      font-size: 10px;
      font-weight: 600;
      color: ${COLORS.textMuted};
      text-transform: uppercase;
    }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid ${COLORS.border};
      vertical-align: top;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .text-muted {
      color: ${COLORS.textMuted};
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }
    .badge-easy {
      background: rgb(209, 250, 229);
      color: rgb(6, 95, 70);
    }
    .badge-moderate {
      background: rgb(254, 243, 199);
      color: rgb(146, 64, 14);
    }
    .badge-hard {
      background: rgb(254, 226, 226);
      color: rgb(153, 27, 27);
    }
    .badge-category {
      background: ${COLORS.cardBg};
      color: ${COLORS.textMuted};
      border: 1px solid ${COLORS.border};
    }
    .opportunity-score {
      font-weight: 700;
    }
    .score-high {
      color: ${COLORS.positive};
    }
    .score-medium {
      color: ${COLORS.warning};
    }
    .score-low {
      color: ${COLORS.negative};
    }
    .insights-section {
      background: rgb(239, 246, 255);
      border: 1px solid rgb(191, 219, 254);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .insights-section h2 {
      color: ${COLORS.primary};
      border-bottom: none;
      margin-bottom: 8px;
    }
    .insight-item {
      margin-bottom: 8px;
      padding-left: 16px;
      position: relative;
    }
    .insight-item::before {
      content: "\\2022";
      position: absolute;
      left: 0;
      color: ${COLORS.primary};
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid ${COLORS.border};
      font-size: 10px;
      color: ${COLORS.textMuted};
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 1cm; }
      .section { page-break-inside: avoid; }
    }
  `;
}

/**
 * Render header section with domain and company info.
 */
function renderHeader(data: ProspectReportData): string {
  const { prospect, generatedAt } = data;
  const generatedDate = formatDate(generatedAt);

  return `
    <div class="header">
      <h1>SEO Analysis Report</h1>
      <div class="subtitle">${escapeHtml(prospect.domain)}</div>
      <div class="date-info">Generated on ${generatedDate}</div>
    </div>
  `;
}

/**
 * Render company/prospect information section.
 */
function renderCompanyInfo(data: ProspectReportData): string {
  const { prospect, analysis } = data;
  const businessInfo = analysis.scrapedContent?.businessInfo;

  const items: Array<{ label: string; value: string }> = [];

  if (prospect.companyName) {
    items.push({ label: "Company", value: prospect.companyName });
  }
  if (prospect.industry) {
    items.push({ label: "Industry", value: prospect.industry });
  }
  if (businessInfo?.location) {
    items.push({ label: "Location", value: businessInfo.location });
  }
  if (businessInfo?.targetMarket) {
    const marketLabel =
      businessInfo.targetMarket === "both"
        ? "Residential & Commercial"
        : businessInfo.targetMarket.charAt(0).toUpperCase() +
          businessInfo.targetMarket.slice(1);
    items.push({ label: "Target Market", value: marketLabel });
  }
  if (prospect.contactName) {
    items.push({ label: "Contact", value: prospect.contactName });
  }
  if (prospect.contactEmail) {
    items.push({ label: "Email", value: prospect.contactEmail });
  }

  if (items.length === 0) return "";

  const itemsHtml = items
    .map(
      (item) => `
      <div class="company-info-item">
        <span class="label">${item.label}:</span> ${escapeHtml(item.value)}
      </div>
    `,
    )
    .join("");

  return `
    <div class="company-info">
      <h2>Business Information</h2>
      <div class="company-info-grid">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Render domain metrics grid.
 */
function renderMetrics(metrics: DomainMetrics | null | undefined): string {
  if (!metrics) {
    return `
      <div class="section">
        <h2>Domain Metrics</h2>
        <p class="text-muted">No domain metrics available</p>
      </div>
    `;
  }

  const cards = [
    { label: "Domain Rank", value: formatNumber(metrics.domainRank) },
    { label: "Organic Traffic", value: formatNumber(metrics.organicTraffic) },
    { label: "Organic Keywords", value: formatNumber(metrics.organicKeywords) },
    { label: "Backlinks", value: formatNumber(metrics.backlinks) },
    {
      label: "Referring Domains",
      value: formatNumber(metrics.referringDomains),
    },
  ];

  const cardsHtml = cards
    .map(
      (card) => `
      <div class="metric-card">
        <div class="label">${card.label}</div>
        <div class="value">${card.value}</div>
      </div>
    `,
    )
    .join("");

  return `
    <div class="section">
      <h2>Domain Metrics</h2>
      <div class="metrics-grid">${cardsHtml}</div>
    </div>
  `;
}

/**
 * Render keyword opportunities table.
 */
function renderKeywordOpportunities(
  keywords: OpportunityKeyword[] | null | undefined,
): string {
  if (!keywords || keywords.length === 0) {
    return "";
  }

  // Sort by opportunity score descending, take top 15
  const sorted = [...keywords]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 15);

  const rows = sorted
    .map((kw, i) => {
      const scoreClass =
        kw.opportunityScore >= 70
          ? "score-high"
          : kw.opportunityScore >= 40
            ? "score-medium"
            : "score-low";

      const achievabilityClass =
        (kw.achievability ?? 0) >= 70
          ? "badge-easy"
          : (kw.achievability ?? 0) >= 40
            ? "badge-moderate"
            : "badge-hard";

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(kw.keyword)}</td>
          <td class="text-center"><span class="badge badge-category">${kw.category}</span></td>
          <td class="text-right">${formatNumber(kw.searchVolume)}</td>
          <td class="text-right">${formatCurrency(kw.cpc)}</td>
          <td class="text-center">${kw.difficulty}</td>
          <td class="text-center"><span class="badge ${achievabilityClass}">${getAchievabilityText(kw.achievability)}</span></td>
          <td class="text-center"><span class="opportunity-score ${scoreClass}">${kw.opportunityScore}</span></td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="section">
      <h2>AI-Discovered Keyword Opportunities</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Keyword</th>
            <th class="text-center">Category</th>
            <th class="text-right">Volume</th>
            <th class="text-right">CPC</th>
            <th class="text-center">Diff.</th>
            <th class="text-center">Achievability</th>
            <th class="text-center">Score</th>
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
 * Render keyword gaps table (competitor analysis).
 */
function renderKeywordGaps(gaps: KeywordGap[] | null | undefined): string {
  if (!gaps || gaps.length === 0) {
    return "";
  }

  // Sort by traffic potential descending, take top 15
  const sorted = [...gaps]
    .sort((a, b) => b.trafficPotential - a.trafficPotential)
    .slice(0, 15);

  const rows = sorted
    .map((gap, i) => {
      const achievabilityClass =
        (gap.achievability ?? 0) >= 70
          ? "badge-easy"
          : (gap.achievability ?? 0) >= 40
            ? "badge-moderate"
            : "badge-hard";

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(gap.keyword)}</td>
          <td class="text-muted">${escapeHtml(gap.competitorDomain)}</td>
          <td class="text-center">${gap.competitorPosition}</td>
          <td class="text-right">${formatNumber(gap.searchVolume)}</td>
          <td class="text-right">${formatCurrency(gap.cpc)}</td>
          <td class="text-center">${gap.difficulty}</td>
          <td class="text-center"><span class="badge ${achievabilityClass}">${getAchievabilityText(gap.achievability)}</span></td>
          <td class="text-right">${formatNumber(gap.trafficPotential)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="section">
      <h2>Keyword Gap Analysis</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Keyword</th>
            <th>Competitor</th>
            <th class="text-center">Pos.</th>
            <th class="text-right">Volume</th>
            <th class="text-right">CPC</th>
            <th class="text-center">Diff.</th>
            <th class="text-center">Achievability</th>
            <th class="text-right">Traffic Pot.</th>
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
 * Render current organic keywords table.
 */
function renderOrganicKeywords(
  keywords: OrganicKeywordItem[] | null | undefined,
): string {
  if (!keywords || keywords.length === 0) {
    return "";
  }

  // Sort by position ascending (best rankings first), take top 15
  const sorted = [...keywords].sort((a, b) => a.position - b.position).slice(0, 15);

  const rows = sorted
    .map((kw, i) => {
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(kw.keyword)}</td>
          <td class="text-center">${kw.position}</td>
          <td class="text-right">${formatNumber(kw.searchVolume)}</td>
          <td class="text-right">${formatCurrency(kw.cpc)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="section">
      <h2>Current Rankings</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Keyword</th>
            <th class="text-center">Position</th>
            <th class="text-right">Volume</th>
            <th class="text-right">CPC</th>
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
 * Generate AI insights summary from analysis data.
 */
function generateInsights(data: ProspectReportData): string[] {
  const { analysis } = data;
  const insights: string[] = [];

  // Domain metrics insights
  const metrics = analysis.domainMetrics;
  if (metrics) {
    if ((metrics.domainRank ?? 0) < 50) {
      insights.push(
        `Strong domain authority (Rank ${metrics.domainRank}) indicates established trust.`,
      );
    } else if ((metrics.domainRank ?? 100) > 70) {
      insights.push(
        `Domain authority (Rank ${metrics.domainRank}) has room for improvement through quality backlinks.`,
      );
    }

    if ((metrics.organicTraffic ?? 0) > 1000) {
      insights.push(
        `Currently receiving ${formatNumber(metrics.organicTraffic)} organic visitors monthly.`,
      );
    }
  }

  // Keyword opportunity insights
  const opportunities = analysis.opportunityKeywords ?? [];
  const quickWins = opportunities.filter(
    (kw) => kw.classification === "quick_win",
  );
  const strategic = opportunities.filter(
    (kw) => kw.classification === "strategic",
  );

  if (quickWins.length > 0) {
    insights.push(
      `Found ${quickWins.length} quick-win keywords with low competition that could drive traffic within 1-3 months.`,
    );
  }

  if (strategic.length > 0) {
    insights.push(
      `Identified ${strategic.length} strategic keywords for long-term growth and market positioning.`,
    );
  }

  // Keyword gap insights
  const gaps = analysis.keywordGaps ?? [];
  const highValueGaps = gaps.filter((g) => g.trafficPotential > 100);
  if (highValueGaps.length > 0) {
    insights.push(
      `Competitors rank for ${highValueGaps.length} high-value keywords that could bring significant traffic.`,
    );
  }

  // Business category insights
  const businessInfo = analysis.scrapedContent?.businessInfo;
  if (businessInfo?.products && businessInfo.products.length > 0) {
    insights.push(
      `Product focus areas: ${businessInfo.products.slice(0, 3).join(", ")}.`,
    );
  }

  // Default insight if none generated
  if (insights.length === 0) {
    insights.push(
      "Complete analysis data to generate personalized SEO recommendations.",
    );
  }

  return insights;
}

/**
 * Render AI insights section.
 */
function renderInsights(data: ProspectReportData): string {
  const insights = generateInsights(data);

  const insightItems = insights
    .map((insight) => `<div class="insight-item">${escapeHtml(insight)}</div>`)
    .join("");

  return `
    <div class="insights-section">
      <h2>Key Insights</h2>
      ${insightItems}
    </div>
  `;
}

/**
 * Render footer section.
 */
function renderFooter(data: ProspectReportData): string {
  const { analysis } = data;
  const costDisplay =
    analysis.costCents != null ? `$${(analysis.costCents / 100).toFixed(2)}` : "-";

  return `
    <div class="footer">
      <p>Analysis Type: ${analysis.analysisType} | API Cost: ${costDisplay}</p>
      <p>Generated by TeveroSEO</p>
    </div>
  `;
}

/**
 * Render complete prospect report HTML document.
 *
 * @param data - Prospect and analysis data
 * @returns Full HTML document string for PDF generation
 */
export function renderProspectReportToHTML(data: ProspectReportData): string {
  const { prospect, analysis } = data;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Analysis Report - ${escapeHtml(prospect.domain)}</title>
  <style>${getStyles()}</style>
</head>
<body>
  <div class="report-container">
    ${renderHeader(data)}
    ${renderCompanyInfo(data)}
    ${renderInsights(data)}
    ${renderMetrics(analysis.domainMetrics)}
    ${renderKeywordOpportunities(analysis.opportunityKeywords)}
    ${renderKeywordGaps(analysis.keywordGaps)}
    ${renderOrganicKeywords(analysis.organicKeywords)}
    ${renderFooter(data)}
  </div>
</body>
</html>`;

  return html;
}
