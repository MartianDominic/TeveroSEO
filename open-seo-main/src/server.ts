import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { withSecurityHeaders } from "@/server/middleware/security-headers";
import { validateEnv, REQUIRED_ENV_CORE, REQUIRED_ENV_SECURITY } from "@/server/lib/runtime-env";
import { startAuditWorker, stopAuditWorker } from "@/server/workers/audit-worker";
import {
  startAnalyticsWorker,
  stopAnalyticsWorker,
} from "@/server/workers/analytics-worker";
import { startAllWorkers } from "./worker-entry";
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
// CRITICAL: We MUST await Redis validation before starting workers to prevent race conditions.
// Workers depend on Redis being available - starting them before validation completes
// can cause silent failures or crashes.
(async () => {
  try {
    await validateRedisConnection();
    log.info("Redis connection validated at startup");
  } catch (err) {
    log.error("Redis startup validation failed", err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }

  // Start BullMQ Workers based on environment.
  // In development: start ALL workers for full functionality without needing a separate worker process.
  // In production: only start minimal workers here; full worker set runs via separate worker-entry.ts process.
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (isDevelopment) {
    // Development mode: start all 16 workers for complete queue processing
    try {
      await startAllWorkers();
      log.info("All workers started in development mode");
    } catch (err) {
      log.error("Failed to start workers in development", err instanceof Error ? err : new Error(String(err)));
    }
  } else {
    // Production mode: workers run in separate process (worker-entry.ts / open-seo-worker container)
    // Only start minimal workers here for backwards compatibility
    startAuditWorker();
    void startAnalyticsWorker();
    log.warn(
      "PRODUCTION MODE: Only AuditWorker and AnalyticsWorker started in HTTP server. " +
      "For full queue processing, ensure open-seo-worker container is running (worker-entry.ts)."
    );
  }
})();

// Start WebSocket server on separate port for real-time dashboard updates
// Validate WS_PORT to fail fast with clear error rather than silent NaN behavior
const WS_PORT_RAW = process.env.WS_PORT;
// Default to 3003 to avoid conflict with tevero-web on 3002
const WS_PORT = WS_PORT_RAW ? parseInt(WS_PORT_RAW, 10) : 3003;
if (isNaN(WS_PORT) || WS_PORT < 1 || WS_PORT > 65535) {
  throw new Error(
    `Invalid WS_PORT: "${WS_PORT_RAW}". Must be a valid port number (1-65535).`
  );
}
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
// Track unhandled rejections and exit after threshold to prevent corrupted state
const UNHANDLED_REJECTION_THRESHOLD = 10;
const UNHANDLED_REJECTION_WINDOW_MS = 60000; // 1 minute
let unhandledRejectionCount = 0;
let unhandledRejectionWindowStart = Date.now();

process.on("unhandledRejection", (reason, promise) => {
  const now = Date.now();

  // Reset counter if window has elapsed
  if (now - unhandledRejectionWindowStart > UNHANDLED_REJECTION_WINDOW_MS) {
    unhandledRejectionCount = 0;
    unhandledRejectionWindowStart = now;
  }

  unhandledRejectionCount++;

  log.error("Unhandled Rejection", reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise),
    rejectionCount: unhandledRejectionCount,
    threshold: UNHANDLED_REJECTION_THRESHOLD,
  });

  // Exit if too many unhandled rejections in the window - process may be in corrupted state
  if (unhandledRejectionCount >= UNHANDLED_REJECTION_THRESHOLD) {
    log.error("Too many unhandled rejections - initiating graceful shutdown", new Error("Rejection threshold exceeded"), {
      count: unhandledRejectionCount,
      windowMs: UNHANDLED_REJECTION_WINDOW_MS,
    });
    void shutdown("unhandledRejectionThreshold").finally(() => process.exit(1));
  }
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
