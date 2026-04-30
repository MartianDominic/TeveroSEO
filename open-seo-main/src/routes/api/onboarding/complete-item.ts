/**
 * API Route: Complete onboarding checklist item
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * POST /api/onboarding/complete-item
 * Manually completes a checklist item for the authenticated user.
 */
import { createAPIFileRoute } from "@tanstack/start/api";
import { z } from "zod";
import { getSession } from "@/server/lib/session";
import { ChecklistCompletionService } from "@/server/features/onboarding/services/ChecklistCompletionService";

const requestSchema = z.object({
  checklistId: z.string().min(1, "checklistId is required"),
  itemId: z.string().min(1, "itemId is required"),
});

export const APIRoute = createAPIFileRoute("/api/onboarding/complete-item")({
  POST: async ({ request }) => {
    // T-49-06: Require authenticated session
    const session = await getSession(request);
    if (!session?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Complete the checklist item
    const result = await ChecklistCompletionService.completeItemManually(
      parsed.data.checklistId,
      parsed.data.itemId,
      session.user.id
    );

    if (!result) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Checklist or item not found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, checklist: result }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  },
});
