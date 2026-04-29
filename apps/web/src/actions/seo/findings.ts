"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { getOpenSeo } from "@/lib/server-fetch";
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";
import type { ScoreResult } from "@/lib/audit/checks/types";

// Validation schemas
const findingsParamsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  clientId: z.string().uuid("Invalid client ID format"),
  auditId: z.string().uuid("Invalid audit ID format"),
});

const pageFindingsParamsSchema = findingsParamsSchema.extend({
  pageId: z.string().uuid("Invalid page ID format"),
});

interface FindingsParams {
  projectId: string;
  clientId: string;
  auditId: string;
}

interface PageFindingsParams extends FindingsParams {
  pageId: string;
}

export interface AuditFinding {
  id: string;
  auditId: string;
  pageId: string;
  checkId: string;
  tier: number;
  category: string;
  passed: boolean;
  severity: string;
  message: string;
  details: Record<string, unknown> | null;
  autoEditable: boolean;
  editRecipe: string | null;
  createdAt: string;
}

export interface PageFindingsResponse {
  findings: AuditFinding[];
  score: ScoreResult;
  pageUrl: string;
}

/**
 * Build query string with client_id, project_id, and audit_id.
 */
function buildQuery(
  params: FindingsParams,
  extra?: Record<string, string>
): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    project_id: params.projectId,
    audit_id: params.auditId,
    ...extra,
  });
  return query.toString();
}

/**
 * Get findings for a specific page in an audit.
 */
export async function getPageFindings(
  params: PageFindingsParams
): Promise<ActionResult<PageFindingsResponse>> {
  const parseResult = pageFindingsParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated, {
      page_id: validated.pageId,
      action: "page-findings",
    });
    const data = await getOpenSeo<PageFindingsResponse>(`/api/seo/audits?${query}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getPageFindings] Failed:", error);
    return { success: false, error: "Failed to fetch page findings" };
  }
}

/**
 * Get all findings for an audit (for export).
 */
export async function getAuditFindings(
  params: FindingsParams
): Promise<ActionResult<{ findings: AuditFinding[] }>> {
  const parseResult = findingsParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated, { action: "all-findings" });
    const data = await getOpenSeo<{ findings: AuditFinding[] }>(`/api/seo/audits?${query}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getAuditFindings] Failed:", error);
    return { success: false, error: "Failed to fetch audit findings" };
  }
}

/**
 * Export findings as CSV.
 * Returns CSV string for client-side download.
 * Rate limited: 30 exports per minute.
 */
export async function exportFindingsCSV(
  params: FindingsParams
): Promise<ActionResult<string>> {
  const parseResult = findingsParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    // Rate limit export operations (auth is checked in getAuditFindings)
    const auth = await requireActionAuth();
    await checkActionRateLimit("export", auth.userId);

    // Auth is checked again in getAuditFindings but we need it for rate limiting
    const result = await getAuditFindings(validated);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const { findings } = result.data;

    // Build CSV header
    const headers = [
      "Check ID",
      "Tier",
      "Category",
      "Severity",
      "Passed",
      "Message",
      "Auto-Fixable",
      "Page ID",
    ];

    // Build CSV rows
    const rows = findings.map((f) => [
      f.checkId,
      f.tier.toString(),
      f.category,
      f.severity,
      f.passed ? "Yes" : "No",
      `"${f.message.replace(/"/g, '""')}"`,
      f.autoEditable ? "Yes" : "No",
      f.pageId,
    ]);

    // Combine header and rows
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return { success: true, data: csv };
  } catch (error) {
    console.error("[exportFindingsCSV] Failed:", error);
    return { success: false, error: "Failed to export findings" };
  }
}
