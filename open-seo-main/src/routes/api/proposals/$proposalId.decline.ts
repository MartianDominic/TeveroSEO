/**
 * API endpoint for declining a proposal with reason.
 * Phase 30-08: Pipeline & Automation
 *
 * POST /api/proposals/:proposalId/decline - Decline with reason
 *
 * Security: Requires authentication and validates proposal ownership via workspaceId.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { proposals } from "@/db/proposal-schema";
import { canTransition } from "@/server/features/proposals/services/ProposalService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-proposals-decline" });

const DeclineSchema = z.object({
  reason: z.enum([
    "price",
    "competitor",
    "timing",
    "no_response",
    "internal",
    "other",
  ]),
  notes: z.string().optional(),
});

export const Route = createFileRoute("/api/proposals/$proposalId/decline")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { proposalId: string } }) => {
        try {
          // Require authentication
          const auth = await requireApiAuth(request);

          const { proposalId } = params;
          const body = await request.json();
          const { reason, notes } = DeclineSchema.parse(body);

          // Get current proposal
          const [proposal] = await db
            .select()
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Verify user has access to this proposal via workspace ownership
          if (proposal.workspaceId !== auth.organizationId) {
            log.warn("Unauthorized proposal decline attempt", {
              proposalId,
              userOrgId: auth.organizationId,
              proposalOrgId: proposal.workspaceId,
              userId: auth.userId,
            });
            return Response.json(
              { success: false, error: "Access denied to this proposal" },
              { status: 403 }
            );
          }

          // Validate transition
          const currentStatus = proposal.status as "sent" | "viewed" | "accepted" | "signed";
          if (!canTransition(currentStatus, "declined")) {
            return Response.json(
              {
                success: false,
                error: `Cannot decline proposal in ${currentStatus} status`,
              },
              { status: 400 }
            );
          }

          // Update proposal with decline reason
          const [updated] = await db
            .update(proposals)
            .set({
              status: "declined",
              declinedReason: reason,
              declinedNotes: notes,
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, proposalId))
            .returning();

          log.info("Proposal declined", {
            proposalId,
            from: currentStatus,
            reason,
            userId: auth.userId,
          });

          return Response.json({ success: true, data: updated });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }

          log.error(
            "Decline failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
