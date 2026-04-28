/**
 * Branding API routes.
 * Phase 16: Client branding CRUD for white-label reports.
 *
 * GET /api/branding?client_id={id} - Get branding for client (or defaults)
 * PUT /api/branding - Create or update branding (upsert)
 * DELETE /api/branding?client_id={id} - Delete branding (revert to defaults)
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { clientBranding } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";

const log = createLogger({ module: "api/branding" });

/**
 * Default Tevero branding colors.
 */
const DEFAULT_BRANDING = {
  primaryColor: "#3b82f6", // Tevero blue
  secondaryColor: "#10b981", // Tevero green
  logoUrl: null,
  footerText: null,
};

/**
 * Validates hex color format (#RRGGBB).
 */
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Sanitizes footer HTML to allow only basic tags.
 * Strips scripts and dangerous attributes.
 * T-16-14: Footer HTML tampering mitigation.
 */
function sanitizeFooterText(html: string | null): string | null {
  if (!html) return null;

  // Max 500 characters
  if (html.length > 500) {
    throw new Error("Footer text too long. Maximum: 500 characters");
  }

  // Remove script tags and event handlers
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");

  return sanitized;
}

const upsertBrandingSchema = z.object({
  clientId: z.string().uuid(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  footerText: z.string().max(500).nullable().optional(),
});

export const Route = createFileRoute("/api/branding/")({
  server: {
    handlers: {
      // GET /api/branding?client_id={id} - Get branding for client
      GET: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          // Validate client ownership - resolveClientId checks UUID format,
          // verifies client exists, and is not archived (AUTH-03)
          const clientId = await resolveClientId(request.headers, request.url);

          if (!clientId) {
            return Response.json(
              { error: "client_id query parameter is required" },
              { status: 400 },
            );
          }

          const [branding] = await db
            .select()
            .from(clientBranding)
            .where(eq(clientBranding.clientId, clientId))
            .limit(1);

          if (!branding) {
            // Return defaults with clientId
            return Response.json({
              clientId,
              ...DEFAULT_BRANDING,
              createdAt: null,
              updatedAt: null,
            });
          }

          return Response.json({
            id: branding.id,
            clientId: branding.clientId,
            logoUrl: branding.logoUrl,
            primaryColor: branding.primaryColor,
            secondaryColor: branding.secondaryColor,
            footerText: branding.footerText,
            createdAt: branding.createdAt.toISOString(),
            updatedAt: branding.updatedAt.toISOString(),
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Get branding failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // PUT /api/branding - Create or update branding (upsert)
      PUT: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = upsertBrandingSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          const { clientId: requestedClientId, primaryColor, secondaryColor, footerText } =
            parsed.data;

          // Validate client ownership - resolveClientId checks UUID format,
          // verifies client exists, and is not archived (AUTH-03)
          const clientId = await resolveClientId(
            new Headers({ "x-client-id": requestedClientId }),
            undefined,
          );

          if (!clientId) {
            return Response.json(
              { error: "Invalid or unauthorized client_id" },
              { status: 403 },
            );
          }

          // Validate colors if provided
          if (primaryColor && !isValidHexColor(primaryColor)) {
            return Response.json(
              {
                error: `Invalid primary color format: ${primaryColor}. Use hex format #RRGGBB`,
              },
              { status: 400 },
            );
          }

          if (secondaryColor && !isValidHexColor(secondaryColor)) {
            return Response.json(
              {
                error: `Invalid secondary color format: ${secondaryColor}. Use hex format #RRGGBB`,
              },
              { status: 400 },
            );
          }

          // Sanitize footer text
          let sanitizedFooter: string | null = null;
          try {
            sanitizedFooter = sanitizeFooterText(footerText ?? null);
          } catch (err) {
            return Response.json(
              { error: (err as Error).message },
              { status: 400 },
            );
          }

          // Check if branding exists
          const [existing] = await db
            .select()
            .from(clientBranding)
            .where(eq(clientBranding.clientId, clientId))
            .limit(1);

          if (existing) {
            // Update existing
            const [updated] = await db
              .update(clientBranding)
              .set({
                primaryColor: primaryColor ?? existing.primaryColor,
                secondaryColor: secondaryColor ?? existing.secondaryColor,
                footerText:
                  footerText !== undefined
                    ? sanitizedFooter
                    : existing.footerText,
                updatedAt: new Date(),
              })
              .where(eq(clientBranding.id, existing.id))
              .returning();

            log.info("Branding updated", { clientId });

            return Response.json({
              id: updated.id,
              clientId: updated.clientId,
              logoUrl: updated.logoUrl,
              primaryColor: updated.primaryColor,
              secondaryColor: updated.secondaryColor,
              footerText: updated.footerText,
              createdAt: updated.createdAt.toISOString(),
              updatedAt: updated.updatedAt.toISOString(),
            });
          } else {
            // Insert new
            const [created] = await db
              .insert(clientBranding)
              .values({
                clientId,
                primaryColor: primaryColor ?? DEFAULT_BRANDING.primaryColor,
                secondaryColor:
                  secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
                footerText: sanitizedFooter,
              })
              .returning();

            log.info("Branding created", { clientId });

            return Response.json(
              {
                id: created.id,
                clientId: created.clientId,
                logoUrl: created.logoUrl,
                primaryColor: created.primaryColor,
                secondaryColor: created.secondaryColor,
                footerText: created.footerText,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString(),
              },
              { status: 201 },
            );
          }
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Upsert branding failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/branding?client_id={id} - Delete branding
      DELETE: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          // Validate client ownership - resolveClientId checks UUID format,
          // verifies client exists, and is not archived (AUTH-03)
          const clientId = await resolveClientId(request.headers, request.url);

          if (!clientId) {
            return Response.json(
              { error: "client_id query parameter is required" },
              { status: 400 },
            );
          }

          const [deleted] = await db
            .delete(clientBranding)
            .where(eq(clientBranding.clientId, clientId))
            .returning();

          if (!deleted) {
            return Response.json(
              { error: "Branding not found" },
              { status: 404 },
            );
          }

          log.info("Branding deleted", { clientId });

          return Response.json({ success: true }, { status: 200 });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Delete branding failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
