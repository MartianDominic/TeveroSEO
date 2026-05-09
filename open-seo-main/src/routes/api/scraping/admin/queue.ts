/**
 * Scraping Admin API - Queue Management
 * Phase 95: Queue statistics and management
 *
 * GET /api/scraping/admin/queue - Get queue stats
 * POST /api/scraping/admin/queue - Drain queue
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const DrainQueueSchema = z.object({
  olderThanMinutes: z.number().int().positive().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/queue")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/queue
       *
       * Get queue statistics.
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
          const stats = await scrapingService.getQueueStats();
          const healthy = stats.failed < 100 && stats.waiting < 1000;

          return new Response(JSON.stringify({
            ...stats,
            healthy,
            timestamp: new Date().toISOString(),
          }), {
            status: healthy ? 200 : 503,
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

      /**
       * POST /api/scraping/admin/queue
       *
       * Drain queue (remove old jobs).
       * Requires admin role.
       */
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        const auditLogger = getAuditLogger();

        const auth = validateAdminApiKey(request, { requireAdmin: true });
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const validation = DrainQueueSchema.safeParse(body);
        if (!validation.success) {
          return new Response(
            JSON.stringify({
              error: 'Validation failed',
              details: validation.error.issues.map((issue) => ({
                field: issue.path.join('.') || 'body',
                message: issue.message,
              })),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const { olderThanMinutes } = validation.data;

        try {
          const count = await scrapingService.drainQueue(olderThanMinutes);

          auditLogger.log({
            action: 'queue_drain',
            actor: createAuditActor(request),
            target: { type: 'queue', id: 'scraping' },
            parameters: { olderThanMinutes, drained: count },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(JSON.stringify({
            success: true,
            drained: count,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          auditLogger.log({
            action: 'queue_drain',
            actor: createAuditActor(request),
            target: { type: 'queue', id: 'scraping' },
            parameters: { olderThanMinutes },
            result: 'failure',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

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
