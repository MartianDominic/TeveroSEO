"use server";

/**
 * Server actions for report template CRUD operations.
 * Phase 53: Templates for saving/loading report configurations.
 */

import { requireActionAuth, type ActionResult } from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { getOpenSeo, postOpenSeo, putOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";

import type { ReportSection } from "@tevero/types";

/**
 * Report template response from API.
 */
export interface ReportTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  sections: ReportSection[];
  locale: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * List report templates for current workspace.
 */
export async function getReportTemplates(): Promise<
  ActionResult<ReportTemplateResponse[]>
> {
  try {
    await requireActionAuth();
    const data = await getOpenSeo<{ templates: ReportTemplateResponse[] }>(
      "/api/report-templates",
    );
    return { success: true, data: data.templates };
  } catch (error) {
    logger.error("[getReportTemplates] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load templates",
    };
  }
}

/**
 * Create a new report template.
 */
export async function createReportTemplate(template: {
  name: string;
  description?: string;
  sections: ReportSection[];
  locale?: string;
  isDefault?: boolean;
}): Promise<ActionResult<ReportTemplateResponse>> {
  try {
    await requireActionAuth();
    const data = await postOpenSeo<ReportTemplateResponse>(
      "/api/report-templates",
      template,
    );
    return { success: true, data };
  } catch (error) {
    logger.error("[createReportTemplate] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create template",
    };
  }
}

/**
 * Update an existing report template.
 */
export async function updateReportTemplate(
  templateId: string,
  updates: {
    name?: string;
    description?: string | null;
    sections?: ReportSection[];
    locale?: string;
    isDefault?: boolean;
  },
): Promise<ActionResult<ReportTemplateResponse>> {
  try {
    await requireActionAuth();
    const data = await putOpenSeo<ReportTemplateResponse>(
      `/api/report-templates/${templateId}`,
      updates,
    );
    return { success: true, data };
  } catch (error) {
    logger.error("[updateReportTemplate] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update template",
    };
  }
}

/**
 * Delete a report template.
 */
export async function deleteReportTemplate(
  templateId: string,
): Promise<ActionResult<void>> {
  try {
    await requireActionAuth();
    await deleteOpenSeo(`/api/report-templates/${templateId}`);
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("[deleteReportTemplate] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete template",
    };
  }
}
