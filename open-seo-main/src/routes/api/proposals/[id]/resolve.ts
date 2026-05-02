/**
 * Proposal Variable Resolution API Route
 * Phase 57-02: Variable System + Resolution Service
 *
 * POST /api/proposals/:id/resolve
 * Resolves all variables for a proposal and returns key -> value map.
 *
 * Request body:
 * {
 *   locale?: 'en' | 'lt',
 *   customValues?: Record<string, string>
 * }
 *
 * Response:
 * {
 *   data: Record<string, { key, value, category, label, isEmpty }>
 * }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VariableResolutionService } from "@/server/features/proposals/services/VariableResolutionService";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import { getClerkAuth } from "@/server/lib/clerk-auth";

const ResolveRequestSchema = z.object({
  locale: z.enum(["en", "lt"]).optional().default("en"),
  customValues: z.record(z.string()).optional().default({}),
});

export const Route = createFileRoute("/api/proposals/[id]/resolve")({
  server: {
    handlers: {
      /**
       * POST /api/proposals/:id/resolve
       * Resolve all variables for a proposal.
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Get auth context
          const auth = await getClerkAuth(request);
          if (!auth?.userId || !auth?.orgId) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

          // Verify proposal exists and belongs to workspace
          const proposal = await ProposalService.findById(params.id);

          if (!proposal) {
            return Response.json(
              { error: "Proposal not found" },
              { status: 404 }
            );
          }

          if (proposal.workspaceId !== auth.orgId) {
            return Response.json(
              { error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Parse request body
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const parsed = ResolveRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                error: "Invalid input",
                details: parsed.error.issues.map((issue) => ({
                  field: issue.path.join("."),
                  message: issue.message,
                })),
              },
              { status: 400 }
            );
          }

          // Resolve variables
          const resolved = await VariableResolutionService.resolveVariables(
            params.id,
            parsed.data.locale as "en" | "lt",
            parsed.data.customValues
          );

          return Response.json({ data: resolved });
        } catch (error) {
          console.error("[api/proposals/[id]/resolve] POST failed:", error);
          return Response.json(
            { error: "Failed to resolve variables" },
            { status: 500 }
          );
        }
      },
    },
  },
});
