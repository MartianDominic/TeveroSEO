/**
 * Pixel Status API Route
 * Phase 66-02: Pixel Event Collection + Real-Time Verification
 *
 * GET /api/pixel/:siteId/status
 * Returns current verification status for a pixel installation.
 *
 * Used by connection wizard to poll for installation completion.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { getPixelVerificationService } from "@/server/features/pixel/pixel-verification.service";

const log = createLogger({ module: "api/pixel/status" });

/**
 * Zod schema for siteId parameter.
 */
const SiteIdSchema = z.string().min(1).max(100);

export const Route = createFileRoute("/api/pixel/$siteId/status")({
  server: {
    handlers: {
      // GET /api/pixel/:siteId/status
      GET: async ({ params }: { params: { siteId: string } }) => {
        try {
          const siteIdParsed = SiteIdSchema.safeParse(params.siteId);
          if (!siteIdParsed.success) {
            return Response.json(
              { error: "Invalid siteId format" },
              { status: 400 }
            );
          }

          const verificationService = getPixelVerificationService();
          const status = await verificationService.getVerificationStatus(
            siteIdParsed.data
          );

          return Response.json(status, {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        } catch (error) {
          log.error(
            "Error getting pixel status",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
