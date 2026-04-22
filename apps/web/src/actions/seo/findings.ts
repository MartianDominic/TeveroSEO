"use server";

import { getOpenSeo } from "@/lib/server-fetch";
import type { ScoreResult } from "@/lib/audit/checks/types";

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
  const query = buildQuery(params, {
    page_id: params.pageId,
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
  const query = buildQuery(params, { action: "all-findings" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Export findings as CSV.
 * Returns CSV string for client-side download.
 */
export async function exportFindingsCSV(
  params: FindingsParams
): Promise<string> {
  const { findings } = await getAuditFindings(params);

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
