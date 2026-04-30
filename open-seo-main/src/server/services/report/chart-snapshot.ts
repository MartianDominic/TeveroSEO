/**
 * Chart snapshot service for PDF reports.
 *
 * Renders chart data as PNG images for embedding in PDFs.
 * Uses Puppeteer to render HTML chart and capture screenshot.
 *
 * Phase 53 Plan 02: Chart snapshots for section-based PDF generation.
 */
import puppeteer from "puppeteer";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "chart-snapshot" });

const PUPPETEER_WS_ENDPOINT = process.env.PUPPETEER_WS_ENDPOINT;
const SNAPSHOT_TIMEOUT_MS = 30_000;

/**
 * Chart data for snapshot generation.
 */
export interface ChartData {
  type: "gsc" | "ga4";
  data: Array<Record<string, number | string>>;
  width?: number;
  height?: number;
}

/** RGB colors for chart rendering */
const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  accent: "#f59e0b",
  grid: "#e5e7eb",
  text: "#374151",
};

/**
 * Generate HTML for a chart that can be rendered to PNG.
 * Uses inline SVG for reliable Puppeteer rendering.
 */
function generateChartHTML(chart: ChartData): string {
  const width = chart.width ?? 700;
  const height = chart.height ?? 280;
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Get the primary metric values based on chart type
  const primaryKey = chart.type === "gsc" ? "clicks" : "sessions";
  const secondaryKey = chart.type === "gsc" ? "impressions" : "users";

  // Extract values for scaling
  const primaryValues = chart.data.map((d) => (d[primaryKey] as number) || 0);
  const secondaryValues = chart.data.map((d) => (d[secondaryKey] as number) || 0);

  // Handle empty data
  if (primaryValues.length === 0) {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: white; font-family: system-ui, sans-serif; }
    .empty { display: flex; align-items: center; justify-content: center; width: ${width}px; height: ${height}px; color: ${CHART_COLORS.text}; }
  </style>
</head>
<body>
  <div class="empty">No data available</div>
</body>
</html>`;
  }

  // Calculate min/max for primary and secondary axes
  const primaryMax = Math.max(...primaryValues, 1);
  const secondaryMax = Math.max(...secondaryValues, 1);

  // Build SVG path points for primary line
  const primaryPoints = chart.data.map((d, i) => {
    const x = padding + (i / Math.max(chart.data.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - ((primaryValues[i] || 0) / primaryMax) * chartHeight;
    return `${x},${y}`;
  });

  // Build SVG path points for secondary line
  const secondaryPoints = chart.data.map((d, i) => {
    const x = padding + (i / Math.max(chart.data.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - ((secondaryValues[i] || 0) / secondaryMax) * chartHeight;
    return `${x},${y}`;
  });

  const primaryPath = "M " + primaryPoints.join(" L ");
  const secondaryPath = "M " + secondaryPoints.join(" L ");

  // Get date labels (first and last)
  const firstDate = chart.data[0]?.date ?? "";
  const lastDate = chart.data[chart.data.length - 1]?.date ?? "";

  // Grid lines (horizontal)
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const y = padding + (i / 4) * chartHeight;
    return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="grid-line" />`;
  }).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: white; }
    svg { display: block; }
    .grid-line { stroke: ${CHART_COLORS.grid}; stroke-width: 1; stroke-dasharray: 4,4; }
    .axis-line { stroke: ${CHART_COLORS.grid}; stroke-width: 1; }
    .primary-line { fill: none; stroke: ${CHART_COLORS.primary}; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .secondary-line { fill: none; stroke: ${CHART_COLORS.secondary}; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .axis-label { fill: ${CHART_COLORS.text}; font-size: 11px; font-family: system-ui, -apple-system, sans-serif; }
    .legend { font-size: 11px; font-family: system-ui, -apple-system, sans-serif; }
    .legend-primary { fill: ${CHART_COLORS.primary}; }
    .legend-secondary { fill: ${CHART_COLORS.secondary}; }
  </style>
</head>
<body>
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <!-- Grid lines -->
    ${gridLines}

    <!-- Axes -->
    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis-line" />
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line" />

    <!-- Secondary line (behind) -->
    <path d="${secondaryPath}" class="secondary-line" />

    <!-- Primary line (front) -->
    <path d="${primaryPath}" class="primary-line" />

    <!-- Y-axis labels (primary) -->
    <text x="${padding - 8}" y="${padding + 4}" text-anchor="end" class="axis-label">${formatAxisNumber(primaryMax)}</text>
    <text x="${padding - 8}" y="${height - padding + 4}" text-anchor="end" class="axis-label">0</text>

    <!-- X-axis labels -->
    <text x="${padding}" y="${height - padding + 20}" text-anchor="start" class="axis-label">${firstDate}</text>
    <text x="${width - padding}" y="${height - padding + 20}" text-anchor="end" class="axis-label">${lastDate}</text>

    <!-- Legend -->
    <rect x="${width - 150}" y="8" width="12" height="12" fill="${CHART_COLORS.primary}" rx="2" />
    <text x="${width - 134}" y="18" class="legend legend-primary">${chart.type === "gsc" ? "Clicks" : "Sessions"}</text>
    <rect x="${width - 150}" y="26" width="12" height="12" fill="${CHART_COLORS.secondary}" rx="2" />
    <text x="${width - 134}" y="36" class="legend legend-secondary">${chart.type === "gsc" ? "Impressions" : "Users"}</text>
  </svg>
</body>
</html>`;
}

/**
 * Format a number for axis labels (abbreviate large numbers).
 */
function formatAxisNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

/**
 * Snapshot a chart to PNG using Puppeteer.
 * @returns Base64-encoded PNG data URL, or empty string on failure
 */
export async function snapshotChart(chart: ChartData): Promise<string> {
  if (!PUPPETEER_WS_ENDPOINT) {
    log.warn("PUPPETEER_WS_ENDPOINT not configured, using table fallback");
    return ""; // Return empty, section renderer will use table fallback
  }

  let browser;
  let page;

  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: PUPPETEER_WS_ENDPOINT,
    });

    page = await browser.newPage();

    const width = chart.width ?? 700;
    const height = chart.height ?? 280;

    await page.setViewport({ width, height });

    const html = generateChartHTML(chart);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const screenshot = await Promise.race([
      page.screenshot({ type: "png", encoding: "base64" }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Chart snapshot timed out")), SNAPSHOT_TIMEOUT_MS)
      ),
    ]);

    log.debug("Chart snapshot generated", { type: chart.type, width, height });

    return `data:image/png;base64,${screenshot}`;
  } catch (err) {
    log.error("Chart snapshot failed", err instanceof Error ? err : new Error(String(err)));
    return ""; // Return empty, section renderer will use table fallback
  } finally {
    if (page) {
      await page.close().catch((closeErr) => {
        log.warn("Failed to close page", { error: (closeErr as Error).message });
      });
    }
    if (browser) {
      browser.disconnect();
    }
  }
}

/**
 * Generate snapshots for multiple charts.
 * @returns Map of chart type to data URL
 */
export async function snapshotCharts(
  gscData?: Array<Record<string, number | string>>,
  ga4Data?: Array<Record<string, number | string>>,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Run snapshots in parallel
  const promises: Promise<void>[] = [];

  if (gscData && gscData.length > 0) {
    promises.push(
      snapshotChart({ type: "gsc", data: gscData }).then((url) => {
        if (url) results.gsc = url;
      })
    );
  }

  if (ga4Data && ga4Data.length > 0) {
    promises.push(
      snapshotChart({ type: "ga4", data: ga4Data }).then((url) => {
        if (url) results.ga4 = url;
      })
    );
  }

  await Promise.all(promises);

  log.info("Chart snapshots completed", {
    gsc: !!results.gsc,
    ga4: !!results.ga4,
  });

  return results;
}
