/**
 * API Route: Complete onboarding checklist item
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * POST /api/onboarding/complete-item
 * Manually completes a checklist item for the authenticated user.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { ChecklistCompletionService } from "@/server/features/onboarding/services/ChecklistCompletionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "onboarding-complete-item" });

const requestSchema = z.object({
  checklistId: z.string().min(1, "checklistId is required"),
  itemId: z.string().min(1, "itemId is required"),
});

export const Route = createFileRoute("/api/onboarding/complete-item")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // T-49-06: Require authenticated session
          const auth = await requireApiAuth(request);

          // Parse and validate request body
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { success: false, error: "Invalid JSON body" },
              { status: 400 }
            );
          }

          const parsed = requestSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid request",
                details: parsed.error.flatten().fieldErrors,
              },
              { status: 400 }
            );
          }

          // Complete the checklist item
          const result = await ChecklistCompletionService.completeItemManually(
            parsed.data.checklistId,
            parsed.data.itemId,
            auth.userId
          );

          if (!result) {
            return Response.json(
              { success: false, error: "Checklist or item not found" },
              { status: 404 }
            );
          }

          return Response.json({ success: true, checklist: result });
        } catch (error) {
          log.error("Error completing checklist item", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
