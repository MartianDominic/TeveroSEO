/**
 * Report API routes.
 * Phase 15: Report generation and management.
 *
 * POST /api/reports - Start report generation
 * Accepts: { clientId, reportType?, dateRange?, locale? }
 * Returns: { reportId, status }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { reports, gscSnapshots, gscQuerySnapshots, ga4Snapshots } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { enqueueReportGeneration } from "@/server/queues/reportQueue";
import { computeReportHash } from "@/server/services/report/content-hasher";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/reports" });

const generateSchema = z.object({
  clientId: z.string().uuid(),
  reportType: z.string().default("monthly-seo"),
  dateRange: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
  locale: z.string().default("en"),
});

export const Route = createFileRoute("/api/reports/")({
  server: {
    handlers: {
      // POST /api/reports - Start report generation
      POST: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = generateSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          const { clientId, reportType, locale } = parsed.data;

          // Default date range: last 30 days
          const dateRange = parsed.data.dateRange ?? {
            end: new Date().toISOString().slice(0, 10),
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          };

          // Compute content hash for caching
          const [gscCount, ga4Count, queryCount] = await Promise.all([
            db
              .select()
              .from(gscSnapshots)
              .where(
                and(
                  eq(gscSnapshots.clientId, clientId),
                  gte(gscSnapshots.date, dateRange.start),
                  lte(gscSnapshots.date, dateRange.end),
                ),
              )
              .then((r) => r.length),
            db
              .select()
              .from(ga4Snapshots)
              .where(
                and(
                  eq(ga4Snapshots.clientId, clientId),
                  gte(ga4Snapshots.date, dateRange.start),
                  lte(ga4Snapshots.date, dateRange.end),
                ),
              )
              .then((r) => r.length),
            db
              .select()
              .from(gscQuerySnapshots)
              .where(
                and(
                  eq(gscQuerySnapshots.clientId, clientId),
                  gte(gscQuerySnapshots.date, dateRange.start),
                ),
              )
              .then((r) => r.length),
          ]);

          const contentHash = computeReportHash({
            clientId,
            dateRange,
            gscDataCount: gscCount,
            gscLastDate: dateRange.end,
            ga4DataCount: ga4Count,
            queriesCount: queryCount,
            locale,
          });

          // Check for existing report with same hash (cache hit)
          const existing = await db
            .select()
            .from(reports)
            .where(
              and(
                eq(reports.clientId, clientId),
                eq(reports.contentHash, contentHash),
                eq(reports.status, "complete"),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            log.info("Cache hit - returning existing report", {
              reportId: existing[0].id,
              contentHash,
            });
            return Response.json({
              reportId: existing[0].id,
              status: "complete",
              cached: true,
            });
          }

          // Create report record
          const [newReport] = await db
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
            .returning();

          // Enqueue generation job
          await enqueueReportGeneration(newReport.id, {
            clientId,
            reportType,
            dateRange,
            locale,
            contentHash,
          });

          return Response.json(
            {
              reportId: newReport.id,
              status: "pending",
            },
            { status: 202 },
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
            "Report generation failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
