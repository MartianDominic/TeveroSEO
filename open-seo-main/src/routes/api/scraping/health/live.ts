/**
 * Scraping Health API - Liveness Probe
 * Phase 95: Kubernetes/load balancer liveness check
 *
 * GET /api/scraping/health/live
 *
 * Unauthenticated - always returns 200 if server can respond.
 * Use for Kubernetes liveness probes and load balancer health checks.
 */

import { createFileRoute } from "@tanstack/react-router";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/health/live")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/health/live
       *
       * Liveness probe - always returns 200 if the server can respond.
       * No authentication required.
       */
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: 'alive',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          }
        );
      },
    },
  },
});
