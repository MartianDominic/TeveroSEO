/**
 * Link Health API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * GET /api/seo/links/health/:clientId - Returns link health metrics
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq, sql, count, avg } from "drizzle-orm";
import { db } from "@/db";
import { pageLinks, linkOpportunities } from "@/db/link-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/health" });

interface LinkHealthMetrics {
  totalPages: number;
  orphanPages: number;
  avgInboundLinks: number;
  deepPages: number;
}

interface LinkDistribution {
  bucket: string;
  count: number;
}

interface OpportunitySummary {
  total: number;
  byType: Record<string, number>;
}

interface LinkHealthResponse {
  success: boolean;
  data?: {
    metrics: LinkHealthMetrics;
    distribution: LinkDistribution[];
    opportunities: OpportunitySummary;
  };
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/health/$clientId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }): Promise<Response> => {
        try {
          await requireApiAuth(request);
        } catch {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies LinkHealthResponse,
            { status: 401 }
          );
        }

        const { clientId } = params;

        try {
          // Get page_links aggregates
          const metricsResult = await db
            .select({
              totalPages: count(),
              orphanPages: sql<number>`COUNT(CASE WHEN ${pageLinks.inboundTotal} = 0 THEN 1 END)`,
              avgInboundLinks: avg(pageLinks.inboundTotal),
              deepPages: sql<number>`COUNT(CASE WHEN ${pageLinks.clickDepthFromHome} > 3 THEN 1 END)`,
            })
            .from(pageLinks)
            .where(eq(pageLinks.clientId, clientId));

          const metrics: LinkHealthMetrics = {
            totalPages: metricsResult[0]?.totalPages ?? 0,
            orphanPages: metricsResult[0]?.orphanPages ?? 0,
            avgInboundLinks: Number(metricsResult[0]?.avgInboundLinks ?? 0),
            deepPages: metricsResult[0]?.deepPages ?? 0,
          };

          // Get link distribution
          const distributionResult = await db
            .select({
              bucket: sql<string>`CASE
                WHEN ${pageLinks.inboundTotal} = 0 THEN '0'
                WHEN ${pageLinks.inboundTotal} <= 10 THEN '1-10'
                WHEN ${pageLinks.inboundTotal} <= 20 THEN '11-20'
                WHEN ${pageLinks.inboundTotal} <= 30 THEN '21-30'
                WHEN ${pageLinks.inboundTotal} <= 40 THEN '31-40'
                WHEN ${pageLinks.inboundTotal} <= 50 THEN '41-50'
                ELSE '50+'
              END`,
              count: count(),
            })
            .from(pageLinks)
            .where(eq(pageLinks.clientId, clientId))
            .groupBy(
              sql`CASE
                WHEN ${pageLinks.inboundTotal} = 0 THEN '0'
                WHEN ${pageLinks.inboundTotal} <= 10 THEN '1-10'
                WHEN ${pageLinks.inboundTotal} <= 20 THEN '11-20'
                WHEN ${pageLinks.inboundTotal} <= 30 THEN '21-30'
                WHEN ${pageLinks.inboundTotal} <= 40 THEN '31-40'
                WHEN ${pageLinks.inboundTotal} <= 50 THEN '41-50'
                ELSE '50+'
              END`
            );

          const distribution: LinkDistribution[] = distributionResult.map((row) => ({
            bucket: row.bucket,
            count: row.count,
          }));

          // Get opportunity counts
          const opportunityResult = await db
            .select({
              total: count(),
              opportunityType: linkOpportunities.opportunityType,
            })
            .from(linkOpportunities)
            .where(eq(linkOpportunities.clientId, clientId))
            .groupBy(linkOpportunities.opportunityType);

          const byType: Record<string, number> = {};
          let total = 0;
          for (const row of opportunityResult) {
            byType[row.opportunityType] = row.total;
            total += row.total;
          }

          const opportunities: OpportunitySummary = { total, byType };

          log.info("Link health retrieved", { clientId, metrics });

          return Response.json({
            success: true,
            data: { metrics, distribution, opportunities },
          } satisfies LinkHealthResponse);
        } catch (error) {
          log.error(
            "Failed to get link health",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies LinkHealthResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
