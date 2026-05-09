/**
 * Scraping Admin API - Cost Report
 * Phase 95: Cost tracking and reporting
 *
 * GET /api/scraping/admin/cost-report
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/cost-report")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/cost-report
       *
       * Get cost report for specified time range.
       * Query params: start (ISO date), end (ISO date)
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
          const url = new URL(request.url);
          const start = url.searchParams.get('start');
          const end = url.searchParams.get('end');

          const report = await scrapingService.getCostReport({
            start: start ? new Date(start) : undefined,
            end: end ? new Date(end) : undefined,
          });

          return new Response(JSON.stringify({
            ...report,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
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
