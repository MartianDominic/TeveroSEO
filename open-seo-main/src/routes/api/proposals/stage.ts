/**
 * API endpoint for updating proposal stage.
 * Phase 30-08: Pipeline & Automation
 *
 * PATCH /api/proposals/stage - Update proposal status
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { proposals } from "@/db/proposal-schema";
import { VALID_TRANSITIONS, canTransition } from "@/server/features/proposals/services/ProposalService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-proposals-stage" });

const UpdateStageSchema = z.object({
  proposalId: z.string().min(1),
  status: z.enum([
    "draft",
    "sent",
    "viewed",
    "accepted",
    "signed",
    "paid",
    "onboarded",
    "declined",
    "expired",
  ]),
});

export const Route = createFileRoute("/api/proposals/stage")({
  server: {
    handlers: {
      PATCH: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const { proposalId, status: newStatus } = UpdateStageSchema.parse(body);

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

          // Validate transition
          const currentStatus = proposal.status as keyof typeof VALID_TRANSITIONS;
          if (!canTransition(currentStatus, newStatus)) {
            return Response.json(
              {
                success: false,
                error: `Cannot transition from ${currentStatus} to ${newStatus}`,
              },
              { status: 400 }
            );
          }

          // Build update object with appropriate timestamp
          const updates: Record<string, unknown> = {
            status: newStatus,
            updatedAt: new Date(),
          };

          // Set lifecycle timestamps based on new status
          if (newStatus === "sent" && !proposal.sentAt) {
            updates.sentAt = new Date();
            // Set default expiration (30 days)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            updates.expiresAt = expiresAt;
          } else if (newStatus === "viewed" && !proposal.firstViewedAt) {
            updates.firstViewedAt = new Date();
          } else if (newStatus === "accepted" && !proposal.acceptedAt) {
            updates.acceptedAt = new Date();
          } else if (newStatus === "signed" && !proposal.signedAt) {
            updates.signedAt = new Date();
          } else if (newStatus === "paid" && !proposal.paidAt) {
            updates.paidAt = new Date();
          }

          // Update proposal
          const [updated] = await db
            .update(proposals)
            .set(updates)
            .where(eq(proposals.id, proposalId))
            .returning();

          log.info("Proposal stage updated", {
            proposalId,
            from: currentStatus,
            to: newStatus,
          });

          return Response.json({ success: true, data: updated });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }

          log.error(
            "Stage update failed",
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
