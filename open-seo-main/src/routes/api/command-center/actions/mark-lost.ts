/**
 * Mark as Lost API Route
 * Phase 62-06: Quick Actions
 *
 * POST /api/command-center/actions/mark-lost
 * Marks a prospect or proposal as lost with reason.
 *
 * Request body:
 * {
 *   entityType: 'prospect' | 'proposal',
 *   entityId: string,
 *   reason: LossReason,
 *   notes?: string,
 *   competitorName?: string
 * }
 *
 * Response:
 * { success: true }
 *
 * SECURITY:
 * - T-62-06-01: Workspace validation via X-Workspace-Id header
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getQuickActionService } from "@/server/features/command-center/services/QuickActionService";
import { LOSS_REASONS } from "@/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "mark-lost" });

const MarkLostSchema = z.object({
  entityType: z.enum(["prospect", "proposal"]),
  entityId: z.string().min(1, "Entity ID is required"),
  reason: z.enum(LOSS_REASONS),
  notes: z.string().max(2000).optional(),
  competitorName: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/command-center/actions/mark-lost")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const workspaceId = request.headers.get("X-Workspace-Id");
          const userId = request.headers.get("X-User-Id") ?? "system";

          if (!workspaceId) {
            return Response.json(
              { error: "Workspace ID required" },
              { status: 401 }
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = MarkLostSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                error: "Invalid input",
                details: parsed.error.issues,
              },
              { status: 400 }
            );
          }

          const quickActionService = getQuickActionService();
          await quickActionService.markAsLost(workspaceId, userId, parsed.data);

          return Response.json({ success: true });
        } catch (error) {
          log.error("Failed to mark as lost", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: error instanceof Error ? error.message : "Failed to mark as lost",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
