/**
 * Report section definitions and utilities.
 *
 * Provides metadata for all available report sections including
 * labels, descriptions, and icons for the builder UI.
 */

import type { ReportSectionMeta, ReportSection, ReportSectionType } from "@tevero/types";

/**
 * All available report sections with metadata.
 * Order determines default section order in new reports.
 */
export const REPORT_SECTIONS: ReportSectionMeta[] = [
  {
    type: "header",
    label: "Header",
    description: "Client name, date range, logo",
    icon: "FileText",
    required: true,
  },
  {
    type: "summary_stats",
    label: "Summary Stats",
    description: "Key metrics overview (clicks, sessions, CTR)",
    icon: "BarChart3",
  },
  {
    type: "gsc_chart",
    label: "Search Performance",
    description: "Google Search Console trends chart",
    icon: "TrendingUp",
  },
  {
    type: "ga4_chart",
    label: "Analytics Chart",
    description: "Google Analytics 4 sessions/users chart",
    icon: "LineChart",
  },
  {
    type: "queries_table",
    label: "Top Queries",
    description: "Best performing search queries table",
    icon: "Table",
  },
  {
    type: "footer",
    label: "Footer",
    description: "Attribution and generation timestamp",
    icon: "FileSignature",
    required: true,
  },
];

/**
 * Get section metadata by type.
 *
 * @param type - Section type to look up
 * @returns Section metadata or undefined if not found
 */
export function getSectionMeta(type: ReportSectionType): ReportSectionMeta | undefined {
  return REPORT_SECTIONS.find((s) => s.type === type);
}

/**
 * Get default sections for a new report.
 * Includes all sections in default order.
 *
 * @returns Array of ReportSection with order indices
 */
export function getDefaultSections(): ReportSection[] {
  return REPORT_SECTIONS.map((s, i) => ({
    type: s.type,
    order: i,
  }));
}

/**
 * Check if a section type is required (cannot be deselected).
 *
 * @param type - Section type to check
 * @returns true if section is required
 */
export function isSectionRequired(type: ReportSectionType): boolean {
  const meta = getSectionMeta(type);
  return meta?.required === true;
}
