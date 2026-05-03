/**
 * Pixel Status API Route
 * Phase 66-02: Pixel Event Collection + Real-Time Verification
 *
 * GET /api/pixel/:siteId/status
 * Returns current verification status for a pixel installation.
 *
 * Used by connection wizard to poll for installation completion.
 *
 * HIGH-AUTH-04 FIX: Requires authentication and validates siteId ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { getPixelVerificationService } from "@/server/features/pixel/pixel-verification.service";
import { db } from "@/db";
import { pixelInstallations } from "@/db/pixel-schema";

const log = createLogger({ module: "api/pixel/status" });

/**
 * Zod schema for siteId parameter.
 * MEDIUM-03 FIX: Validate format with alphanumeric + common separators.
 */
const SiteIdSchema = z.string().min(1).max(100).regex(
  /^[a-zA-Z0-9_-]+$/,
  "Invalid siteId format"
);

export const Route = createFileRoute("/api/pixel/$siteId/status")({
  server: {
    handlers: {
      // GET /api/pixel/:siteId/status
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { siteId: string };
      }) => {
        try {
          // HIGH-AUTH-04 FIX: Require authentication
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          // MEDIUM-03 FIX: Validate path parameter format
          const siteIdParsed = SiteIdSchema.safeParse(params.siteId);
          if (!siteIdParsed.success) {
            return Response.json(
              { success: false, error: "Invalid siteId format" },
              { status: 400 }
            );
          }

          const siteId = siteIdParsed.data;

          // HIGH-AUTH-04 FIX: Validate siteId belongs to user's workspace
          const installations = await db
            .select({ id: pixelInstallations.id })
            .from(pixelInstallations)
            .where(
              and(
                eq(pixelInstallations.siteId, siteId),
                eq(pixelInstallations.workspaceId, workspaceId)
              )
            )
            .limit(1);

          if (installations.length === 0) {
            return Response.json(
              { success: false, error: "Installation not found" },
              { status: 404 }
            );
          }

          const verificationService = getPixelVerificationService();
          const status = await verificationService.getVerificationStatus(siteId);

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json(
            { success: true, data: status },
            {
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            }
          );
        } catch (error) {
          // MEDIUM-04 FIX: Handle AppError for proper status codes
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          log.error(
            "Error getting pixel status",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
