/**
 * Pixel Config API Endpoint
 * Phase 66-01: Platform Unification Excellence
 *
 * GET /api/pixel/config/:siteId
 * Returns runtime configuration for the pixel loader.
 *
 * Security:
 * - T-66-01: Validates siteId exists
 * - T-66-02: Only returns public config (no workspace tokens)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { PixelScriptService } from "@/server/features/pixel";
import { db } from "@/db";

const log = createLogger({ module: "api/pixel/config" });

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/config/siteId")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/config/:siteId
       *
       * Returns configuration for the pixel runtime.
       * Used by the t.js loader to initialize features.
       *
       * Response: { siteId, features, approvedChanges }
       * 404 if siteId not found
       */
      GET: async ({ params }: { params: { siteId: string } }) => {
        try {
          const { siteId } = params;

          if (!siteId || typeof siteId !== "string") {
            return Response.json(
              { error: "Invalid siteId parameter" },
              { status: 400 }
            );
          }

          // Get installation config
          const service = new PixelScriptService(db);
          const config = await service.getInstallationConfig(siteId);

          if (!config) {
            log.warn("Pixel config not found", { siteId });
            return Response.json(
              { error: "Configuration not found" },
              { status: 404 }
            );
          }

          // Return config with CORS headers for cross-origin requests
          return new Response(JSON.stringify(config), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET",
              // Short cache for config (1 minute)
              "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            },
          });
        } catch (error) {
          log.error(
            "Failed to get pixel config",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve configuration" },
            { status: 500 }
          );
        }
      },
    },
  },
});
