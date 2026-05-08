/**
 * Scraping Metrics API Endpoint
 * Phase 95: Prometheus-compatible metrics endpoint for scraping infrastructure.
 *
 * GET /api/scraping/metrics
 *
 * Returns metrics in Prometheus text format (text/plain; version=0.0.4)
 * for scraping by Prometheus or compatible monitoring systems.
 *
 * Authentication: x-admin-api-key header (SCRAPING_ADMIN_API_KEY or SCRAPING_ADMIN_READONLY_KEY)
 *
 * Metrics exposed:
 * - scraping_request_duration_seconds (histogram) - Request latency by tier/status
 * - scraping_requests_total (counter) - Request counts by tier/status
 * - scraping_cost_usd_total (counter) - Cost by tier/client
 * - scraping_cache_hits_total (counter) - Cache hits by level
 * - scraping_circuit_state (gauge) - Circuit breaker states
 * - scraping_component_health (gauge) - Component health status
 * - scraping_queue_jobs (gauge) - Queue job counts
 * - scraping_cache_hit_rate (gauge) - Cache hit rates by level
 * - scraping_latency_percentile_seconds (gauge) - P50/P95/P99 latencies
 * - scraping_p95_latency_rolling_ms (gauge) - Rolling P95 latency
 * - And more...
 *
 * @module api/scraping/metrics
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/metrics")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/metrics - Prometheus metrics endpoint.
       *
       * Returns scraping infrastructure metrics in Prometheus text format.
       * Designed for Prometheus scraping at configurable intervals (e.g., 15s-60s).
       *
       * Requires: x-admin-api-key header with valid admin or readonly key.
       *
       * Response: text/plain; version=0.0.4; charset=utf-8
       * - 200 OK: Prometheus-formatted metrics
       * - 401 Unauthorized: Missing or invalid API key
       * - 500 Internal Server Error: Metrics generation failed
       */
      GET: async ({ request }: { request: Request }) => {
        // Validate admin API key (readonly access is sufficient)
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            {
              status: auth.statusCode,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        try {
          // Get Prometheus-formatted metrics from the scraping service
          const metrics = await scrapingService.getPrometheusMetrics();
          const contentType = scrapingService.getMetricsContentType();

          return new Response(metrics, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              // Prometheus typically scrapes every 15-60s, so allow short caching
              "Cache-Control": "public, max-age=10",
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          // Return error in Prometheus comment format for visibility in scrape logs
          return new Response(
            `# Error generating metrics: ${errorMessage}\n`,
            {
              status: 500,
              headers: {
                "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
              },
            }
          );
        }
      },
    },
  },
});
