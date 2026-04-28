/**
 * Apply Suggestion API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * POST /api/seo/links/suggestions/:id/apply - Apply a link suggestion
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { linkSuggestions } from "@/db/link-schema";
import { LinkApplyService } from "@/server/features/linking/services/LinkApplyService";
import { VelocityService } from "@/server/features/linking/services/VelocityService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/suggestions/apply" });

interface ApplyResponse {
  success: boolean;
  data?: {
    changeId?: string;
  };
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/suggestions/$id/apply")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }): Promise<Response> => {
        try {
          await requireApiAuth(request);
        } catch {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies ApplyResponse,
            { status: 401 }
          );
        }

        const { id } = params;

        try {
          // Get the suggestion
          const suggestions = await db
            .select()
            .from(linkSuggestions)
            .where(eq(linkSuggestions.id, id))
            .limit(1);

          if (suggestions.length === 0) {
            return Response.json(
              { success: false, error: "Suggestion not found" } satisfies ApplyResponse,
              { status: 404 }
            );
          }

          const suggestion = suggestions[0];

          // Get connectionId from request body
          const body = await request.json().catch(() => ({}));
          const connectionId = (body as { connectionId?: string }).connectionId;

          if (!connectionId) {
            return Response.json(
              { success: false, error: "connectionId is required" } satisfies ApplyResponse,
              { status: 400 }
            );
          }

          // Create a mock connection service for now
          // TODO: Replace with real ConnectionService from Phase 31
          const mockConnectionService = {
            getPageContent: async () => suggestion.existingTextMatch ?? "",
            updatePageContent: async () => ({ success: true }),
          };

          // Apply the suggestion
          const velocityService = new VelocityService(db);
          const applyService = new LinkApplyService(db, velocityService, mockConnectionService);
          const result = await applyService.applySuggestion(suggestion, connectionId);

          if (!result.success) {
            log.warn("Suggestion application failed", { suggestionId: id, error: result.error });
            return Response.json(
              { success: false, error: result.error } satisfies ApplyResponse,
              { status: 400 }
            );
          }

          log.info("Suggestion applied", { suggestionId: id, changeId: result.changeId });

          return Response.json({
            success: true,
            data: { changeId: result.changeId },
          } satisfies ApplyResponse);
        } catch (error) {
          log.error(
            "Failed to apply suggestion",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies ApplyResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
