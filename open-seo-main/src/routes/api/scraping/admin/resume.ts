/**
 * Scraping Admin API - Resume Operations
 * Phase 95: Resume scraping after emergency stop
 *
 * POST /api/scraping/admin/resume
 *
 * Authentication: x-admin-api-key header (admin role required)
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService, getDomainFeedbackService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const ResumeSchema = z.object({
  confirmationCode: z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/resume")({
  server: {
    handlers: {
      /**
       * POST /api/scraping/admin/resume
       *
       * Resume scraping operations after emergency stop.
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
          body = {};
        }

        const validation = ResumeSchema.safeParse(body);
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

        const { reason } = validation.data;

        try {
          await scrapingService.resume();

          // Resume feedback service if available
          try {
            const feedbackService = getDomainFeedbackService();
            feedbackService.startAutoFlush();
          } catch {
            // Feedback service not initialized
          }

          // Log audit entry
          auditLogger.log({
            action: 'resume',
            actor: createAuditActor(request),
            target: { type: 'system', id: 'scraping-system' },
            parameters: { reason: reason ?? 'Resume via admin API' },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => { /* Audit failure should not break operation */ });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Scraping operations resumed',
              reason: reason ?? 'Resume via admin API',
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          auditLogger.log({
            action: 'resume',
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
