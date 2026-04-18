"use server";

import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";

interface AuditParams {
  projectId: string;
  clientId: string;
}

interface StartAuditParams extends AuditParams {
  startUrl: string;
  maxPages?: number;
  lighthouseStrategy?: string;
}

interface AuditIdParams extends AuditParams {
  auditId: string;
}

/**
 * Build query string with client_id and project_id.
 * Phase 10 uses query param fallback (Phase 11 adds Clerk JWT).
 */
function buildQuery(params: AuditParams, extra?: Record<string, string>): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    project_id: params.projectId,
    ...extra,
  });
  return query.toString();
}

/**
 * Start a new site audit.
 */
export async function startAudit(params: StartAuditParams): Promise<{ auditId: string }> {
  const query = buildQuery(params);
  return postOpenSeo<{ auditId: string }>(`/api/seo/audits?${query}`, {
    action: "start",
    startUrl: params.startUrl,
    maxPages: params.maxPages,
    lighthouseStrategy: params.lighthouseStrategy,
  });
}

/**
 * Get the status of an audit.
 */
export async function getAuditStatus(params: AuditIdParams): Promise<{
  status: string;
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseTotal: number;
  lighthouseCompleted: number;
  lighthouseFailed: number;
  currentPhase: string | null;
  startUrl: string;
  startedAt: string;
}> {
  const query = buildQuery(params, { audit_id: params.auditId, action: "status" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Get the results of a completed audit.
 */
export async function getAuditResults(params: AuditIdParams): Promise<unknown> {
  const query = buildQuery(params, { audit_id: params.auditId, action: "results" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Get audit history for a project.
 */
export async function getAuditHistory(params: AuditParams): Promise<unknown> {
  const query = buildQuery(params);
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Get crawl progress for an in-progress audit.
 */
export async function getCrawlProgress(params: AuditIdParams): Promise<
  Array<{
    url: string;
    statusCode: number | null;
    title: string | null;
    crawledAt: number;
  }>
> {
  const query = buildQuery(params, { audit_id: params.auditId, action: "progress" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Delete an audit.
 */
export async function deleteAudit(params: AuditIdParams): Promise<{ success: boolean }> {
  const query = buildQuery(params);
  return postOpenSeo<{ success: boolean }>(`/api/seo/audits?${query}`, {
    action: "delete",
    auditId: params.auditId,
  });
}
