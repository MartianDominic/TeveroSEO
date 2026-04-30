/**
 * Report generation API endpoint with section configuration support.
 *
 * POST /api/reports/generate - Queue a new report generation job with custom sections.
 *
 * Phase 53 Plan 02: Section-based PDF generation endpoint.
 *
 * Threat mitigations:
 * - T-53-04: Zod schema validates section types against enum
 * - T-53-05: 365-day max date range enforced
 * - T-53-06: Branding fetched server-side by clientId, not user-provided
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { createHash } from "node:crypto";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
import { enqueueReportGeneration } from "@/server/queues/reportQueue";

const log = createLogger({ module: "api/reports/generate" });

/**
 * Section type enum matching ReportSectionType from section-renderer.ts
 */
const sectionTypeEnum = z.enum([
  "header",
  "summary_stats",
  "gsc_chart",
  "ga4_chart",
  "queries_table",
  "footer",
]);

/**
 * Section configuration schema with order validation.
 */
const sectionSchema = z.object({
  type: sectionTypeEnum,
  order: z.number().int().min(0).max(10),
  config: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Request body schema for report generation.
 * T-53-04: Section types validated against enum.
 */
const generateReportSchema = z.object({
  clientId: z.string().uuid(),
  reportType: z.enum(["monthly-seo", "weekly-summary"]).default("monthly-seo"),
  dateRange: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    })
    .optional(),
  locale: z.string().min(2).max(10).default("en"),
  sections: z.array(sectionSchema).optional(),
});

export const Route = createFileRoute("/api/reports/generate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const authContext = await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = generateReportSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          const { clientId, reportType, locale, sections } = parsed.data;

          // SECURITY: Validate user has access to this client (T-53-06 mitigation)
          // Branding is fetched server-side by clientId, not from user input
          await requireClientAccess(authContext.userId, clientId);

          // Calculate date range (default: last 30 days)
          const dateRange = parsed.data.dateRange ?? {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            end: new Date().toISOString().split("T")[0],
          };

          // T-53-05: Validate date range not > 365 days (DoS mitigation)
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff > 365) {
            return Response.json(
              { error: "Date range cannot exceed 365 days" },
              { status: 400 },
            );
          }

          if (daysDiff < 0) {
            return Response.json(
              { error: "End date must be after start date" },
              { status: 400 },
            );
          }

          // Generate content hash for caching (includes sections for cache differentiation)
          const contentHash = createHash("sha256")
            .update(
              `${clientId}:${reportType}:${dateRange.start}:${dateRange.end}:${JSON.stringify(sections ?? [])}`
            )
            .digest("hex")
            .slice(0, 16);

          // Create report record
          const [report] = await db
            .insert(reports)
            .values({
              clientId,
              reportType,
              dateRangeStart: dateRange.start,
              dateRangeEnd: dateRange.end,
              locale,
              contentHash,
              status: "pending",
            })
            .returning({ id: reports.id });

          // Enqueue generation job with sections
          await enqueueReportGeneration(report.id, {
            clientId,
            reportType,
            dateRange,
            locale,
            contentHash,
            // @ts-expect-error - sections added to job data for section-based rendering
            sections,
          });

          log.info("Report generation queued", {
            reportId: report.id,
            clientId,
            reportType,
            sectionCount: sections?.length ?? 6,
          });

          return Response.json({ reportId: report.id }, { status: 202 });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: err.message }, { status: 403 });
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
            "Generate report failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
