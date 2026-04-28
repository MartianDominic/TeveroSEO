/**
 * Prospect Report PDF API Route.
 * Phase 30-05: Analysis PDF Export
 *
 * GET /api/prospects/:prospectId/report - Download analysis report as PDF
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProspectPdfService } from "@/server/services/prospect-report";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/prospects/:id/report" });

export const Route = createFileRoute("/api/prospects/$prospectId/report")({
  server: {
    handlers: {
      /**
       * GET /api/prospects/:prospectId/report
       *
       * Download prospect analysis report as PDF.
       * Optionally specify analysisId query param for a specific analysis.
       *
       * @query analysisId - Optional. If not provided, uses latest completed analysis.
       * @returns PDF binary with correct headers
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { prospectId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { prospectId } = params;

          // Extract optional analysisId from query string
          const url = new URL(request.url);
          const analysisId = url.searchParams.get("analysisId") ?? undefined;

          log.info("Generating prospect report PDF", { prospectId, analysisId });

          // Generate PDF
          const result = await ProspectPdfService.generateProspectPDF(
            prospectId,
            analysisId,
          );

          // Return PDF with proper headers
          return new Response(new Uint8Array(result.buffer), {
            status: 200,
            headers: {
              "Content-Type": result.contentType,
              "Content-Disposition": `attachment; filename="${result.filename}"`,
              "Content-Length": String(result.buffer.length),
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        } catch (err) {
          if (err instanceof AppError) {
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
              VALIDATION_ERROR: 400,
            };
            const status = statusMap[err.code] ?? 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Prospect report generation failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
