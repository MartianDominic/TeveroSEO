/**
 * Portal Token API Routes
 * Phase 87-01: Client Portal Foundation
 *
 * POST /api/portal/tokens - Generate new token
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  portalTokenService,
  type AuthLevel,
} from "@/server/services/PortalTokenService";

// Validation schemas
const GenerateTokenSchema = z.object({
  clientId: z.string().uuid(),
  authLevel: z.enum(["token_only", "email_verify", "full_login"]).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * POST /api/portal/tokens
 * Generate a new portal access token for a client.
 */
export const Route = createFileRoute("/api/portal/tokens")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const input = GenerateTokenSchema.parse(body);

          const token = await portalTokenService.generateToken({
            clientId: input.clientId,
            authLevel: input.authLevel as AuthLevel,
            expiresInDays: input.expiresInDays,
          });

          return Response.json({
            success: true,
            data: { token },
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: "Validation failed", details: error.issues },
              { status: 400 }
            );
          }
          console.error("[portal/tokens] Error generating token:", error);
          return Response.json(
            { success: false, error: "Failed to generate token" },
            { status: 500 }
          );
        }
      },
    },
  },
});
