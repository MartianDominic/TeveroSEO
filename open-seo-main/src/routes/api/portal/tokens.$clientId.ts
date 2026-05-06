/**
 * Portal Token List API Route
 * Phase 87-01: Client Portal Foundation
 *
 * GET /api/portal/tokens/:clientId - List all tokens for a client
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";

/**
 * GET /api/portal/tokens/:clientId
 * List all tokens for a specific client.
 */
export const Route = createFileRoute("/api/portal/tokens/$clientId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { clientId: string } }) => {
        try {
          const { clientId } = params;

          // Validate UUID format
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(clientId)) {
            return Response.json(
              { success: false, error: "Invalid client ID format" },
              { status: 400 }
            );
          }

          const tokens = await portalTokenService.listClientTokens(clientId);

          // Filter sensitive fields for response
          const safeTokens = tokens.map((t) => ({
            id: t.id,
            token: t.token,
            authLevel: t.authLevel,
            expiresAt: t.expiresAt,
            lastAccessedAt: t.lastAccessedAt,
            accessCount: t.accessCount,
            isRevoked: t.isRevoked,
            createdAt: t.createdAt,
          }));

          return Response.json({
            success: true,
            data: { tokens: safeTokens },
          });
        } catch (error) {
          console.error("[portal/tokens] Error listing tokens:", error);
          return Response.json(
            { success: false, error: "Failed to list tokens" },
            { status: 500 }
          );
        }
      },
    },
  },
});
