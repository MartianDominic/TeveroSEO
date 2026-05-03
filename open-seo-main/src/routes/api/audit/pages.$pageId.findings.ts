/**
 * Findings API Route for Audit Page.
 * Phase 32: 107 SEO Checks - Wire Findings to Audit Route
 *
 * GET /api/audit/pages/:pageId/findings
 * Returns: { score, breakdown, gates, findings, pagination }
 *
 * Security: Requires authentication. Page ownership validated via audit->client chain.
 *
 * HIGH-API-04 FIX: Added pagination support with reasonable defaults.
 * HIGH-API-05 FIX: 422 for validation errors.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { db } from "@/db";
import { auditPages, audits, auditFindings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { CheckResult, CheckSeverity } from "@/server/lib/audit/checks/types";
import type { AuditFindingSelect } from "@/db/dashboard-schema";
import { errorResponse, PaginationRequestSchema } from "@/shared/api-schemas";

const log = createLogger({ module: "api/audit/pages/findings" });

/**
 * HIGH-API-04 FIX: Pagination defaults for findings endpoint.
 */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

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

export const Route = createFileRoute("/api/audit/pages/$pageId/findings")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { pageId: string };
      }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          const { pageId } = params;

          // HIGH-API-04 FIX: Parse pagination parameters
          const url = new URL(request.url);
          const limitParam = url.searchParams.get("limit");
          const offsetParam = url.searchParams.get("offset");

          const limit = Math.min(
            Math.max(1, parseInt(limitParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
            MAX_PAGE_SIZE
          );
          const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

          // 2. Get the clientId for this page and validate ownership (HIGH-AUTH-01 fix)
          const clientId = await getClientIdForPage(pageId);
          if (!clientId) {
            // Page not found or not associated with any audit/client
            return errorResponse("NOT_FOUND", "Page not found");
          }

          // Validate client ownership
          const headers = new Headers(request.headers);
          headers.set("x-client-id", clientId);
          await resolveClientId(headers, request.url);

          // HIGH-API-04 FIX: Get total count for pagination metadata
          const [countResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(auditFindings)
            .where(eq(auditFindings.pageId, pageId));
          const total = countResult?.count ?? 0;

          const findings = await FindingsRepository.getFindingsByPage(pageId, undefined, { limit, offset });

          if (findings.length === 0 && offset === 0) {
            return Response.json({
              success: true,
              data: {
                score: null,
                breakdown: null,
                gates: [],
                findings: [],
              },
              pagination: {
                total: 0,
                limit,
                offset,
                hasMore: false,
              },
              message: "No findings for this page",
            });
          }

          const checkResults: CheckResult[] = findings.map((f: AuditFindingSelect) => ({
            checkId: f.checkId,
            passed: f.passed,
            severity: f.severity as CheckSeverity,
            message: f.message,
            details: f.details as Record<string, unknown> | undefined,
            autoEditable: f.autoEditable,
            editRecipe: typeof f.editRecipe === "string" ? f.editRecipe : undefined,
          }));

          const scoreResult = calculateOnPageScore(checkResults);

          return Response.json({
            success: true,
            data: {
              score: scoreResult.score,
              breakdown: scoreResult.breakdown,
              gates: scoreResult.gates,
              findings: findings.map((f: AuditFindingSelect) => ({
                id: f.id,
                checkId: f.checkId,
                tier: f.tier,
                category: f.category,
                passed: f.passed,
                severity: f.severity,
                message: f.message,
                details: f.details,
                autoEditable: f.autoEditable,
                editRecipe: f.editRecipe,
              })),
            },
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + findings.length < total,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            return errorResponse(error.code, error.message);
          }
          log.error(
            "Failed to fetch findings",
            error instanceof Error ? error : new Error(String(error))
          );
          return errorResponse("INTERNAL_ERROR", "Failed to fetch findings");
        }
      },
    },
  },
});
