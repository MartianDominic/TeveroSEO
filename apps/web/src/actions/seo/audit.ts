"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
import { auditLimiter, checkRateLimit } from "@/lib/rate-limit";
import { generateAuditIdempotencyKey } from "@/lib/utils/idempotency";

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
export async function startAudit(params: StartAuditParams): Promise<ActionResult<{ auditId: string }>> {
  const parseResult = startAuditParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid audit parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: 5 audits per hour (crawling up to 10K pages is expensive)
    await checkRateLimit(auditLimiter, auth.userId);

    // DB-H08 FIX: Generate idempotency key to prevent duplicate audit starts
    const idempotencyKey = generateAuditIdempotencyKey('start', {
      clientId: validated.clientId,
      projectId: validated.projectId,
      startUrl: validated.startUrl,
    });

    const query = buildQuery(validated);
    const data = await postOpenSeo<{ auditId: string }>(`/api/seo/audits?${query}`, {
      action: "start",
      startUrl: validated.startUrl,
      maxPages: validated.maxPages,
      lighthouseStrategy: validated.lighthouseStrategy,
      idempotencyKey, // Backend should use this to deduplicate
    });
    return { success: true, data };
  } catch (error) {
    console.error("[startAudit] Failed to start audit:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to start audit" };
  }
}

/** Audit status response type */
interface AuditStatusResponse {
  status: string;
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseTotal: number;
  lighthouseCompleted: number;
  lighthouseFailed: number;
  currentPhase: string | null;
  startUrl: string;
  startedAt: string;
}

/**
 * Get the status of an audit.
 */
export async function getAuditStatus(params: AuditIdParams): Promise<ActionResult<AuditStatusResponse>> {
  const parseResult = auditIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated, { audit_id: validated.auditId, action: "status" });
    const data = await getOpenSeo<AuditStatusResponse>(`/api/seo/audits?${query}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getAuditStatus] Failed:", error);
    return { success: false, error: "Failed to fetch audit status" };
  }
}

/** Audit results response type */
interface AuditResultsResponse {
  auditId: string;
  projectId: string;
  status: string;
  score: number;
  pageCount: number;
  issueCount: number;
  findings: Array<{
    checkId: string;
    tier: number;
    category: string;
    passed: boolean;
    severity: string;
    message: string;
  }>;
  completedAt: string | null;
}

/**
 * Get the results of a completed audit.
 */
export async function getAuditResults(params: AuditIdParams): Promise<ActionResult<AuditResultsResponse>> {
  const parseResult = auditIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated, { audit_id: validated.auditId, action: "results" });
    const data = await getOpenSeo<AuditResultsResponse>(`/api/seo/audits?${query}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getAuditResults] Failed:", error);
    return { success: false, error: "Failed to fetch audit results" };
  }
}

/** Audit history item type */
interface AuditHistoryItem {
  id: string;
  projectId: string;
  status: string;
  score: number | null;
  pageCount: number;
  pagesCrawled: number;
  startUrl: string;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Get audit history for a project.
 */
export async function getAuditHistory(params: AuditParams): Promise<ActionResult<AuditHistoryItem[]>> {
  const parseResult = auditParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated);
    const data = await getOpenSeo<AuditHistoryItem[]>(`/api/seo/audits?${query}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getAuditHistory] Failed:", error);
    return { success: false, error: "Failed to fetch audit history" };
  }
}

/** Crawl progress item type */
interface CrawlProgressItem {
  url: string;
  statusCode: number | null;
  title: string | null;
  crawledAt: number;
}

/**
 * Get crawl progress for an in-progress audit.
 */
export async function getCrawlProgress(params: AuditIdParams): Promise<ActionResult<CrawlProgressItem[]>> {
  const parseResult = auditIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated, { audit_id: validated.auditId, action: "progress" });
    const data = await getOpenSeo<CrawlProgressItem[]>(`/api/seo/audits?${query}`);
    return { success: true, data };
  } catch (error) {
    console.error("[getCrawlProgress] Failed:", error);
    return { success: false, error: "Failed to fetch crawl progress" };
  }
}

/**
 * Delete an audit.
 */
export async function deleteAudit(params: AuditIdParams): Promise<ActionResult<{ success: boolean }>> {
  const parseResult = auditIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated);
    const data = await postOpenSeo<{ success: boolean }>(`/api/seo/audits?${query}`, {
      action: "delete",
      auditId: validated.auditId,
    });
    return { success: true, data };
  } catch (error) {
    console.error("[deleteAudit] Failed:", error);
    return { success: false, error: "Failed to delete audit" };
  }
}
