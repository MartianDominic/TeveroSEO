/**
 * Scraping Admin API - Feedback Management
 * Phase 95: Domain learning feedback buffer management
 *
 * GET /api/scraping/admin/feedback - Get feedback buffer status
 * POST /api/scraping/admin/feedback - Flush or clear feedback buffer
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { getDomainFeedbackService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const FeedbackActionSchema = z.object({
  action: z.enum(['flush', 'clear']),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/feedback")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/feedback
       *
       * Get feedback buffer status.
       */
      GET: async ({ request }: { request: Request }) => {
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        let feedbackService;
        try {
          feedbackService = getDomainFeedbackService();
        } catch {
          return new Response(
            JSON.stringify({
              error: 'Feedback service not available',
              timestamp: new Date().toISOString(),
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          const bufferSize = feedbackService.getBufferSize();

          return new Response(JSON.stringify({
            buffer: bufferSize,
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

      /**
       * POST /api/scraping/admin/feedback
       *
       * Flush or clear feedback buffer.
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
          return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const validation = FeedbackActionSchema.safeParse(body);
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

        const { action } = validation.data;

        let feedbackService;
        try {
          feedbackService = getDomainFeedbackService();
        } catch {
          return new Response(
            JSON.stringify({
              error: 'Feedback service not available',
              timestamp: new Date().toISOString(),
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          if (action === 'flush') {
            const bufferBefore = feedbackService.getBufferSize();
            const result = await feedbackService.flush();

            auditLogger.log({
              action: 'feedback_flush',
              actor: createAuditActor(request),
              target: { type: 'feedback', id: 'buffer' },
              parameters: {
                bufferBefore,
                domainsProcessed: result.domainsProcessed,
                updatesApplied: result.updatesApplied,
              },
              result: 'success',
              durationMs: Date.now() - startTime,
            }).catch(() => {});

            return new Response(JSON.stringify({
              success: true,
              action: 'flush',
              ...result,
              timestamp: new Date().toISOString(),
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } else {
            // Clear
            const beforeSize = feedbackService.getBufferSize();
            feedbackService.clearBuffer();
            const afterSize = feedbackService.getBufferSize();

            auditLogger.log({
              action: 'feedback_clear',
              actor: createAuditActor(request),
              target: { type: 'feedback', id: 'buffer' },
              parameters: {
                clearedDomains: beforeSize.domains,
                clearedFeedback: beforeSize.totalFeedback,
              },
              result: 'success',
              durationMs: Date.now() - startTime,
            }).catch(() => {});

            return new Response(JSON.stringify({
              success: true,
              action: 'clear',
              cleared: {
                domains: beforeSize.domains,
                feedback: beforeSize.totalFeedback,
              },
              remaining: afterSize,
              timestamp: new Date().toISOString(),
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (error) {
          auditLogger.log({
            action: action === 'flush' ? 'feedback_flush' : 'feedback_clear',
            actor: createAuditActor(request),
            target: { type: 'feedback', id: 'buffer' },
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
