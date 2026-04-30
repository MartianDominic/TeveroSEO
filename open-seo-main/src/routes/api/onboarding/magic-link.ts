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
import { createAPIFileRoute } from "@tanstack/start/api";
import { z } from "zod";
import { getSession } from "@/server/lib/session";
import { MagicLinkService } from "@/server/features/onboarding/services/MagicLinkService";
import { ChecklistRepository } from "@/server/features/contracts/repositories/ChecklistRepository";

const requestSchema = z.object({
  checklistId: z.string().min(1, "checklistId is required"),
  itemId: z.string().min(1, "itemId is required"),
});

export const APIRoute = createAPIFileRoute("/api/onboarding/magic-link")({
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

    // Verify checklist exists and get workspaceId
    const checklist = await ChecklistRepository.getChecklistById(
      parsed.data.checklistId
    );

    if (!checklist) {
      return new Response(
        JSON.stringify({ success: false, error: "Checklist not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify item exists in checklist
    const item = checklist.items.find((i) => i.id === parsed.data.itemId);
    if (!item) {
      return new Response(
        JSON.stringify({ success: false, error: "Item not found in checklist" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate magic link
    const result = await MagicLinkService.generateMagicLink(
      checklist.workspaceId,
      checklist.clientId,
      parsed.data.checklistId,
      parsed.data.itemId
    );

    return new Response(
      JSON.stringify({
        success: true,
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  },
});
