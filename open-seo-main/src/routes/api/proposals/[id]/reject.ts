/**
 * Reject proposal endpoint (public, client-facing).
 * Phase 46-47: Proposal System
 *
 * POST /api/proposals/:id/reject
 * Rejects a proposal with optional reason, transitioning status to declined.
 * Logs activity with actor_type='client' per D-10.
 *
 * SECURITY: No authentication required - called by proposal recipient.
 * State machine enforces valid transitions (from sent, viewed, or accepted).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals, type ProposalStatus } from "@/db/proposal-schema";
import {
  ProposalService,
  canTransition,
} from "@/server/features/proposals/services/ProposalService";
import { ActivityRepository } from "@/server/features/contracts/repositories/ActivityRepository";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/proposals/reject" });

/**
 * Request body schema for rejecting a proposal.
 * Both fields are optional - client may just click reject without explanation.
 */
const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/proposals/$id/reject")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const proposalId = params.id;

          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          // Parse optional request body
          const body = await request.json().catch(() => ({}));
          const parseResult = RejectSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const input = parseResult.data;

          // Get current proposal
          const proposal = await ProposalService.findById(proposalId);
          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          const previousStatus = proposal.status;

          // Validate transition (can reject from sent, viewed, or accepted)
          if (!canTransition(proposal.status as ProposalStatus, "declined")) {
            return Response.json(
              {
                success: false,
                error: `Cannot reject proposal in ${proposal.status} status`,
              },
              { status: 400 }
            );
          }

          // Update to declined with optional reason
          const [updated] = await db
            .update(proposals)
            .set({
              status: "declined",
              declinedReason: input.reason || null,
              declinedNotes: input.notes || null,
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, proposalId))
            .returning();

          // Log activity with actor_type = 'client' per D-10
          await ActivityRepository.insertActivity({
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 21),
            workspaceId: proposal.workspaceId,
            entityType: "proposal",
            entityId: proposalId,
            activityType: "status_changed",
            activityData: {
              fromStatus: previousStatus,
              toStatus: "declined",
              actorType: "client",
              reason: input.reason || null,
            },
            actorId: null, // Client action, no user ID
          });

          log.info("Proposal rejected", { proposalId, reason: input.reason });

          return Response.json({
            success: true,
            data: {
              proposalId: updated.id,
              status: updated.status,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const statusCode =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "CONFLICT"
                  ? 409
                  : 500;
            return Response.json(
              { success: false, error: error.message },
              { status: statusCode }
            );
          }

          log.error(
            "Error rejecting proposal",
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
