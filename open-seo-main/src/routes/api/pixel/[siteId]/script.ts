/**
 * Pixel Script API Endpoint
 * Phase 66-01: Platform Unification Excellence
 *
 * GET /api/pixel/:siteId/script
 * Returns pixel script snippet and configuration for a site.
 *
 * Security:
 * - T-66-01: Validates siteId exists and belongs to active installation
 * - T-66-02: Only returns public config (features, not tokens)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { PixelScriptService, generatePixelScript } from "@/server/features/pixel";
import { db } from "@/db";

const log = createLogger({ module: "api/pixel/script" });

// ============================================================================
// Response Types
// ============================================================================

interface ScriptResponse {
  script: string;
  siteId: string;
  features: {
    analytics: boolean;
    cwv: boolean;
    metaInjection: boolean;
    schemaInjection: boolean;
    linkInjection: boolean;
    abTesting: boolean;
  };
}

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/siteId/script")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/:siteId/script
       *
       * Returns the pixel script snippet and feature configuration.
       *
       * Response: { script: string, siteId: string, features: PixelFeatures }
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

          log.info("Fetching pixel script", { siteId });

          // Get installation config (T-66-01: validate siteId exists)
          const service = new PixelScriptService(db);
          const config = await service.getInstallationConfig(siteId);

          if (!config) {
            log.warn("Pixel installation not found", { siteId });
            return Response.json(
              { error: "Installation not found" },
              { status: 404 }
            );
          }

          // Generate script snippet
          const script = generatePixelScript(siteId);

          // Return public config only (T-66-02: no tokens/secrets)
          const response: ScriptResponse = {
            script,
            siteId: config.siteId,
            features: config.features,
          };

          log.info("Pixel script retrieved", { siteId });

          return Response.json(response);
        } catch (error) {
          log.error(
            "Failed to get pixel script",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve script" },
            { status: 500 }
          );
        }
      },
    },
  },
});
