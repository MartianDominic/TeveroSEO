/**
 * Portal PDF Export Service
 * Phase 96: CPR-001, CPR-004
 *
 * Generates PDF exports for portal clients with:
 * - White-label branding support (logo, colors, company name)
 * - Privacy filtering based on visibility config
 * - Multiple section types (trends, cannibalization, striking distance, topic clusters)
 *
 * Uses Puppeteer for PDF generation via pdf-generator service.
 */
import { db } from "@/db";
import { clientBranding } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { analyzePageTrends } from "@/server/features/analytics/services/TrendDetectionService";
import { getCannibalizationService } from "@/server/features/analytics";
import { getStrikingDistancePages } from "@/server/features/analytics/services/StrikingDistanceService";
import { TopicClusterService } from "@/server/features/analytics/services/TopicClusterService";
import type { TrendAnalysis } from "@/server/features/analytics/types";
import type { VisibilityConfig } from "@/db/analytics-extended-schema";

/**
 * White-label branding configuration for PDF exports.
 */
export interface PortalBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  footerText: string | null;
}

/**
 * Default TeveroSEO branding when no custom branding is configured.
 */
const DEFAULT_BRANDING: PortalBranding = {
  logoUrl: null,
  primaryColor: "#3b82f6",
  secondaryColor: "#10b981",
  companyName: "TeveroSEO",
  footerText: null,
};

/**
 * Parameters for rendering portal PDF export.
 */
export interface PortalPdfRenderParams {
  clientId: string;
  clientName: string;
  siteId: string;
  sections: Array<"trends" | "cannibalization" | "striking_distance" | "topic_clusters">;
  dateRange: { start: string; end: string };
  visibility: VisibilityConfig;
  branding: PortalBranding | null;
  locale: string;
}

/**
 * Get client branding from database.
 * Returns default branding if no custom branding is configured.
 */
