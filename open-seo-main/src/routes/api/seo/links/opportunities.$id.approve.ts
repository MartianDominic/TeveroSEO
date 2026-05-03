/**
 * Approve Opportunity API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * POST /api/seo/links/opportunities/:id/approve - Approve an opportunity
 *
 * Security:
 * - Requires authentication via API key or Clerk JWT
 * - Verifies opportunity belongs to user's workspace via client relationship (HIGH-03 fix)
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { linkOpportunities } from "@/db/link-schema";
import { clients } from "@/db/client-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/seo/links/opportunities/approve" });

interface ApproveResponse {
  success: boolean;
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/opportunities/$id/approve")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }): Promise<Response> => {
        try {
          const auth = await requireApiAuth(request);
          const { id } = params;

          // HIGH-03 FIX: Fetch opportunity with client to verify workspace ownership
          const [opportunity] = await db
            .select({
              id: linkOpportunities.id,
              clientId: linkOpportunities.clientId,
              clientWorkspaceId: clients.workspaceId,
            })
            .from(linkOpportunities)
            .innerJoin(clients, eq(linkOpportunities.clientId, clients.id))
            .where(eq(linkOpportunities.id, id))
            .limit(1);

          if (!opportunity) {
            throw new AppError("NOT_FOUND", "Opportunity not found");
          }

          // Verify workspace ownership
          if (opportunity.clientWorkspaceId !== auth.organizationId) {
            log.warn("Opportunity approval forbidden - workspace mismatch", {
              opportunityId: id,
              clientWorkspaceId: opportunity.clientWorkspaceId,
              userOrgId: auth.organizationId,
              userId: auth.userId,
            });
            throw new AppError("FORBIDDEN", "Access denied to this opportunity");
          }

          // Update status to approved
          await db
            .update(linkOpportunities)
            .set({
              status: "approved",
            })
            .where(eq(linkOpportunities.id, id));

          log.info("Opportunity approved", { opportunityId: id, userId: auth.userId });

          return Response.json({ success: true } satisfies ApproveResponse);
        } catch (error) {
          if (error instanceof AppError) {
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
            };
            const status = statusMap[error.code] ?? 500;
            return Response.json(
              { success: false, error: error.message } satisfies ApproveResponse,
              { status }
            );
          }
          log.error(
            "Failed to approve opportunity",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies ApproveResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
