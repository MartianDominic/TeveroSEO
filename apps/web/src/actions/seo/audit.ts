"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
import { auditLimiter, checkRateLimit } from "@/lib/rate-limit";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID format");
const projectIdSchema = z.string().uuid("Invalid project ID format");
const auditIdSchema = z.string().uuid("Invalid audit ID format");

const auditParamsSchema = z.object({
  projectId: projectIdSchema,
  clientId: clientIdSchema,
});

const startAuditParamsSchema = auditParamsSchema.extend({
  startUrl: z.string().url("Invalid start URL format"),
  maxPages: z.number().int().min(1, "Must crawl at least 1 page").max(10000, "Maximum 10000 pages").optional(),
  lighthouseStrategy: z.enum(["mobile", "desktop"]).optional(),
});

const auditIdParamsSchema = auditParamsSchema.extend({
  auditId: auditIdSchema,
});

// Type inference from Zod schemas
type AuditParams = z.infer<typeof auditParamsSchema>;
type StartAuditParams = z.infer<typeof startAuditParamsSchema>;
type AuditIdParams = z.infer<typeof auditIdParamsSchema>;

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
export async function startAudit(params: StartAuditParams): Promise<{ auditId: string } | { error: string }> {
  try {
    const validated = startAuditParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: 5 audits per hour (crawling up to 10K pages is expensive)
    await checkRateLimit(auditLimiter, auth.userId);

    const query = buildQuery(validated);
    return await postOpenSeo<{ auditId: string }>(`/api/seo/audits?${query}`, {
      action: "start",
      startUrl: validated.startUrl,
      maxPages: validated.maxPages,
      lighthouseStrategy: validated.lighthouseStrategy,
    });
  } catch (error) {
    console.error("[startAudit] Failed to start audit:", error);
    return { error: error instanceof Error ? error.message : "Failed to start audit" };
  }
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
  const validated = auditIdParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated, { audit_id: validated.auditId, action: "status" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Get the results of a completed audit.
 */
export async function getAuditResults(params: AuditIdParams): Promise<unknown> {
  const validated = auditIdParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated, { audit_id: validated.auditId, action: "results" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Get audit history for a project.
 */
export async function getAuditHistory(params: AuditParams): Promise<unknown> {
  const validated = auditParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
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
  const validated = auditIdParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated, { audit_id: validated.auditId, action: "progress" });
  return getOpenSeo(`/api/seo/audits?${query}`);
}

/**
 * Delete an audit.
 */
export async function deleteAudit(params: AuditIdParams): Promise<{ success: boolean }> {
  const validated = auditIdParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return postOpenSeo<{ success: boolean }>(`/api/seo/audits?${query}`, {
    action: "delete",
    auditId: validated.auditId,
  });
}