export async function getClientBranding(clientId: string): Promise<PortalBranding> {
  try {
    const result = await db
      .select()
      .from(clientBranding)
      .where(eq(clientBranding.clientId, clientId))
      .limit(1);

    if (result.length === 0) {
      // Try to get workspace/agency name as company name
      const clientResult = await db.execute(sql`
        SELECT c.name as client_name, o.name as org_name
        FROM clients c
        LEFT JOIN organization o ON c.workspace_id = o.id
        WHERE c.id = ${clientId}
        LIMIT 1
      `);

      const orgName = clientResult.rows[0]?.org_name as string | undefined;

      return {
        ...DEFAULT_BRANDING,
        companyName: orgName || DEFAULT_BRANDING.companyName,
      };
    }

    const branding = result[0];

    // Get organization name for company name
    const clientResult = await db.execute(sql`
      SELECT o.name as org_name
      FROM clients c
      LEFT JOIN organization o ON c.workspace_id = o.id
      WHERE c.id = ${clientId}
      LIMIT 1
    `);

    const orgName = clientResult.rows[0]?.org_name as string | undefined;

    return {
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      companyName: orgName || DEFAULT_BRANDING.companyName,
      footerText: branding.footerText,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

/**
 * Convert hex color to RGB format for Puppeteer PDF compatibility.
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
 * Format number with locale-appropriate separators.
 */
function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format percentage with one decimal place.
 */
function formatPercent(num: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num / 100);
}

/**
 * Render portal PDF export HTML with all sections, visibility filtering, and white-label.
 */
export async function renderPortalExportPDF(params: PortalPdfRenderParams): Promise<string> {
  const { clientId, clientName, siteId, sections, dateRange, visibility, branding, locale } = params;

  const useBranding = branding || DEFAULT_BRANDING;
  const primaryColor = hexToRgb(useBranding.primaryColor);
  const secondaryColor = hexToRgb(useBranding.secondaryColor);

  const periodDays = Math.ceil(
    (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Collect section HTML
  const sectionHtmls: string[] = [];

  for (const section of sections) {
    switch (section) {
      case "trends": {
        // Skip if both growing and decaying are hidden
        if (!visibility.canViewGrowing && !visibility.canViewDecaying) {
          continue;
        }

        const trendResult = await analyzePageTrends(siteId, { periodDays });

        // Filter by visibility
        const filteredPages = trendResult.pages.filter((page: TrendAnalysis) => {
          if (page.trend === "growing" && !visibility.canViewGrowing) return false;
          if (page.trend === "decaying" && !visibility.canViewDecaying) return false;
          return true;
        });

        if (filteredPages.length === 0) continue;

        const rows = filteredPages
          .slice(0, 20) // Limit for PDF
          .map(
            (page: TrendAnalysis) => `
          <tr>
            <td class="url-cell">${escapeHtml(page.pageUrl)}</td>
            <td class="number-cell">${formatNumber(page.currentClicks, locale)}</td>
            <td class="number-cell">${formatNumber(page.previousClicks, locale)}</td>
            <td class="number-cell ${page.changePercent >= 0 ? "positive" : "negative"}">
              ${page.changePercent >= 0 ? "+" : ""}${page.changePercent.toFixed(1)}%
            </td>
            <td class="${page.trend === "growing" ? "positive" : "negative"}">${page.trend}</td>
          </tr>
        `
          )
          .join("");

        sectionHtmls.push(`
          <div class="section">
            <h2>Page Trends</h2>
            <table>
              <thead>
                <tr>
                  <th>Page URL</th>
                  <th class="number-header">Current Clicks</th>
                  <th class="number-header">Previous Clicks</th>
                  <th class="number-header">Change</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `);
        break;
      }

      case "cannibalization": {
        if (!visibility.canViewCannibalization) continue;

        const cannibService = getCannibalizationService();
        const issues = await cannibService.detectCannibalization(siteId, { limit: 20 });

        if (issues.length === 0) continue;

        const rows = issues
          .map(
            (issue) => `
          <tr>
            <td>${escapeHtml(issue.query)}</td>
            <td class="number-cell">${issue.pages.length}</td>
            <td class="${issue.severity === "high" ? "negative" : issue.severity === "medium" ? "warning" : ""}">${issue.severity}</td>
            <td class="url-cell">${escapeHtml(issue.pages[0]?.pageUrl || "")}</td>
            <td class="url-cell">${escapeHtml(issue.pages.slice(1).map((p) => p.pageUrl).join(", "))}</td>
          </tr>
        `
          )
          .join("");

        sectionHtmls.push(`
          <div class="section">
            <h2>Cannibalization Issues</h2>
            <table>
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th class="number-header">Pages</th>
                  <th>Severity</th>
                  <th>Primary Page</th>
                  <th>Secondary Pages</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `);
        break;
      }

      case "striking_distance": {
        const strikingResult = await getStrikingDistancePages(siteId, {
          minPosition: 11,
          maxPosition: 20,
          limit: 20,
        });

        if (strikingResult.pages.length === 0) continue;

        const rows = strikingResult.pages
          .map(
            (page) => `
          <tr>
            <td class="url-cell">${escapeHtml(page.pageUrl)}</td>
            <td class="number-cell">${page.avgPosition.toFixed(1)}</td>
            <td class="number-cell">${formatNumber(page.impressions, locale)}</td>
            <td class="number-cell">${formatNumber(page.currentClicks, locale)}</td>
            <td class="number-cell positive">${formatNumber(page.potentialClicks, locale)}</td>
            <td>${page.difficulty}</td>
          </tr>
        `
          )
          .join("");

        sectionHtmls.push(`
          <div class="section">
            <h2>Striking Distance Opportunities</h2>
            <p class="section-description">Keywords ranking #11-20 with potential for page 1</p>
            <table>
              <thead>
                <tr>
                  <th>Page URL</th>
                  <th class="number-header">Avg Position</th>
                  <th class="number-header">Impressions</th>
                  <th class="number-header">Current Clicks</th>
                  <th class="number-header">Potential Clicks</th>
                  <th>Difficulty</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `);
        break;
      }

      case "topic_clusters": {
        const clusterService = new TopicClusterService();
        const clusters = await clusterService.getClusters(siteId);

        if (clusters.length === 0) continue;

        const rows = clusters
          .slice(0, 15) // Limit for PDF
          .map(
            (cluster) => `
          <tr>
            <td>${escapeHtml(cluster.name)}</td>
            <td class="url-cell">${escapeHtml(cluster.hubPage.url)}</td>
            <td class="number-cell">${cluster.spokePages.length}</td>
            <td class="number-cell">${cluster.coverage.toFixed(1)}%</td>
            <td class="number-cell">${formatNumber(cluster.totalClicks, locale)}</td>
            <td class="number-cell">${formatNumber(cluster.totalImpressions, locale)}</td>
          </tr>
        `
          )
          .join("");

        sectionHtmls.push(`
          <div class="section">
            <h2>Topic Clusters</h2>
            <table>
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th>Hub Page</th>
                  <th class="number-header">Spokes</th>
                  <th class="number-header">Coverage</th>
                  <th class="number-header">Clicks</th>
                  <th class="number-header">Impressions</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `);
        break;
      }
    }
  }

  // Build header with white-label
  const logoHtml = useBranding.logoUrl
    ? `<img src="${escapeHtml(useBranding.logoUrl)}" alt="${escapeHtml(useBranding.companyName)} logo" class="logo" />`
    : "";

  const footerHtml = useBranding.footerText
    ? `<div class="footer-custom">${useBranding.footerText}</div>`
    : `<div class="footer-default">Generated by ${escapeHtml(useBranding.companyName)}</div>`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Export - ${escapeHtml(clientName)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: rgb(17, 24, 39);
      background: white;
      padding: 24px;
    }
    .header {
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 2px solid rgb(229, 231, 235);
    }
    .logo {
      max-height: 48px;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: ${primaryColor};
      margin-bottom: 4px;
    }
    .header .subtitle {
      color: rgb(107, 114, 128);
      margin-bottom: 8px;
    }
    .header .date-range {
      font-size: 11px;
      color: rgb(107, 114, 128);
    }
    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 16px;
      font-weight: 600;
      color: ${secondaryColor};
      margin-bottom: 12px;
    }
    .section-description {
      color: rgb(107, 114, 128);
      font-size: 11px;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 2px solid rgb(229, 231, 235);
      font-weight: 600;
      color: rgb(107, 114, 128);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid rgb(229, 231, 235);
    }
    tr:nth-child(even) {
      background: rgb(249, 250, 251);
    }
    .number-header, .number-cell {
      text-align: right;
    }
    .url-cell {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .positive {
      color: rgb(16, 185, 129);
    }
    .negative {
      color: rgb(239, 68, 68);
    }
    .warning {
      color: rgb(245, 158, 11);
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid rgb(229, 231, 235);
      text-align: center;
      font-size: 11px;
      color: rgb(107, 114, 128);
    }
    .footer-custom, .footer-default {
      margin-bottom: 4px;
    }
    .footer-timestamp {
      font-size: 10px;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 1cm; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <h1>${escapeHtml(clientName)}</h1>
    <div class="subtitle">Analytics Export</div>
    <div class="date-range">Date Range: ${dateRange.start} to ${dateRange.end}</div>
  </div>

  ${sectionHtmls.join("\n")}

  <div class="footer">
    ${footerHtml}
    <div class="footer-timestamp">Generated: ${new Date().toISOString()}</div>
  </div>
</body>
</html>`;
}
