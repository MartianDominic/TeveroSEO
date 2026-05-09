/**
 * Scraping Admin API - Circuit Breaker Management
 * Phase 95: Circuit breaker status and control
 *
 * GET /api/scraping/admin/circuits - Get circuit states
 * POST /api/scraping/admin/circuits - Reset or force circuit state
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const CircuitActionSchema = z.object({
  tier: z.string().min(1).max(50),
  action: z.enum(['close', 'open', 'reset']),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/circuits")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/circuits
       *
       * Get circuit breaker states for all tiers.
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
          const states = scrapingService.getCircuitStates();
          const openCircuits = Object.entries(states)
            .filter(([_, state]) => state === 'open')
            .map(([tier]) => tier);

          return new Response(JSON.stringify({
            states,
            openCircuits,
            openCount: openCircuits.length,
            timestamp: new Date().toISOString(),
          }), {
            status: openCircuits.length > 3 ? 503 : 200,
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
       * POST /api/scraping/admin/circuits
       *
       * Control circuit breaker state.
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

        const validation = CircuitActionSchema.safeParse(body);
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

        const { tier, action } = validation.data;

        try {
          // Map user action to audit action type
          const auditAction = action === 'open'
            ? 'circuit_force_open' as const
            : action === 'reset'
              ? 'circuit_reset' as const
              : 'circuit_force_close' as const;

          if (action === 'close' || action === 'reset') {
            scrapingService.forceCloseCircuit(tier);
          } else {
            scrapingService.forceOpenCircuit(tier);
          }

          auditLogger.log({
            action: auditAction,
            actor: createAuditActor(request),
            target: { type: 'circuit', id: tier },
            parameters: { tier, action },
            result: 'success',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(JSON.stringify({
            success: true,
            tier,
            action,
            message: `Circuit ${tier} ${action === 'open' ? 'opened' : 'closed/reset'}`,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          // Map user action to audit action type
          const auditAction = action === 'open'
            ? 'circuit_force_open' as const
            : action === 'reset'
              ? 'circuit_reset' as const
              : 'circuit_force_close' as const;

          auditLogger.log({
            action: auditAction,
            actor: createAuditActor(request),
            target: { type: 'circuit', id: tier },
            parameters: { tier, action },
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
