/**
 * Database health check endpoint.
 * Phase 72-03: SaaS Readiness - Production health checks.
 * Phase 95: Security hardening - requires admin API key authentication.
 *
 * GET /api/health/db - Returns database connection health.
 * Protected: exposes database version and latency metrics.
 *
 * Authentication: x-admin-api-key header (SCRAPING_ADMIN_API_KEY or SCRAPING_ADMIN_READONLY_KEY)
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

const log = createLogger({ module: "health/db" });

export const Route = createFileRoute("/api/health/db")({
  server: {
    handlers: {
      /**
       * GET /api/health/db - Database health check.
       *
       * Requires: x-admin-api-key header with valid admin or readonly key.
       *
       * Performs:
       * 1. Connection test via SELECT 1
       * 2. Measures query latency
       * 3. Reports PostgreSQL version
       *
       * Returns:
       * - 200 OK: Database is healthy
       * - 401 Unauthorized: Missing or invalid API key
       * - 503 Service Unavailable: Database is unreachable
       */
      GET: async ({ request }) => {
        // Authenticate - this endpoint exposes database version and latency
        const auth = validateAdminApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({ error: auth.error }),
            {
              status: auth.statusCode,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const startTime = Date.now();

        try {
          // Test connection with simple query
          const result = await Promise.race([
            db.execute(sql`SELECT 1 as ping, version() as version`),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Database query timeout")), 5000)
            ),
          ]);

          const latencyMs = Date.now() - startTime;

          // Extract version from result
          const row = result.rows?.[0] as { ping?: number; version?: string } | undefined;
          const version = row?.version ?? "unknown";

          // Parse PostgreSQL version (e.g., "PostgreSQL 15.4 on ...")
          const versionMatch = version.match(/PostgreSQL\s+([\d.]+)/);
          const pgVersion = versionMatch?.[1] ?? version.slice(0, 50);

          return new Response(
            JSON.stringify({
              status: "healthy",
              database: "postgresql",
              version: pgVersion,
              latencyMs,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            }
          );
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          log.error("Database health check failed", e instanceof Error ? e : new Error(errorMsg));

          return new Response(
            JSON.stringify({
              status: "unhealthy",
              database: "postgresql",
              error: errorMsg,
              latencyMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            }
          );
        }
      },
    },
  },
});
