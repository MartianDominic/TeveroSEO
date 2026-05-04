/**
 * Crawl Metrics API Endpoint
 *
 * Exposes crawl metrics for cost savings visualization.
 * Returns singleflight and delta crawling efficiency metrics.
 *
 * GET /api/metrics/crawl
 * Response:
 * {
 *   singleflightHits: number,
 *   singleflightMisses: number,
 *   deltaL0Skips: number,
 *   deltaL1Skips: number,
 *   deltaL2Skips: number,
 *   fullProcessed: number,
 *   fastApiCompleted: number,
 *   heavyCrawlCompleted: number,
 *   costSavingsDollars: number,
 *   singleflightRatio: number,
 *   deltaSkipRatio: number,
 *   timestamp: string
 * }
 *
 * @module api/metrics/crawl
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  getMetrics,
  getSingleflightRatio,
  getDeltaSkipRatio,
} from "@/server/lib/metrics/crawl-metrics";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

export const Route = createFileRoute("/api/metrics/crawl")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // CRIT-API-01: Require authentication for internal metrics
        await requireApiAuth(request);

        const metrics = getMetrics();

        return new Response(
          JSON.stringify({
            ...metrics,
            singleflightRatio: getSingleflightRatio(),
            deltaSkipRatio: getDeltaSkipRatio(),
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
