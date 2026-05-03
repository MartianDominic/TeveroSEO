/**
 * Snooze API Route
 * Phase 62-06: Quick Actions
 *
 * POST /api/command-center/actions/snooze
 * Snoozes a follow-up or workflow until a specific date.
 *
 * Request body:
 * {
 *   entityType: 'prospect' | 'proposal' | 'contract' | 'invoice' | 'follow_up',
 *   entityId: string,
 *   snoozedUntil: string (ISO datetime),
 *   reason?: string
 * }
 *
 * Response:
 * { success: true }
 *
 * SECURITY:
 * - T-62-06-01: Workspace validation via X-Workspace-Id header
 * - T-62-06-03: Only returns data user has access to
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getQuickActionService } from "@/server/features/command-center/services/QuickActionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "snooze" });

const SnoozeSchema = z.object({
  entityType: z.enum([
    "prospect",
    "proposal",
    "contract",
    "invoice",
    "follow_up",
  ]),
  entityId: z.string().min(1, "Entity ID is required"),
  snoozedUntil: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/command-center/actions/snooze")({
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
          const parsed = SnoozeSchema.safeParse(body);

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
          await quickActionService.snooze(workspaceId, userId, {
            ...parsed.data,
            snoozedUntil: new Date(parsed.data.snoozedUntil),
          });

          return Response.json({ success: true });
        } catch (error) {
          log.error("Failed to snooze", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: error instanceof Error ? error.message : "Failed to snooze",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
