/**
 * Scraping Admin API - Cache Management
 * Phase 95: Cache warming and invalidation endpoints
 *
 * GET /api/scraping/admin/cache - Get cache stats
 * POST /api/scraping/admin/cache - Warm cache with URLs
 * DELETE /api/scraping/admin/cache - Invalidate cache
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const CacheWarmSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(1000),
  priority: z.enum(['high', 'normal', 'low']).optional().default('normal'),
  concurrency: z.number().int().positive().max(50).optional().default(10),
  clientId: z.string().max(100).optional().default('admin'),
});

const CacheInvalidateSchema = z.object({
  domain: z.string().max(253).optional(),
  urlPattern: z.string().max(1000).optional(),
  all: z.boolean().optional().default(false),
}).refine(
  (data) => data.domain || data.urlPattern || data.all,
  { message: 'At least one of domain, urlPattern, or all must be specified' }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/cache")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/cache
       *
       * Get cache statistics.
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
          const stats = scrapingService.getCacheStats();

          return new Response(JSON.stringify({
            ...stats,
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
       * POST /api/scraping/admin/cache
       *
       * Warm cache with provided URLs.
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

        const validation = CacheWarmSchema.safeParse(body);
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

        const { urls, clientId } = validation.data;

        try {
          const result = await scrapingService.warmCache(urls);

          auditLogger.log({
            action: 'cache_warm',
            actor: createAuditActor(request),
            target: { type: 'cache', id: 'urls' },
            parameters: {
              urlCount: urls.length,
              clientId,
            },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(JSON.stringify({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          auditLogger.log({
            action: 'cache_warm',
            actor: createAuditActor(request),
            target: { type: 'cache', id: 'urls' },
            parameters: { urlCount: urls.length },
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

      /**
       * DELETE /api/scraping/admin/cache
       *
       * Invalidate cache entries.
       * Requires admin role.
       */
      DELETE: async ({ request }: { request: Request }) => {
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

        const validation = CacheInvalidateSchema.safeParse(body);
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

        const { domain, urlPattern, all } = validation.data;

        try {
          // Build pattern for invalidation
          let pattern = '*';
          if (domain) {
            pattern = `*${domain}*`;
          } else if (urlPattern) {
            pattern = urlPattern;
          }

          const count = await scrapingService.invalidateCache(pattern);

          auditLogger.log({
            action: 'cache_invalidate',
            actor: createAuditActor(request),
            target: { type: 'cache', id: domain ?? 'pattern' },
            parameters: { domain, urlPattern, all, invalidated: count },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(JSON.stringify({
            success: true,
            invalidated: count,
            pattern,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          auditLogger.log({
            action: 'cache_invalidate',
            actor: createAuditActor(request),
            target: { type: 'cache', id: domain ?? 'pattern' },
            parameters: { domain, urlPattern, all },
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
