"use server";

import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
import type { ReportMetadata } from "@tevero/types";

/**
 * Generate a new report.
 *
 * @param clientId - Client UUID
 * @param options - Report options (type, date range, locale)
 * @returns reportId for tracking generation progress
 */
export async function generateReport(
  clientId: string,
  options?: {
    reportType?: string;
    dateRange?: { start: string; end: string };
    locale?: string;
  },
): Promise<{ reportId: string }> {
  return postOpenSeo<{ reportId: string }>("/api/reports/generate", {
    clientId,
    ...options,
  });
}

/**
 * Get report status and metadata.
 *
 * @param reportId - Report UUID
 * @returns Report metadata including status
 */
export async function getReportStatus(
  reportId: string,
): Promise<ReportMetadata> {
  return getOpenSeo<ReportMetadata>(`/api/reports/${reportId}`);
}

/**
 * List reports for a client.
 *
 * @param clientId - Client UUID
 * @returns Array of report metadata
 */
export async function listClientReports(
  clientId: string,
): Promise<ReportMetadata[]> {
  return getOpenSeo<ReportMetadata[]>(`/api/clients/${clientId}/reports`);
}

/**
 * Get download URL for a report.
 *
 * @param reportId - Report UUID
 * @returns URL to download the PDF
 */
export function getReportDownloadUrl(reportId: string): string {
  return `/api/reports/${reportId}/download`;
}
