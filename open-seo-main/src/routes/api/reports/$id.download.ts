/**
 * Report download API route.
 * Phase 15: Download report PDF.
 *
 * GET /api/reports/:id/download - Download PDF file
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";

const log = createLogger({ module: "api/reports/:id/download" });

export const Route = createFileRoute("/api/reports/$id/download")({
  server: {
    handlers: {
      // GET /api/reports/:id/download - Download PDF
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

          if (report.status !== "complete" || !report.pdfPath) {
            return Response.json(
              { error: "Report not ready for download" },
              { status: 400 },
            );
          }

          // SECURITY: Validate path is within expected reports directory
          const REPORTS_DIR = path.resolve(process.cwd(), "reports");
          const filePath = report.pdfPath;
          const resolvedPath = path.resolve(filePath);

          if (!resolvedPath.startsWith(REPORTS_DIR + path.sep) && resolvedPath !== REPORTS_DIR) {
            log.error("Path traversal attempt detected", undefined, {
              reportId: id,
              attemptedPath: filePath,
            });
            return Response.json({ error: "Invalid report path" }, { status: 400 });
          }

          // Verify file exists
          try {
            await stat(resolvedPath);
          } catch {
            log.error("PDF file not found", undefined, { reportId: id });
            return Response.json({ error: "PDF file not found" }, { status: 404 });
          }

          // Read file and return as response
          const filename = path.basename(resolvedPath);
          const fileBuffer = await readFile(resolvedPath);

          return new Response(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Content-Length": String(fileBuffer.length),
            },
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
            "Download report failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
