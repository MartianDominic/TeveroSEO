/**
 * API Route: Generate magic link for onboarding
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * POST /api/onboarding/magic-link
 * Generates a 24-hour expiring magic link for client credential completion.
 * Implements D-01 (dual mode) - "Send to Client" functionality.
 *
 * T-49-08: Rate limit enforced at 10 links per checklist per hour.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { MagicLinkService } from "@/server/features/onboarding/services/MagicLinkService";
import { ChecklistRepository } from "@/server/features/contracts/repositories/ChecklistRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "onboarding-magic-link" });

const requestSchema = z.object({
  checklistId: z.string().min(1, "checklistId is required"),
  itemId: z.string().min(1, "itemId is required"),
});

export const Route = createFileRoute("/api/onboarding/magic-link")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // T-49-06: Require authenticated session
          await requireApiAuth(request);

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

          // Verify checklist exists and get workspaceId
          const checklist = await ChecklistRepository.getChecklistById(
            parsed.data.checklistId
          );

          if (!checklist) {
            return Response.json(
              { success: false, error: "Checklist not found" },
              { status: 404 }
            );
          }

          // Verify item exists in checklist
          const item = checklist.items.find((i) => i.id === parsed.data.itemId);
          if (!item) {
            return Response.json(
              { success: false, error: "Item not found in checklist" },
              { status: 404 }
            );
          }

          // Generate magic link
          const result = await MagicLinkService.generateMagicLink(
            checklist.workspaceId,
            checklist.clientId,
            parsed.data.checklistId,
            parsed.data.itemId
          );

          return Response.json({
            success: true,
            url: result.url,
            expiresAt: result.expiresAt.toISOString(),
          });
        } catch (error) {
          log.error("Error generating magic link", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
