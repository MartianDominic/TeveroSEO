/**
 * GSC daily data API route.
 * M-10 FIX: Dedicated endpoint for GSC daily metrics.
 *
 * GET /api/clients/:clientId/gsc/daily?days=30
 *
 * Returns daily GSC snapshots (clicks, impressions) for traffic prediction.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { seoGscSnapshots } from "@/db/analytics-schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";
import { z } from "zod";

const log = createLogger({ module: "api/clients/gsc-daily" });

/** Maximum days allowed for GSC history */
const MAX_DAYS = 90;

const querySchema = z.object({
  days: z
    .string()
    .optional()
    .default("30")
    .transform((val) => Math.min(Math.max(parseInt(val, 10) || 30, 1), MAX_DAYS)),
});

export const Route = createFileRoute("/api/clients/$clientId/gsc/daily")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);
          await requireClientAccess(authContext.userId, params.clientId);

          const url = new URL(request.url);
          const parsed = querySchema.safeParse({
            days: url.searchParams.get("days") ?? "30",
          });

          if (!parsed.success) {
            return Response.json(
              {
                error: "Invalid request parameters",
                code: "INVALID_PARAMS",
                details: parsed.error.issues,
              },
              { status: 400 }
            );
          }

          const { days } = parsed.data;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

          // Fetch GSC daily data
          const gscData = await db
            .select({
              date: seoGscSnapshots.date,
              clicks: seoGscSnapshots.clicks,
              impressions: seoGscSnapshots.impressions,
              ctr: seoGscSnapshots.ctr,
              position: seoGscSnapshots.position,
            })
            .from(seoGscSnapshots)
            .where(
              and(
                eq(seoGscSnapshots.clientId, params.clientId),
                gte(seoGscSnapshots.date, cutoffDateStr)
              )
            )
            .orderBy(desc(seoGscSnapshots.date));

          // Format response
          const data = gscData.map((row) => ({
            date: row.date,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }));

          return Response.json({
            data,
            meta: {
              clientId: params.clientId,
              days,
              dataPoints: data.length,
            },
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(
              { error: err.message, code: err.code },
              { status }
            );
          }
          log.error(
            "GSC daily fetch failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json(
            { error: "Internal error", code: "INTERNAL_ERROR" },
            { status: 500 }
          );
        }
      },
    },
  },
});
