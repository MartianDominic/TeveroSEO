"use server";

import { requireActionAuth, validateClientOwnership, type ActionResult } from "@/lib/auth/action-auth";
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
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(clientId, auth);

    const data = await postOpenSeo<{ reportId: string }>("/api/reports/generate", {
      clientId,
      ...options,
    });
    return { success: true, data };
  } catch (error) {
    console.error("[generateReport] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate report",
    };
  }
}

/**
 * Get report status and metadata.
 *
 * @param reportId - Report UUID
 * @param clientId - Client UUID (required for ownership validation)
 * @returns Report metadata including status
 */
export async function getReportStatus(
  reportId: string,
  clientId: string,
): Promise<ActionResult<ReportMetadata>> {
  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(clientId, auth);

    const data = await getOpenSeo<ReportMetadata>(`/api/reports/${reportId}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getReportStatus] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get report status",
    };
  }
}

/**
 * List reports for a client.
 *
 * @param clientId - Client UUID
 * @returns Array of report metadata
 */
export async function listClientReports(
  clientId: string,
): Promise<ActionResult<ReportMetadata[]>> {
  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(clientId, auth);

    const data = await getOpenSeo<ReportMetadata[]>(`/api/clients/${clientId}/reports`);
    return { success: true, data };
  } catch (error) {
    console.error("[listClientReports] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list reports",
    };
  }
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
