/**
 * Batch Apply Safe Suggestions API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * POST /api/seo/links/batch/apply-safe - Apply all auto-applicable suggestions
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { linkSuggestions } from "@/db/link-schema";
import { LinkApplyService } from "@/server/features/linking/services/LinkApplyService";
import { VelocityService } from "@/server/features/linking/services/VelocityService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/batch/apply-safe" });

interface BatchApplyResponse {
  success: boolean;
  data?: {
    applied: number;
    results: Array<{ id: string; success: boolean; error?: string }>;
  };
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/batch/apply-safe")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }): Promise<Response> => {
        let authContext;
        try {
          authContext = await requireApiAuth(request);
        } catch {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies BatchApplyResponse,
            { status: 401 }
          );
        }

        try {
          const body = await request.json().catch(() => ({}));
          const { clientId, connectionId } = body as {
            clientId?: string;
            connectionId?: string;
          };

          if (!clientId) {
            return Response.json(
              { success: false, error: "clientId is required" } satisfies BatchApplyResponse,
              { status: 400 }
            );
          }

          // Verify user has access to this client
          await requireClientAccess(authContext.userId, clientId);

          if (!connectionId) {
            return Response.json(
              { success: false, error: "connectionId is required" } satisfies BatchApplyResponse,
              { status: 400 }
            );
          }

          // Get all auto-applicable suggestions (limit 50 for velocity)
          const suggestions = await db
            .select()
            .from(linkSuggestions)
            .where(
              and(
                eq(linkSuggestions.clientId, clientId),
                eq(linkSuggestions.isAutoApplicable, true),
                eq(linkSuggestions.status, "pending")
              )
            )
            .limit(50);

          if (suggestions.length === 0) {
            return Response.json({
              success: true,
              data: { applied: 0, results: [] },
            } satisfies BatchApplyResponse);
          }

          // Create mock connection service
          // TODO: Replace with real ConnectionService from Phase 31
          const createMockConnectionService = (suggestion: typeof suggestions[0]) => ({
            getPageContent: async () => suggestion.existingTextMatch ?? "",
            updatePageContent: async () => ({ success: true }),
          });

          const velocityService = new VelocityService(db);

          const results: Array<{ id: string; success: boolean; error?: string }> = [];

          for (const suggestion of suggestions) {
            const mockConnectionService = createMockConnectionService(suggestion);
            const applyService = new LinkApplyService(db, velocityService, mockConnectionService);
            const result = await applyService.applySuggestion(suggestion, connectionId);
            results.push({
              id: suggestion.id,
              success: result.success,
              error: result.error,
            });

            // Stop if we hit velocity limit
            if (!result.success && result.error?.includes("limit")) {
              log.info("Batch apply stopped at velocity limit", {
                clientId,
                appliedCount: results.filter((r) => r.success).length,
              });
              break;
            }
          }

          const applied = results.filter((r) => r.success).length;
          log.info("Batch apply completed", { clientId, applied, total: results.length });

          return Response.json({
            success: true,
            data: { applied, results },
          } satisfies BatchApplyResponse);
        } catch (error) {
          log.error(
            "Failed to batch apply suggestions",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies BatchApplyResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
