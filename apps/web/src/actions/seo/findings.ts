"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo } from "@/lib/server-fetch";
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
): Promise<PageFindingsResponse> {
  const validated = pageFindingsParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated, {
    page_id: validated.pageId,
    action: "page-findings",
  });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Get all findings for an audit (for export).
 */
export async function getAuditFindings(
  params: FindingsParams
): Promise<{ findings: AuditFinding[] }> {
  const validated = findingsParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated, { action: "all-findings" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Export findings as CSV.
 * Returns CSV string for client-side download.
 */
export async function exportFindingsCSV(
  params: FindingsParams
): Promise<string> {
  // Validation is done in getAuditFindings, but validate here for early failure
  const validated = findingsParamsSchema.parse(params);
  // Auth is checked in getAuditFindings
  const { findings } = await getAuditFindings(validated);

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

  return csv;
}
