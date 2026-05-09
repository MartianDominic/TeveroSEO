/**
 * Scraping Health API - Readiness Probe
 * Phase 95: Kubernetes/load balancer readiness check
 *
 * GET /api/scraping/health/ready
 *
 * Returns 503 if any critical component is unhealthy.
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/health/ready")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/health/ready
       *
       * Readiness probe - returns 503 if not ready to handle requests.
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

          if (health.healthy) {
            return new Response(
              JSON.stringify({
                status: 'ready',
                timestamp: health.timestamp,
                latencyMs: health.latencyMs,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                },
              }
            );
          } else {
            const unhealthyComponents = Object.entries(health.components)
              .filter(([_, v]) => !v.healthy)
              .map(([k]) => k);

            return new Response(
              JSON.stringify({
                status: 'not_ready',
                timestamp: health.timestamp,
                unhealthyComponents,
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                },
              }
            );
          }
        } catch (error) {
          return new Response(
            JSON.stringify({
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            }
          );
        }
      },
    },
  },
});
