/**
 * Pixel Loader (t.js) Endpoint
 * Phase 66-01: Platform Unification Excellence
 *
 * GET /api/pixel/t.js
 * Returns the minified pixel loader script.
 *
 * Security:
 * - T-66-03: CDN caching with 1hr TTL, stale-while-revalidate
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { generatePixelLoader } from "@/server/features/pixel";

const log = createLogger({ module: "api/pixel/t.js" });

// ============================================================================
// Caching Constants
// ============================================================================

// 1 hour cache, stale-while-revalidate for 24 hours
const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/t.js")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/t.js
       *
       * Returns the minified pixel loader script.
       * Uses aggressive caching for CDN distribution.
       *
       * Content-Type: application/javascript
       * Cache-Control: public, max-age=3600, stale-while-revalidate=86400
       */
      GET: async () => {
        try {
          const loader = generatePixelLoader();

          log.debug("Serving pixel loader", { size: loader.length });

          return new Response(loader, {
            status: 200,
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Cache-Control": CACHE_CONTROL,
              // CORS headers for cross-origin script loading
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET",
              // Security headers
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          log.error(
            "Failed to generate pixel loader",
            error instanceof Error ? error : new Error(String(error))
          );

          return new Response("// Error loading pixel", {
            status: 500,
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
            },
          });
        }
      },
    },
  },
});
