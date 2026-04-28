/**
 * Reject Opportunity API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * POST /api/seo/links/opportunities/:id/reject - Reject an opportunity
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { linkOpportunities } from "@/db/link-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/opportunities/reject" });

interface RejectResponse {
  success: boolean;
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/opportunities/$id/reject")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }): Promise<Response> => {
        let userId: string;
        try {
          const auth = await requireApiAuth(request);
          userId = auth.userId;
        } catch {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies RejectResponse,
            { status: 401 }
          );
        }

        const { id } = params;

        try {
          // Check if opportunity exists
          const existing = await db
            .select({ id: linkOpportunities.id })
            .from(linkOpportunities)
            .where(eq(linkOpportunities.id, id))
            .limit(1);

          if (existing.length === 0) {
            return Response.json(
              { success: false, error: "Opportunity not found" } satisfies RejectResponse,
              { status: 404 }
            );
          }

          // Update status to rejected
          await db
            .update(linkOpportunities)
            .set({
              status: "rejected",
            })
            .where(eq(linkOpportunities.id, id));

          log.info("Opportunity rejected", { opportunityId: id, userId });

          return Response.json({ success: true } satisfies RejectResponse);
        } catch (error) {
          log.error(
            "Failed to reject opportunity",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies RejectResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
