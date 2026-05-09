/**
 * Scraping Admin API - Feature Migration Control
 * Phase 95: Per-feature migration advancement and rollback
 *
 * GET /api/scraping/admin/migration/:feature - Check feature readiness
 * POST /api/scraping/admin/migration/:feature - Advance or rollback feature
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { getMigrationRollout, MIGRATION_ORDER, type ScrapingFeature, type MigrationState } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import { getAuditLogger } from "@/server/features/scraping/monitoring";
import { createAuditActor } from "../_lib/audit";
import { z } from "zod";

const MigrationAdvanceSchema = z.object({
  action: z.enum(['advance', 'rollback']),
  force: z.boolean().optional().default(false),
  reason: z.string().max(500).optional(),
  targetState: z.string().optional(),
});

function validateFeature(feature: string): ScrapingFeature | null {
  if (MIGRATION_ORDER.includes(feature as ScrapingFeature)) {
    return feature as ScrapingFeature;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/migration/$feature")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/migration/:feature
       *
       * Check if a feature is ready to advance to next state.
       */
      GET: async ({ request, params }: { request: Request; params: { feature: string } }) => {
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        const feature = validateFeature(params.feature);
        if (!feature) {
          return new Response(
            JSON.stringify({
              error: 'Invalid feature',
              message: `Feature must be one of: ${MIGRATION_ORDER.join(', ')}`,
              received: params.feature,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        let migrationRollout;
        try {
          migrationRollout = getMigrationRollout();
        } catch {
          return new Response(
            JSON.stringify({
              error: 'Migration rollout service not available',
              timestamp: new Date().toISOString(),
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          const readiness = await migrationRollout.checkReadyForAdvancement(feature);

          const response = {
            feature,
            currentState: readiness.currentState,
            ready: readiness.ready,
            criteria: {
              met: [],
              unmet: readiness.blockers,
            },
            recommendation: readiness.ready
              ? `Feature ${feature} is ready to advance from ${readiness.currentState}`
              : `Feature ${feature} has ${readiness.blockers.length} unmet criteria`,
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
              feature,
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },

      /**
       * POST /api/scraping/admin/migration/:feature
       *
       * Advance or rollback a feature migration state.
       * Requires admin role (not readonly).
       */
      POST: async ({ request, params }: { request: Request; params: { feature: string } }) => {
        const startTime = Date.now();
        const auditLogger = getAuditLogger();

        const auth = validateAdminApiKey(request, { requireAdmin: true });
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        const feature = validateFeature(params.feature);
        if (!feature) {
          return new Response(
            JSON.stringify({
              error: 'Invalid feature',
              message: `Feature must be one of: ${MIGRATION_ORDER.join(', ')}`,
              received: params.feature,
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

        const validation = MigrationAdvanceSchema.safeParse(body);
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

        const { action, force, reason, targetState } = validation.data;

        let migrationRollout;
        try {
          migrationRollout = getMigrationRollout();
        } catch {
          return new Response(
            JSON.stringify({
              error: 'Migration rollout service not available',
              timestamp: new Date().toISOString(),
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          if (action === 'advance') {
            // Check readiness unless forced
            if (!force) {
              const readiness = await migrationRollout.checkReadyForAdvancement(feature);
              if (!readiness.ready) {
                auditLogger.log({
                  action: 'migration_advance',
                  actor: createAuditActor(request),
                  target: { type: 'migration', id: feature },
                  parameters: { force, reason, blockers: readiness.blockers },
                  result: 'failure',
                  errorMessage: `Not ready: ${readiness.blockers.join(', ')}`,
                  durationMs: Date.now() - startTime,
                }).catch(() => {});

                return new Response(
                  JSON.stringify({
                    error: 'Feature not ready to advance',
                    feature,
                    currentState: readiness.currentState,
                    blockers: readiness.blockers,
                    hint: 'Use force=true to override (not recommended)',
                    timestamp: new Date().toISOString(),
                  }),
                  { status: 400, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            const result = await migrationRollout.advanceFeature(feature);

            auditLogger.log({
              action: 'migration_advance',
              actor: createAuditActor(request),
              target: { type: 'migration', id: feature },
              parameters: {
                force,
                reason: reason ?? 'Manual advancement via admin API',
                previousState: result.previousState,
                newState: result.newState,
              },
              result: result.success ? 'success' : 'failure',
              errorMessage: result.success ? undefined : result.message,
              durationMs: Date.now() - startTime,
            }).catch(() => {});

            if (result.success) {
              return new Response(
                JSON.stringify({
                  success: true,
                  feature,
                  previousState: result.previousState,
                  newState: result.newState,
                  forced: force,
                  reason: reason ?? 'Manual advancement via admin API',
                  timestamp: new Date().toISOString(),
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            } else {
              return new Response(
                JSON.stringify({
                  success: false,
                  feature,
                  message: result.message,
                  currentState: result.previousState,
                  timestamp: new Date().toISOString(),
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
          } else {
            // Rollback
            const result = await migrationRollout.rollbackFeature(feature, reason ?? 'Manual rollback via admin API');

            auditLogger.log({
              action: 'migration_rollback',
              actor: createAuditActor(request),
              target: { type: 'migration', id: feature },
              parameters: {
                targetState,
                reason: reason ?? 'Manual rollback via admin API',
                previousState: result.previousState,
                newState: result.newState,
              },
              result: result.success ? 'success' : 'failure',
              errorMessage: result.success ? undefined : result.reason,
              durationMs: Date.now() - startTime,
            }).catch(() => {});

            if (result.success) {
              return new Response(
                JSON.stringify({
                  success: true,
                  feature,
                  previousState: result.previousState,
                  newState: result.newState,
                  reason: reason ?? 'Manual rollback via admin API',
                  timestamp: new Date().toISOString(),
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            } else {
              return new Response(
                JSON.stringify({
                  success: false,
                  feature,
                  reason: result.reason,
                  currentState: result.previousState,
                  timestamp: new Date().toISOString(),
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
          }
        } catch (error) {
          auditLogger.log({
            action: action === 'advance' ? 'migration_advance' : 'migration_rollback',
            actor: createAuditActor(request),
            target: { type: 'migration', id: feature },
            parameters: { action, force, reason },
            result: 'failure',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime,
          }).catch(() => {});

          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              feature,
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
