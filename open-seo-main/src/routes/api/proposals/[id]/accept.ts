/**
 * Accept proposal endpoint.
 * Phase 46-47: Proposal System
 *
 * POST /api/proposals/:id/accept
 * Accepts a proposal, transitioning status from viewed to accepted.
 * Logs activity with actor_type='client' per D-10.
 *
 * SECURITY: No authentication required - called by proposal recipient.
 * State machine enforces valid transitions (only from "viewed" status).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import { ActivityRepository } from "@/server/features/contracts/repositories/ActivityRepository";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/proposals/accept" });

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/proposals/$id/accept")({
  server: {
    handlers: {
      POST: async ({ params }: { params: { id: string } }) => {
        try {
          const proposalId = params.id;

          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          // Get current proposal to capture previous status
          const proposal = await ProposalService.findById(proposalId);
          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          const previousStatus = proposal.status;

          // Validate transition (must be in viewed status per state machine)
          if (proposal.status !== "viewed") {
            return Response.json(
              {
                success: false,
                error: `Cannot accept proposal in ${proposal.status} status. Proposal must be viewed first.`,
              },
              { status: 400 }
            );
          }

          // Mark as accepted
          const updated = await ProposalService.markAccepted(proposalId);

          // Log activity with actor_type = 'client' per D-10
          await ActivityRepository.insertActivity({
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 21),
            workspaceId: proposal.workspaceId,
            entityType: "proposal",
            entityId: proposalId,
            activityType: "status_changed",
            activityData: {
              fromStatus: previousStatus,
              toStatus: "accepted",
              actorType: "client",
            },
            actorId: null, // Client action, no user ID
          });

          log.info("Proposal accepted", { proposalId });

          return Response.json({
            success: true,
            data: {
              proposalId: updated.id,
              status: updated.status,
              acceptedAt: updated.acceptedAt,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            if (error.code === "CONFLICT") {
              return Response.json(
                { success: false, error: error.message },
                { status: 409 }
              );
            }
            if (error.code === "NOT_FOUND") {
              return Response.json(
                { success: false, error: error.message },
                { status: 404 }
              );
            }
          }

          log.error(
            "Error accepting proposal",
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
