"use server";

import { z } from "zod";
import { logger } from '@/lib/logger';
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
    logger.error("[startAudit] Failed to start audit", error instanceof Error ? error : { error: String(error) });
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
    logger.error("[getAuditStatus] Failed", error instanceof Error ? error : { error: String(error) });
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

/** PERF FIX (HIGH-04): Paginated audit results response type */
interface PaginatedAuditResultsResponse extends Omit<AuditResultsResponse, 'findings'> {
  findings: Array<{
    checkId: string;
    tier: number;
    category: string;
    passed: boolean;
    severity: string;
    message: string;
  }>;
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    totalFindings: number;
    limit: number;
  };
}

/** Pagination params for audit results */
const paginatedAuditResultsSchema = auditIdParamsSchema.extend({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  severity: z.enum(["critical", "warning", "info"]).optional(),
  category: z.string().optional(),
});

type PaginatedAuditResultsParams = z.infer<typeof paginatedAuditResultsSchema>;

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
    logger.error("[getAuditResults] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to fetch audit results" };
  }
}

/**
 * PERF FIX (HIGH-04): Get paginated audit results with cursor-based pagination.
 * Default limit is 50 items per page to prevent large response payloads.
 *
 * @param params - Audit ID params plus optional pagination/filter params
 * @returns Paginated findings with cursor for next page
 */
export async function getAuditResultsPaginated(
  params: PaginatedAuditResultsParams
): Promise<ActionResult<PaginatedAuditResultsResponse>> {
  const parseResult = paginatedAuditResultsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Build query with pagination params
    const queryParams: Record<string, string> = {
      audit_id: validated.auditId,
      action: "results_paginated",
      limit: String(validated.limit),
    };

    if (validated.cursor) {
      queryParams.cursor = validated.cursor;
    }
    if (validated.severity) {
      queryParams.severity = validated.severity;
    }
    if (validated.category) {
      queryParams.category = validated.category;
    }

    const query = buildQuery(validated, queryParams);

    // Try paginated endpoint first
    try {
      const data = await getOpenSeo<PaginatedAuditResultsResponse>(`/api/seo/audits?${query}`);
      return { success: true, data };
    } catch {
      // Fallback: If paginated endpoint not available, fetch all and paginate in-memory
      const fullQuery = buildQuery(validated, { audit_id: validated.auditId, action: "results" });
      const fullData = await getOpenSeo<AuditResultsResponse>(`/api/seo/audits?${fullQuery}`);

      // Apply client-side pagination
      let findings = fullData.findings;

      // Apply filters
      if (validated.severity) {
        findings = findings.filter((f) => f.severity === validated.severity);
      }
      if (validated.category) {
        findings = findings.filter((f) => f.category === validated.category);
      }

      // Apply cursor-based pagination (using index as cursor for simplicity)
      const startIndex = validated.cursor ? parseInt(validated.cursor, 10) : 0;
      const paginatedFindings = findings.slice(startIndex, startIndex + validated.limit);
      const hasMore = startIndex + validated.limit < findings.length;
      const nextCursor = hasMore ? String(startIndex + validated.limit) : null;

      return {
        success: true,
        data: {
          auditId: fullData.auditId,
          projectId: fullData.projectId,
          status: fullData.status,
          score: fullData.score,
          pageCount: fullData.pageCount,
          issueCount: fullData.issueCount,
          findings: paginatedFindings,
          completedAt: fullData.completedAt,
          pagination: {
            cursor: nextCursor,
            hasMore,
            totalFindings: findings.length,
            limit: validated.limit,
          },
        },
      };
    }
  } catch (error) {
    logger.error("[getAuditResultsPaginated] Failed", error instanceof Error ? error : { error: String(error) });
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
    logger.error("[getAuditHistory] Failed", error instanceof Error ? error : { error: String(error) });
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
    logger.error("[getCrawlProgress] Failed", error instanceof Error ? error : { error: String(error) });
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
    logger.error("[deleteAudit] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to delete audit" };
  }
}

/**
 * HIGH-13-01: Cancel a running audit.
 */
export async function cancelAudit(params: AuditIdParams): Promise<ActionResult<{ success: boolean }>> {
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
      action: "cancel",
      auditId: validated.auditId,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[cancelAudit] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to cancel audit" };
  }
}

/**
 * HIGH-13-01: Retry a failed audit.
 */
export async function retryAudit(params: AuditIdParams): Promise<ActionResult<{ auditId: string }>> {
  const parseResult = auditIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit retries same as new audits
    await checkRateLimit(auditLimiter, auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo<{ auditId: string }>(`/api/seo/audits?${query}`, {
      action: "retry",
      auditId: validated.auditId,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[retryAudit] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to retry audit" };
  }
}
