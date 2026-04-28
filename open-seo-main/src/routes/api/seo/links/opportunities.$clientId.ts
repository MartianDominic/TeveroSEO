/**
 * Link Opportunities API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * GET /api/seo/links/opportunities/:clientId - Returns paginated opportunities
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq, desc, and, count } from "drizzle-orm";
import { db } from "@/db";
import { linkOpportunities } from "@/db/link-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/opportunities" });

interface OpportunityResponse {
  success: boolean;
  data?: typeof linkOpportunities.$inferSelect[];
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export const Route = createFileRoute("/api/seo/links/opportunities/$clientId")({
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
            { success: false, error: "Unauthorized" } satisfies OpportunityResponse,
            { status: 401 }
          );
        }

        const { clientId } = params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") ?? "1", 10);
        const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
        const type = url.searchParams.get("type");
        const status = url.searchParams.get("status") ?? "detected";
        const offset = (page - 1) * limit;

        try {
          // Build conditions
          const conditions = [eq(linkOpportunities.clientId, clientId)];
          if (status) {
            conditions.push(eq(linkOpportunities.status, status));
          }
          if (type) {
            conditions.push(eq(linkOpportunities.opportunityType, type));
          }

          // Get opportunities
          const opportunities = await db
            .select()
            .from(linkOpportunities)
            .where(and(...conditions))
            .orderBy(desc(linkOpportunities.urgency))
            .limit(limit)
            .offset(offset);

          // Get total count
          const totalResult = await db
            .select({ count: count() })
            .from(linkOpportunities)
            .where(and(...conditions));

          const total = totalResult[0]?.count ?? 0;

          log.info("Opportunities retrieved", { clientId, page, limit, total });

          return Response.json({
            success: true,
            data: opportunities,
            meta: { total, page, limit },
          } satisfies OpportunityResponse);
        } catch (error) {
          log.error(
            "Failed to get opportunities",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies OpportunityResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
