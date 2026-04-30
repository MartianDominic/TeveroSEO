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
 * Report generation status.
 */
export type ReportStatus = "pending" | "generating" | "complete" | "failed";

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
  /** Report generation status */
  status: ReportStatus;
  /** Error message if generation failed */
  errorMessage?: string;
}

/**
 * Section metadata for UI display in the report builder.
 * Used to render the section selector with labels, descriptions, and icons.
 */
export interface ReportSectionMeta {
  /** The type of section */
  type: ReportSectionType;
  /** Human-readable label for UI */
  label: string;
  /** Description explaining what the section contains */
  description: string;
  /** Lucide icon name for visual identification */
  icon: string;
  /** If true, section cannot be deselected (header/footer) */
  required?: boolean;
}

/**
 * Builder state for report configuration.
 * Used by useReportBuilder hook to manage report creation state.
 */
export interface ReportBuilderConfig {
  /** Report display name */
  name: string;
  /** Selected sections with order */
  sections: ReportSection[];
  /** Date range for data aggregation */
  dateRange: {
    start: string;
    end: string;
  };
  /** Locale for formatting (e.g., "en", "lt") */
  locale: string;
}
