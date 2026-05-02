/**
 * API endpoint for generating/regenerating magic share links.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * POST /api/proposals/:id/link
 * Generates a shareable magic link with 30-day expiry.
 * If regenerate=true, invalidates the previous link.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db/index";
import { proposals } from "@/db/proposal-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/link" });

/**
 * Request body schema for generating a magic link.
 */
const GenerateLinkSchema = z.object({
  regenerate: z.boolean().optional().default(false),
  expirationDays: z.number().int().min(1).max(90).optional().default(30),
});

/**
 * Generate a secure random token for public proposal access.
 * Uses 32-char nanoid (~10^57 entropy) to prevent enumeration.
 */
function generateToken(): string {
  return nanoid(32);
}

/**
 * Build the full public URL for a proposal token.
 */
function buildPublicUrl(token: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/p/${token}`;
}

/**
 * POST /api/proposals/:id/link
 *
 * Request body:
 * {
 *   "regenerate": false, // Optional, if true generates new token
 *   "expirationDays": 30 // Optional, defaults to 30 days
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://app.tevero.io/p/abc123...",
 *     "token": "abc123...",
 *     "expiresAt": "2026-06-01T12:00:00Z"
 *   }
 * }
 */
export const Route = createFileRoute("/api/proposals/[id]/link")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          const proposalId = params.id;
          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          // Parse and validate request body
          const body = await request.json().catch(() => ({}));
          const parseResult = GenerateLinkSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const input = parseResult.data;

          // Get proposal
          const [proposal] = await db
            .select()
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Verify workspace access
          if (proposal.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Calculate new expiry (30 days from now by default)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + input.expirationDays);

          let token = proposal.token;
          let needsUpdate = false;

          // Generate new token if regenerating or if no token exists
          if (input.regenerate || !token) {
            token = generateToken();
            needsUpdate = true;
            log.info("Generated new magic link token", {
              proposalId,
              regenerate: input.regenerate,
            });
          }

          // Update proposal with new token/expiry if needed
          if (needsUpdate) {
            await db
              .update(proposals)
              .set({
                token,
                expiresAt,
                updatedAt: new Date(),
              })
              .where(eq(proposals.id, proposalId));
          } else {
            // Just update the expiry date
            await db
              .update(proposals)
              .set({
                expiresAt,
                updatedAt: new Date(),
              })
              .where(eq(proposals.id, proposalId));
          }

          const url = buildPublicUrl(token);

          log.info("Magic link generated", {
            proposalId,
            expiresAt: expiresAt.toISOString(),
            regenerated: input.regenerate,
          });

          return Response.json({
            success: true,
            data: {
              url,
              token,
              expiresAt: expiresAt.toISOString(),
            },
          });
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json(
                { success: false, error: error.message },
                { status: 401 }
              );
            }
            if (error.code === "FORBIDDEN") {
              return Response.json(
                { success: false, error: error.message },
                { status: 403 }
              );
            }
          }

          log.error(
            "Failed to generate magic link",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Failed to generate magic link" },
            { status: 500 }
          );
        }
      },
    },
  },
});
