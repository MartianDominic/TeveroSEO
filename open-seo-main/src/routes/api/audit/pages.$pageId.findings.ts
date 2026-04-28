/**
 * Findings API Route for Audit Page.
 * Phase 32: 107 SEO Checks - Wire Findings to Audit Route
 *
 * GET /api/audit/pages/:pageId/findings
 * Returns: { score, breakdown, gates, findings }
 *
 * Security: Requires authentication. Page ownership validated via audit->client chain.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { db } from "@/db";
import { auditPages, audits } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { CheckResult, CheckSeverity } from "@/server/lib/audit/checks/types";
import type { AuditFindingSelect } from "@/db/dashboard-schema";

const log = createLogger({ module: "api/audit/pages/findings" });

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

          // 2. Get the clientId for this page and validate ownership
          const clientId = await getClientIdForPage(pageId);
          if (clientId) {
            const headers = new Headers(request.headers);
            headers.set("x-client-id", clientId);
            await resolveClientId(headers, request.url);
          }

          const findings = await FindingsRepository.getFindingsByPage(pageId);

          if (findings.length === 0) {
            return Response.json({
              score: null,
              breakdown: null,
              gates: [],
              findings: [],
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
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Failed to fetch findings",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
