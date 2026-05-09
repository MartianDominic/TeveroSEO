/**
 * Scraping Health API - Detailed Health Check
 * Phase 95: Full health check with component details
 *
 * GET /api/scraping/health/detailed
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/health/detailed")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/health/detailed
       *
       * Detailed health check with full component information.
       */
      GET: async ({ request }: { request: Request }) => {
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          const health = await scrapingService.healthCheck();

          return new Response(JSON.stringify(health), {
            status: health.healthy ? 200 : 503,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              healthy: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
