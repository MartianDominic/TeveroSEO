/**
 * PDF-safe color palette and chart configuration.
 *
 * IMPORTANT: Use RGB format (not hex or CSS variables) for Puppeteer PDF compatibility.
 * See: RESEARCH.md pitfall #2 - Puppeteer SVG hex color bug
 */

/**
 * PDF-safe color palette using RGB format.
 * These colors are designed for print/PDF output and work in Puppeteer.
 */
export const REPORT_COLORS = {
  /** Primary action/highlight color - blue-500 */
  primary: "rgb(59, 130, 246)",
  /** Secondary/success color - emerald-500 */
  secondary: "rgb(16, 185, 129)",
  /** Accent/warning color - amber-500 */
  accent: "rgb(245, 158, 11)",
  /** Muted/disabled color - gray-500 */
  muted: "rgb(107, 114, 128)",
  /** Primary text color - gray-900 */
  text: "rgb(17, 24, 39)",
  /** Muted text color - gray-500 */
  textMuted: "rgb(107, 114, 128)",
  /** Border color - gray-200 */
  border: "rgb(229, 231, 235)",
  /** Background color - white */
  background: "rgb(255, 255, 255)",
  /** Positive trend indicator - emerald-500 */
  positive: "rgb(16, 185, 129)",
  /** Negative trend indicator - red-500 */
  negative: "rgb(239, 68, 68)",
  /** Grid line color - gray-300 */
  grid: "rgb(209, 213, 219)",
} as const;

/**
 * Chart dimensions for consistent PDF rendering.
 * Using explicit dimensions (not percentages) for Puppeteer stability.
 * See: RESEARCH.md pitfall #3 - Recharts legend off-screen in PDF
 */
export const CHART_CONFIG = {
  /** Chart width in pixels */
  width: 700,
  /** Chart height in pixels */
  height: 280,
  /** Chart margins */
  margin: { top: 10, right: 30, left: 20, bottom: 5 },
} as const;

/**
 * Report container styles for print-friendly rendering.
 */
export const REPORT_CONTAINER = {
  /** Maximum width for readability */
  maxWidth: 800,
  /** Padding around content */
  padding: 32,
} as const;
