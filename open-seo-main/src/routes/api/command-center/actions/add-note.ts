/**
 * Add Note API Route
 * Phase 62-06: Quick Actions
 *
 * POST /api/command-center/actions/add-note
 * Adds a note to an entity's activity log.
 *
 * Request body:
 * {
 *   entityType: 'prospect' | 'proposal' | 'contract' | 'invoice' | 'client',
 *   entityId: string,
 *   note: string
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

const AddNoteSchema = z.object({
  entityType: z.enum([
    "prospect",
    "proposal",
    "contract",
    "invoice",
    "client",
  ]),
  entityId: z.string().min(1, "Entity ID is required"),
  note: z.string().min(1, "Note is required").max(5000, "Note too long"),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/command-center/actions/add-note")({
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
          const parsed = AddNoteSchema.safeParse(body);

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
          await quickActionService.addNote(workspaceId, userId, parsed.data);

          return Response.json({ success: true });
        } catch (error) {
          console.error("[add-note] Error:", error);
          return Response.json(
            {
              error:
                error instanceof Error ? error.message : "Failed to add note",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
