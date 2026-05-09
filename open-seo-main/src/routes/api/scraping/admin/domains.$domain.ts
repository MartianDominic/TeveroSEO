/**
 * Scraping Admin API - Domain Configuration
 * Phase 95: Per-domain scrape configuration management
 *
 * GET /api/scraping/admin/domains/:domain - Get domain config
 * POST /api/scraping/admin/domains/:domain - Reset or override domain config
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { domainLearningService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const DomainActionSchema = z.object({
  action: z.enum(['reset']),
  reason: z.string().max(500).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/domains/$domain")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/domains/:domain
       *
       * Get domain scrape configuration.
       */
      GET: async ({ request, params }: { request: Request; params: { domain: string } }) => {
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        const { domain } = params;

        // Validate domain param
        if (!domain || domain.length > 253) {
          return new Response(
            JSON.stringify({
              error: 'Invalid domain parameter',
              timestamp: new Date().toISOString(),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          const config = await domainLearningService.getConfig(domain);

          if (!config) {
            return new Response(
              JSON.stringify({
                error: 'Domain configuration not found',
                domain,
                timestamp: new Date().toISOString(),
              }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(JSON.stringify({
            domain,
            config,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              domain,
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },

      /**
       * POST /api/scraping/admin/domains/:domain
       *
       * Reset or override domain configuration.
       * Requires admin role.
       */
      POST: async ({ request, params }: { request: Request; params: { domain: string } }) => {
        const startTime = Date.now();
        const auditLogger = getAuditLogger();

        const auth = validateAdminApiKey(request, { requireAdmin: true });
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        const { domain } = params;

        // Validate domain param
        if (!domain || domain.length > 253) {
          return new Response(
            JSON.stringify({
              error: 'Invalid domain parameter',
              timestamp: new Date().toISOString(),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
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

        const validation = DomainActionSchema.safeParse(body);
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
          // Invalidate cache forces re-discovery on next request
          await domainLearningService.invalidateCache(domain);

          auditLogger.log({
            action: 'cache_invalidate',
            actor: createAuditActor(request),
            target: { type: 'domain', id: domain },
            parameters: { reason: reason ?? 'Manual reset via admin API' },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(JSON.stringify({
            success: true,
            domain,
            action: 'reset',
            reason: reason ?? 'Manual reset via admin API',
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          auditLogger.log({
            action: 'cache_invalidate',
            actor: createAuditActor(request),
            target: { type: 'domain', id: domain },
            parameters: { reason },
            result: 'failure',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              domain,
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
