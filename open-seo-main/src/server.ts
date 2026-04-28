import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { withSecurityHeaders } from "@/server/middleware/security-headers";
import { validateEnv, REQUIRED_ENV_CORE, REQUIRED_ENV_SECURITY } from "@/server/lib/runtime-env";
import { startAuditWorker, stopAuditWorker } from "@/server/workers/audit-worker";
import {
  startAnalyticsWorker,
  stopAnalyticsWorker,
} from "@/server/workers/analytics-worker";
import { closeRedis, validateRedisConnection } from "@/server/lib/redis";
import { pool } from "@/db";
import { createLogger } from "@/server/lib/logger";
import { createServer } from "http";
import { initSocketServer } from "@/server/websocket/socket-server";

const log = createLogger({ module: "server" });

// Fail fast on missing required environment variables. Runs once per process.
// In production, also validate security-critical vars (INTERNAL_API_KEY, IP_SALT)
const isProduction = process.env.NODE_ENV === "production";
const requiredEnvVars = isProduction
  ? [...REQUIRED_ENV_CORE, ...REQUIRED_ENV_SECURITY]
  : REQUIRED_ENV_CORE;
validateEnv(requiredEnvVars);

// Validate Redis connection at startup - fail fast if Redis is unavailable.
// This prevents accepting requests when critical infrastructure is down.
validateRedisConnection()
  .then(() => log.info("Redis connection validated at startup"))
  .catch((err) => {
    log.error("Redis startup validation failed", err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  });

// Start the BullMQ Workers as part of the HTTP server process. Plan 4 (Docker)
// may opt to run the worker in a separate container; at that time the startup
// of this function will move to a dedicated entry file. For Phase 3 we run
// Worker + HTTP in one process for dev simplicity.
startAuditWorker();

// Start analytics worker (initializes nightly scheduler at 02:00 UTC)
void startAnalyticsWorker();

// Start WebSocket server on separate port for real-time dashboard updates
const WS_PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 3002;
const wsServer = createServer();
initSocketServer(wsServer);
wsServer.listen(WS_PORT, () => {
  log.info("WebSocket server listening", { port: WS_PORT });
});

// Graceful shutdown: drain Worker (up to 25s), then close Redis connections,
// then close Postgres pool. Order matters — Worker may still write to DB/Redis
// during drain.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Shutdown signal received", { signal });
  try {
    await stopAuditWorker();
  } catch (err) {
    log.error("stopAuditWorker failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    await stopAnalyticsWorker();
  } catch (err) {
    log.error("stopAnalyticsWorker failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    await closeRedis();
  } catch (err) {
    log.error("closeRedis failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    await pool.end();
  } catch (err) {
    log.error("pool.end failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    wsServer.close();
    log.info("WebSocket server closed");
  } catch (err) {
    log.error("wsServer.close failed", err instanceof Error ? err : new Error(String(err)));
  }
  log.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

// Process error handlers - prevent ungraceful crashes
process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled Rejection", reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise),
  });
  // Don't exit - just log. Let the process continue.
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught Exception", error);
  // Attempt graceful shutdown on uncaught exception
  void shutdown("uncaughtException").finally(() => process.exit(1));
});

// Create the base fetch handler
const baseFetch = createStartHandler(defaultStreamHandler);

// Wrap with security headers middleware (adds OWASP security headers to all responses)
const fetch = withSecurityHeaders(baseFetch);

export default {
  fetch,
};
