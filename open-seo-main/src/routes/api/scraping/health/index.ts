/**
 * Scraping Health API - Main Health Endpoints
 * Phase 95: Health check endpoints for scraping infrastructure
 *
 * GET /api/scraping/health - Overall health check
 * GET /api/scraping/health/live - Liveness probe (unauthenticated)
 * GET /api/scraping/health/ready - Readiness probe (authenticated)
 *
 * Authentication: x-admin-api-key header (except /live)
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/health/")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/health/
       *
       * Basic health check - returns overall status.
       * Protected: exposes component status details.
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

          // Determine overall status
          const criticalComponents = ['redis', 'postgres'];
          const criticalHealthy = criticalComponents.every(
            (c) => health.components[c as keyof typeof health.components]?.healthy
          );

          const status = health.healthy
            ? 'healthy'
            : criticalHealthy
              ? 'degraded'
              : 'unhealthy';

          return new Response(JSON.stringify({
            status,
            timestamp: new Date().toISOString(),
          }), {
            status: status === 'unhealthy' ? 503 : 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              status: 'unhealthy',
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
