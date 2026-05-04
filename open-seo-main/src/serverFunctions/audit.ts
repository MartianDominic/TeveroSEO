import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { captureServerEvent } from "@/server/lib/posthog";
import { requireProjectContext, requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import { db } from "@/db";
import { auditPages, audits, auditFindings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { CheckResult, CheckSeverity } from "@/server/lib/audit/checks/types";
import type { AuditFindingSelect } from "@/db/dashboard-schema";
import {
  cancelAuditSchema,
  deleteAuditSchema,
  getAuditHistorySchema,
  getAuditResultsSchema,
  getAuditStatusSchema,
  getCrawlProgressSchema,
  retryAuditSchema,
  startAuditSchema,
} from "@/types/schemas/audit";

const log = createLogger({ module: "serverFunctions/audit" });

export const startAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => startAuditSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await AuditService.startAudit({
      actorUserId: context.userId,
      billingCustomer: {
        organizationId: context.organizationId,
        userEmail: context.userEmail,
        userId: context.userId,
      },
      projectId: context.projectId,
      startUrl: data.startUrl,
      maxPages: data.maxPages,
      lighthouseStrategy: data.lighthouseStrategy,
      clientId: context.clientId,
    });

    void captureServerEvent({
      distinctId: context.userId,
      event: "site_audit:start",
      organizationId: context.organizationId,
      properties: {
        project_id: context.projectId,
        max_pages: data.maxPages ?? 50,
        run_lighthouse: data.lighthouseStrategy !== "none",
      },
    }).catch((err) => {
      log.error("PostHog captureServerEvent failed", err instanceof Error ? err : new Error(String(err)));
    });

    return result;
  });

export const getAuditStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getAuditStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AuditService.getStatus(data.auditId, context.projectId);
  });

export const getAuditResults = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getAuditResultsSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AuditService.getResults(data.auditId, context.projectId);
  });

export const getAuditHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getAuditHistorySchema.parse(data))
  .handler(async ({ data, context }) => {
    // AUTH-03 mismatch guard: a caller cannot ask for one client's data
    // while presenting a different client_id in the header.
    if (data.clientId && context.clientId && data.clientId !== context.clientId) {
      throw new AppError("FORBIDDEN", "clientId mismatch between query and X-Client-ID header");
    }
    // Prefer the query-supplied clientId, fall back to the header-resolved one.
    const effectiveClientId = data.clientId ?? context.clientId ?? null;
    return AuditService.getHistory(context.projectId, { clientId: effectiveClientId });
  });

export const getCrawlProgress = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getCrawlProgressSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AuditService.getCrawlProgress(data.auditId, context.projectId);
  });

export const deleteAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => deleteAuditSchema.parse(data))
  .handler(async ({ data, context }) => {
    await AuditService.remove(data.auditId, context.projectId);
    return { success: true };
  });

/**
 * H-AUDIT-01: Cancel a running audit.
 * Provides user-visible cancellation for stuck audits.
 */
export const cancelAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => cancelAuditSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await AuditService.cancelAudit(data.auditId, context.projectId);

    void captureServerEvent({
      distinctId: context.userId,
      event: "site_audit:cancel",
      organizationId: context.organizationId,
      properties: {
        project_id: context.projectId,
        audit_id: data.auditId,
      },
    }).catch((err) => {
      log.error("PostHog captureServerEvent failed", err instanceof Error ? err : new Error(String(err)));
    });

    return result;
  });

/**
 * M-AUDIT-02: Retry a failed audit.
 * Provides retry UI for failed audits.
 */
export const retryAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => retryAuditSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await AuditService.retryAudit(
      data.auditId,
      context.projectId,
      {
        organizationId: context.organizationId,
        userEmail: context.userEmail,
        userId: context.userId,
      },
    );

    void captureServerEvent({
      distinctId: context.userId,
      event: "site_audit:retry",
      organizationId: context.organizationId,
      properties: {
        project_id: context.projectId,
        audit_id: data.auditId,
      },
    }).catch((err) => {
      log.error("PostHog captureServerEvent failed", err instanceof Error ? err : new Error(String(err)));
    });

    return result;
  });

/**
 * FIX C13: Server function for page findings.
 * Replaces direct unauthenticated fetch() in route loaders.
 * Uses authenticated server function pattern with proper auth headers.
 */
const getPageFindingsSchema = z.object({
  pageId: z.string().uuid(),
  limit: z.number().min(1).max(200).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

/** Serializable primitive types for TanStack Start serialization */
type SerializablePrimitive = string | number | boolean | null;
type SerializableValue = SerializablePrimitive | SerializableValue[] | { [key: string]: SerializableValue };
type SerializableRecord = Record<string, SerializableValue>;

export interface Finding {
  id: string;
  checkId: string;
  tier: number;
  category: string;
  passed: boolean;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  details?: SerializableRecord;
  autoEditable: boolean;
  editRecipe?: string;
}

export interface FindingsResponse {
  score: number | null;
  breakdown: { base: number; tier1: number; tier2: number; tier3: number } | null;
  gates: string[];
  findings: Finding[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  message?: string;
}

/**
 * Get the client ID for a page by traversing page -> audit -> client
 */
async function getClientIdForPage(pageId: string): Promise<string | null> {
  const result = await db
    .select({ clientId: audits.clientId })
    .from(auditPages)
    .innerJoin(audits, eq(auditPages.auditId, audits.id))
    .where(eq(auditPages.id, pageId))
    .limit(1);

  return result[0]?.clientId ?? null;
}

export const getPageFindings = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => getPageFindingsSchema.parse(data))
  .handler(async ({ data, context }): Promise<FindingsResponse> => {
    const { pageId, limit, offset } = data;

    // Validate page exists and get associated client
    const clientId = await getClientIdForPage(pageId);
    if (!clientId) {
      throw new AppError("NOT_FOUND", "Page not found");
    }

    // Validate client ownership - context.clientId is set by middleware
    // If the page's client doesn't match the authenticated context, deny access
    if (context.clientId && context.clientId !== clientId) {
      throw new AppError("FORBIDDEN", "Access denied to this page");
    }

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditFindings)
      .where(eq(auditFindings.pageId, pageId));
    const total = countResult?.count ?? 0;

    const findings = await FindingsRepository.getFindingsByPage(pageId, undefined, { limit, offset });

    if (findings.length === 0 && offset === 0) {
      return {
        score: null,
        breakdown: null,
        gates: [],
        findings: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
        message: "No findings for this page",
      };
    }

    const checkResults: CheckResult[] = findings.map((f: AuditFindingSelect) => ({
      checkId: f.checkId,
      passed: f.passed,
      severity: f.severity as CheckSeverity,
      message: f.message,
      details: (f.details ?? undefined) as Record<string, unknown> | undefined,
      autoEditable: f.autoEditable,
      editRecipe: f.editRecipe ?? undefined,
    }));

    const scoreResult = calculateOnPageScore(checkResults);

    return {
      score: scoreResult.score,
      breakdown: scoreResult.breakdown,
      gates: scoreResult.gates,
      findings: findings.map((f: AuditFindingSelect) => ({
        id: f.id,
        checkId: f.checkId,
        tier: f.tier,
        category: f.category,
        passed: f.passed,
        severity: f.severity as "critical" | "high" | "medium" | "low",
        message: f.message,
        details: (f.details ?? undefined) as SerializableRecord | undefined,
        autoEditable: f.autoEditable,
        editRecipe: f.editRecipe ?? undefined,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + findings.length < total,
      },
    };
  });
