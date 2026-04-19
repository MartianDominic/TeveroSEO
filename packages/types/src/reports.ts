/**
 * Report type definitions for the report template system.
 *
 * Used by:
 * - apps/web report components (ReportTemplate, ReportHeader, etc.)
 * - open-seo-main report worker (PDF generation)
 * - API routes for report management
 */

/**
 * Available report section types for template composition.
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

/**
 * A report template defining which sections to include and in what order.
 */
export interface ReportTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Ordered list of sections to include */
  sections: ReportSection[];
  /** Default locale for the report */
  locale: string;
}

/**
 * Metadata for a generated report.
 * Stored in database for report management and caching.
 */
export interface ReportMetadata {
  /** Unique report identifier */
  id: string;
  /** Client this report belongs to */
  clientId: string;
  /** Client display name */
  clientName: string;
  /** Report type (e.g., "monthly-seo", "weekly-summary") */
  reportType: string;
  /** Date range covered by the report */
  dateRange: {
    start: string;
    end: string;
  };
  /** Locale used for formatting */
  locale: string;
  /** ISO8601 timestamp when report was generated */
  generatedAt: string;
  /** Hash of report data for cache invalidation */
  contentHash: string;
  /** Path to generated PDF file (if exported) */
  pdfPath?: string;
}
