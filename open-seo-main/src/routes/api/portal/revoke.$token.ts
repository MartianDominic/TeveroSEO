/**
 * Portal Token Revoke API Route
 * Phase 87-01: Client Portal Foundation
 *
 * DELETE /api/portal/revoke/:token - Revoke a specific token
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";

/**
 * DELETE /api/portal/revoke/:token
 * Revoke a portal access token.
 */
export const Route = createFileRoute("/api/portal/revoke/$token")({
  server: {
    handlers: {
      DELETE: async ({ params }: { params: { token: string } }) => {
        try {
          const { token } = params;

          if (!token || token.length < 8) {
            return Response.json(
              { success: false, error: "Invalid token format" },
              { status: 400 }
            );
          }

          const revoked = await portalTokenService.revokeToken(token);

          if (!revoked) {
            return Response.json(
              { success: false, error: "Token not found" },
              { status: 404 }
            );
          }

          return Response.json({
            success: true,
            data: { revoked: true },
          });
        } catch (error) {
          console.error("[portal/revoke] Error revoking token:", error);
          return Response.json(
            { success: false, error: "Failed to revoke token" },
            { status: 500 }
          );
        }
      },
    },
  },
});
