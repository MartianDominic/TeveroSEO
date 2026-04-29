import { createFileRoute } from "@tanstack/react-router";
import { checkDatabaseHealth } from "@/db";
import { checkRedisHealth } from "@/server/lib/redis";

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async () => {
        const checks: {
          database: boolean;
          redis: boolean;
          databaseLatencyMs?: number;
          redisLatencyMs?: number;
          errors?: string[];
        } = {
          database: false,
          redis: false,
          errors: [],
        };

        // Check database health
        const dbStart = Date.now();
        try {
          checks.database = await checkDatabaseHealth();
          checks.databaseLatencyMs = Date.now() - dbStart;
        } catch (e) {
          checks.databaseLatencyMs = Date.now() - dbStart;
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.error("[healthz] Database check failed:", errorMsg);
          checks.errors?.push(`database: ${errorMsg}`);
        }

        // Check Redis health
        try {
          const redisResult = await checkRedisHealth();
          checks.redis = redisResult.status === "healthy";
          checks.redisLatencyMs = redisResult.latencyMs;
          if (redisResult.error) {
            checks.errors?.push(`redis: ${redisResult.error}`);
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.error("[healthz] Redis check failed:", errorMsg);
          checks.errors?.push(`redis: ${errorMsg}`);
        }

        // Clean up errors array if empty
        if (checks.errors?.length === 0) {
          delete checks.errors;
        }

        const healthy = checks.database && checks.redis;

        return new Response(
          JSON.stringify({
            status: healthy ? "ok" : "degraded",
            checks: {
              database: checks.database,
              redis: checks.redis,
            },
            latency: {
              databaseMs: checks.databaseLatencyMs,
              redisMs: checks.redisLatencyMs,
            },
            ...(checks.errors && { errors: checks.errors }),
          }),
          {
            status: healthy ? 200 : 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
