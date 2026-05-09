/**
 * Scraping Admin API - Main Dashboard Endpoints
 * Phase 95: Migration from Express routes to TanStack Start
 *
 * Provides admin endpoints for:
 * - System status and health
 * - Emergency controls (stop/resume)
 *
 * Authentication: x-admin-api-key header
 * - SCRAPING_ADMIN_API_KEY: Full admin access
 * - SCRAPING_ADMIN_READONLY_KEY: Read-only access
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getMigrationRollout, getDomainFeedbackService } from "@/server/features/scraping";
import { getAuditLogger, createAuditContext } from "@/server/features/scraping/monitoring";
import { z } from "zod";

// =============================================================================
// Zod Validation Schemas
// =============================================================================

const EmergencyStopSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  durationMinutes: z.number().int().positive().max(1440).optional(),
});

const ResumeSchema = z.object({
  confirmationCode: z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
});

// =============================================================================
// Route Handler
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/ - System status overview
       *
       * Returns comprehensive system status including:
       * - Health check results
       * - Performance metrics
       * - Circuit breaker states
       * - Queue stats
       * - Migration progress
       * - Feedback service status
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
          const [health, metrics, circuitStates, queueStats] = await Promise.all([
            scrapingService.healthCheck(),
            scrapingService.getMetrics(),
            Promise.resolve(scrapingService.getCircuitStates()),
            scrapingService.getQueueStats(),
          ]);

          // Get migration progress if available
          let migrationProgress = 0;
          try {
            const rollout = getMigrationRollout();
            const rolloutStatus = await rollout.getFullRolloutStatus();
            migrationProgress = rolloutStatus.overallProgress;
          } catch {
            // Migration rollout not initialized
          }

          // Get feedback service status
          let feedbackStatus: { enabled: boolean; bufferSize?: { domains: number; totalFeedback: number } } = { enabled: false };
          try {
            const feedbackService = getDomainFeedbackService();
            feedbackStatus = {
              enabled: true,
              bufferSize: feedbackService.getBufferSize(),
            };
          } catch {
            // Feedback service not initialized
          }

          const response = {
            health: {
              overall: health.healthy,
              components: health.components,
              latencyMs: health.latencyMs,
            },
            metrics: {
              requests: metrics.performance.requestsTotal,
              errorRate: Object.values(metrics.performance.errorsByType).reduce((a, b) => a + b, 0) /
                Math.max(metrics.performance.requestsTotal, 1),
              cacheHitRate: metrics.cache.totalHitRate,
              p95LatencyMs: metrics.performance.latencyP95Ms,
            },
            circuits: circuitStates,
            queue: queueStats,
            migration: { progress: migrationProgress },
            feedback: feedbackStatus,
            timestamp: new Date().toISOString(),
          };

          return new Response(JSON.stringify(response), {
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
