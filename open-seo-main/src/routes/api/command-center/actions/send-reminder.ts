/**
 * Send Reminder API Route
 * Phase 62-06: Quick Actions
 *
 * POST /api/command-center/actions/send-reminder
 * Sends a reminder email to an entity's contact.
 *
 * Request body:
 * {
 *   entityType: 'prospect' | 'proposal' | 'contract' | 'invoice',
 *   entityId: string,
 *   message?: string
 * }
 *
 * Response:
 * { success: true }
 *
 * SECURITY:
 * - T-62-06-01: Workspace validation via X-Workspace-Id header
 * - T-62-06-02: Rate limiting (10 reminders per hour per entity)
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getQuickActionService } from "@/server/features/command-center/services/QuickActionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "send-reminder" });

const SendReminderSchema = z.object({
  entityType: z.enum(["prospect", "proposal", "contract", "invoice"]),
  entityId: z.string().min(1, "Entity ID is required"),
  message: z.string().max(1000).optional(),
});

export const Route = createFileRoute(
  "/api/command-center/actions/send-reminder"
)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const workspaceId = request.headers.get("X-Workspace-Id");
          if (!workspaceId) {
            return Response.json(
              { error: "Workspace ID required" },
              { status: 401 }
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = SendReminderSchema.safeParse(body);

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
          await quickActionService.sendReminder(workspaceId, parsed.data);

          return Response.json({ success: true });
        } catch (error) {
          log.error("Failed to send reminder", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: error instanceof Error ? error.message : "Failed to send reminder",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
