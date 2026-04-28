/**
 * Report detail API routes.
 * Phase 15: Get report metadata by ID.
 *
 * GET /api/reports/:id - Get report metadata
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";

const log = createLogger({ module: "api/reports/:id" });

export const Route = createFileRoute("/api/reports/$id")({
  server: {
    handlers: {
      // GET /api/reports/:id - Get report metadata
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { id } = params;
          const [report] = await db
            .select()
            .from(reports)
            .where(eq(reports.id, id))
            .limit(1);

          if (!report) {
            return Response.json({ error: "Report not found" }, { status: 404 });
          }

          // SECURITY: Validate user has access to this report's client (CRITICAL-AUTH-003 fix)
          await requireClientAccess(authContext.userId, report.clientId);

          return Response.json({
            id: report.id,
            clientId: report.clientId,
            clientName: "", // TODO: Fetch from AI-Writer clients table
            reportType: report.reportType,
            dateRange: {
              start: report.dateRangeStart,
              end: report.dateRangeEnd,
            },
            locale: report.locale,
            contentHash: report.contentHash,
            status: report.status,
            pdfPath: report.pdfPath,
            errorMessage: report.errorMessage,
            generatedAt: report.generatedAt?.toISOString(),
            createdAt: report.createdAt.toISOString(),
          });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Get report failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
