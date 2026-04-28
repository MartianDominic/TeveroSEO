/**
 * Client reports API route.
 * Phase 15: List reports for a client.
 *
 * GET /api/clients/:clientId/reports - List client reports
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/clients/:clientId/reports" });

export const Route = createFileRoute("/api/clients/$clientId/reports")({
  server: {
    handlers: {
      // GET /api/clients/:clientId/reports - List client reports
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { clientId } = params;
          const clientReports = await db
            .select()
            .from(reports)
            .where(eq(reports.clientId, clientId))
            .orderBy(desc(reports.createdAt))
            .limit(50);

          return Response.json(
            clientReports.map((r) => ({
              id: r.id,
              clientId: r.clientId,
              clientName: "", // TODO: Fetch from AI-Writer clients table
              reportType: r.reportType,
              dateRange: { start: r.dateRangeStart, end: r.dateRangeEnd },
              locale: r.locale,
              status: r.status,
              contentHash: r.contentHash,
              generatedAt: r.generatedAt?.toISOString() ?? "",
              createdAt: r.createdAt.toISOString(),
            })),
          );
        } catch (err) {
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
            "List reports failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
