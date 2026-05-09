/**
 * Scraping Admin API - Migration Status
 * Phase 95: Migration status and control endpoints
 *
 * GET /api/scraping/admin/migration - Get full migration status
 *
 * Authentication: x-admin-api-key header
 */

import { createFileRoute } from "@tanstack/react-router";
import { getMigrationRollout } from "@/server/features/scraping";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";
import type { MigrationState } from "@/server/features/scraping";

interface FeatureStatus {
  state: MigrationState;
  ready: boolean;
  blockers: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/scraping/admin/migration")({
  server: {
    handlers: {
      /**
       * GET /api/scraping/admin/migration
       *
       * Get full migration status for all features.
       */
      GET: async ({ request }: { request: Request }) => {
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
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
          const status = await migrationRollout.getFullRolloutStatus();

          // Transform to response format
          const features: Record<string, FeatureStatus> = {};
          for (const [feature, data] of Object.entries(status.features)) {
            features[feature] = {
              state: data.state,
              ready: data.ready,
              blockers: data.blockers,
            };
          }

          const response = {
            features,
            summary: {
              total: status.totalFeatures,
              migratedCount: status.migratedCount,
              overallProgress: status.overallProgress,
            },
            lastUpdated: new Date().toISOString(),
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
