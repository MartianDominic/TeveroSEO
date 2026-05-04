/**
 * Health check endpoint for service status.
 * Phase 72-03: SaaS Readiness - Production health checks.
 *
 * GET /api/health - Returns overall service health status.
 * Used by load balancers, monitoring systems, and orchestration tools.
 */
import { createFileRoute } from "@tanstack/react-router";
import { checkDatabaseHealth } from "@/db";
import { checkRedisHealth } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "health" });

/**
 * Service version from package.json or environment.
 */
const SERVICE_VERSION = process.env.npm_package_version ?? "1.0.0";

/**
 * Service name for identification.
 */
const SERVICE_NAME = "open-seo-main";

export const Route = createFileRoute("/api/health/")({
  server: {
    handlers: {
      /**
       * GET /api/health - Overall service health check.
       *
       * Returns:
       * - 200 OK: All systems operational
       * - 503 Service Unavailable: One or more systems degraded
       *
       * Response includes:
       * - status: "healthy" | "degraded" | "unhealthy"
       * - service: Service name and version
       * - uptime: Process uptime in seconds
       * - timestamp: ISO timestamp of check
       * - checks: Individual component status
       */
      GET: async () => {
        const startTime = Date.now();
        const checks: {
          database: "up" | "down";
          redis: "up" | "down";
        } = {
          database: "down",
          redis: "down",
        };

        const errors: string[] = [];

        // Check database (with timeout)
        try {
          const dbHealthy = await Promise.race([
            checkDatabaseHealth(),
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error("Database check timeout")), 5000)
            ),
          ]);
          checks.database = dbHealthy ? "up" : "down";
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.warn("Database health check failed", { error: msg });
          errors.push(`database: ${msg}`);
        }

        // Check Redis (with timeout)
        try {
          const redisResult = await Promise.race([
            checkRedisHealth(),
            new Promise<{ status: string }>((_, reject) =>
              setTimeout(() => reject(new Error("Redis check timeout")), 5000)
            ),
          ]);
          checks.redis = redisResult.status === "healthy" ? "up" : "down";
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.warn("Redis health check failed", { error: msg });
          errors.push(`redis: ${msg}`);
        }

        // Determine overall status
        const allUp = checks.database === "up" && checks.redis === "up";
        const allDown = checks.database === "down" && checks.redis === "down";
        const status = allUp ? "healthy" : allDown ? "unhealthy" : "degraded";

        const responseTime = Date.now() - startTime;

        const response = {
          status,
          service: {
            name: SERVICE_NAME,
            version: SERVICE_VERSION,
          },
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
          responseTimeMs: responseTime,
          checks,
          ...(errors.length > 0 && { errors }),
        };

        return new Response(JSON.stringify(response), {
          status: status === "healthy" ? 200 : 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      },
    },
  },
});
