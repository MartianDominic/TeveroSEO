/**
 * Scraping Admin API - Emergency Stop
 * Phase 95: Emergency controls for scraping infrastructure
 *
 * POST /api/scraping/admin/emergency-stop
 *
 * Authentication: x-admin-api-key header (admin role required)
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService, getDomainFeedbackService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const EmergencyStopSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  durationMinutes: z.number().int().positive().max(1440).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/emergency-stop")({
  server: {
    handlers: {
      /**
       * POST /api/scraping/admin/emergency-stop
       *
       * Emergency stop all scraping operations.
       * Requires admin role (not readonly).
       */
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        const auditLogger = getAuditLogger();

        // Require admin role (not readonly)
        const auth = validateAdminApiKey(request, { requireAdmin: true });
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        // Parse and validate body
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const validation = EmergencyStopSchema.safeParse(body);
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

        const { reason, durationMinutes } = validation.data;

        try {
          await scrapingService.emergencyStop();

          // Stop feedback service if available
          try {
            const feedbackService = getDomainFeedbackService();
            feedbackService.stop();
          } catch {
            // Feedback service not initialized
          }

          // Log audit entry
          auditLogger.log({
            action: 'emergency_stop',
            actor: createAuditActor(request),
            target: { type: 'system', id: 'scraping-system' },
            parameters: { reason, durationMinutes },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => { /* Audit failure should not break operation */ });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'All scraping operations stopped',
              reason,
              durationMinutes,
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          auditLogger.log({
            action: 'emergency_stop',
            actor: createAuditActor(request),
            target: { type: 'system', id: 'scraping-system' },
            parameters: { reason },
            result: 'failure',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime,
          }).catch(() => { /* Audit failure should not break operation */ });

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
