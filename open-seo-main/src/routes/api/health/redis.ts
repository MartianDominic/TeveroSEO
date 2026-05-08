/**
 * Redis health check endpoint.
 * Phase 72-03: SaaS Readiness - Production health checks.
 * Phase 95: Security hardening - requires admin API key authentication.
 *
 * GET /api/health/redis - Returns Redis connection health.
 * Protected: exposes Redis version, memory usage, and client count.
 *
 * Authentication: x-admin-api-key header (SCRAPING_ADMIN_API_KEY or SCRAPING_ADMIN_READONLY_KEY)
 */
import { createFileRoute } from "@tanstack/react-router";
import { redis, checkRedisHealth } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { validateAdminApiKey } from "@/server/features/scraping/middleware";

const log = createLogger({ module: "health/redis" });

export const Route = createFileRoute("/api/health/redis")({
  server: {
    handlers: {
      /**
       * GET /api/health/redis - Redis health check.
       *
       * Requires: x-admin-api-key header with valid admin or readonly key.
       *
       * Performs:
       * 1. PING command to test connection
       * 2. Measures round-trip latency
       * 3. Reports Redis server info
       *
       * Returns:
       * - 200 OK: Redis is healthy
       * - 401 Unauthorized: Missing or invalid API key
       * - 503 Service Unavailable: Redis is unreachable
       */
      GET: async ({ request }) => {
        // Authenticate - this endpoint exposes Redis version and memory info
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
          // Use the existing health check function
          const healthResult = await Promise.race([
            checkRedisHealth(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Redis health check timeout")), 5000)
            ),
          ]);

          if (healthResult.status !== "healthy") {
            throw new Error(healthResult.error ?? "Redis unhealthy");
          }

          // Get additional Redis info
          let redisVersion = "unknown";
          let connectedClients = 0;
          let usedMemory = "unknown";

          try {
            const info = await redis.info("server");
            const versionMatch = info.match(/redis_version:(\S+)/);
            redisVersion = versionMatch?.[1] ?? "unknown";

            const clientsInfo = await redis.info("clients");
            const clientsMatch = clientsInfo.match(/connected_clients:(\d+)/);
            connectedClients = clientsMatch ? parseInt(clientsMatch[1], 10) : 0;

            const memoryInfo = await redis.info("memory");
            const memoryMatch = memoryInfo.match(/used_memory_human:(\S+)/);
            usedMemory = memoryMatch?.[1] ?? "unknown";
          } catch {
            // Info commands are optional - don't fail health check
            log.debug("Could not retrieve Redis info");
          }

          return new Response(
            JSON.stringify({
              status: "healthy",
              cache: "redis",
              version: redisVersion,
              latencyMs: healthResult.latencyMs ?? Date.now() - startTime,
              connectedClients,
              usedMemory,
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
          log.error("Redis health check failed", e instanceof Error ? e : new Error(errorMsg));

          return new Response(
            JSON.stringify({
              status: "unhealthy",
              cache: "redis",
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
