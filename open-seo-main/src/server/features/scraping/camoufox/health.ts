/**
 * Health check and metrics server for CamoufoxPool
 *
 * Exposes:
 * - GET /healthz - Health check endpoint
 * - GET /ready - Readiness probe
 * - GET /metrics - Prometheus metrics
 */

import http from "http";
import type { CamoufoxPool, PoolMetrics } from "./pool";

// ============================================================================
// Types
// ============================================================================

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  pool: {
    totalInstances: number;
    healthyInstances: number;
    activeRequests: number;
    queueDepth: number;
    memoryUsedGB: number;
  };
  system: {
    memoryUsedPercent: number;
    heapUsedMB: number;
    heapTotalMB: number;
  };
}

// ============================================================================
// Health Server
// ============================================================================

export function createHealthServer(
  pool: CamoufoxPool,
  port: number
): http.Server {
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    // CORS headers for local development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");

    if (req.url === "/healthz" || req.url === "/health") {
      const health = buildHealthStatus(pool, startTime);
      const statusCode =
        health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health, null, 2));
      return;
    }

    if (req.url === "/ready") {
      const metrics = pool.getMetrics();
      const ready = metrics.totalInstances >= 5 && metrics.healthyInstances >= 3;

      res.writeHead(ready ? 200 : 503, { "Content-Type": "text/plain" });
      res.end(ready ? "ready" : "not ready");
      return;
    }

    if (req.url === "/metrics") {
      const metricsOutput = buildPrometheusMetrics(pool, startTime);

      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(metricsOutput);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[CamoufoxHealth] Health server listening on port ${port}`);
  });

  return server;
}

// ============================================================================
// Health Status Builder
// ============================================================================

function buildHealthStatus(pool: CamoufoxPool, startTime: number): HealthStatus {
  const metrics = pool.getMetrics();
  const memInfo = process.memoryUsage();

  const healthyPercent =
    metrics.totalInstances > 0
      ? (metrics.healthyInstances / metrics.totalInstances) * 100
      : 0;

  let status: "healthy" | "degraded" | "unhealthy";
  if (healthyPercent >= 90 && metrics.queueDepth < 100) {
    status = "healthy";
  } else if (healthyPercent >= 70 && metrics.queueDepth < 300) {
    status = "degraded";
  } else {
    status = "unhealthy";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    pool: {
      totalInstances: metrics.totalInstances,
      healthyInstances: metrics.healthyInstances,
      activeRequests: metrics.activeRequests,
      queueDepth: metrics.queueDepth,
      memoryUsedGB: metrics.memoryUsedGB,
    },
    system: {
      memoryUsedPercent: (memInfo.heapUsed / memInfo.heapTotal) * 100,
      heapUsedMB: memInfo.heapUsed / (1024 * 1024),
      heapTotalMB: memInfo.heapTotal / (1024 * 1024),
    },
  };
}

// ============================================================================
// Prometheus Metrics Builder
// ============================================================================

function buildPrometheusMetrics(pool: CamoufoxPool, startTime: number): string {
  const metrics = pool.getMetrics();
  const memInfo = process.memoryUsage();
  const uptime = (Date.now() - startTime) / 1000;

  const lines = [
    // Uptime
    "# HELP camoufox_uptime_seconds Pool uptime in seconds",
    "# TYPE camoufox_uptime_seconds gauge",
    `camoufox_uptime_seconds ${uptime}`,
    "",

    // Instance metrics
    "# HELP camoufox_instances_total Total browser instances",
    "# TYPE camoufox_instances_total gauge",
    `camoufox_instances_total ${metrics.totalInstances}`,
    "",

    "# HELP camoufox_instances_healthy Healthy browser instances",
    "# TYPE camoufox_instances_healthy gauge",
    `camoufox_instances_healthy ${metrics.healthyInstances}`,
    "",

    // Request metrics
    "# HELP camoufox_requests_active Active scraping requests",
    "# TYPE camoufox_requests_active gauge",
    `camoufox_requests_active ${metrics.activeRequests}`,
    "",

    "# HELP camoufox_queue_depth Requests waiting in queue",
    "# TYPE camoufox_queue_depth gauge",
    `camoufox_queue_depth ${metrics.queueDepth}`,
    "",

    "# HELP camoufox_requests_total Total requests processed",
    "# TYPE camoufox_requests_total counter",
    `camoufox_requests_total ${metrics.totalRequests}`,
    "",

    "# HELP camoufox_requests_success Successful requests",
    "# TYPE camoufox_requests_success counter",
    `camoufox_requests_success ${metrics.successfulRequests}`,
    "",

    "# HELP camoufox_requests_failed Failed requests",
    "# TYPE camoufox_requests_failed counter",
    `camoufox_requests_failed ${metrics.failedRequests}`,
    "",

    // Latency
    "# HELP camoufox_response_time_avg Average response time in ms",
    "# TYPE camoufox_response_time_avg gauge",
    `camoufox_response_time_avg ${metrics.avgResponseTimeMs.toFixed(2)}`,
    "",

    // Memory
    "# HELP camoufox_memory_pool_gb Memory used by browser pool in GB",
    "# TYPE camoufox_memory_pool_gb gauge",
    `camoufox_memory_pool_gb ${metrics.memoryUsedGB.toFixed(3)}`,
    "",

    "# HELP camoufox_memory_process_heap_bytes Node.js heap memory",
    "# TYPE camoufox_memory_process_heap_bytes gauge",
    `camoufox_memory_process_heap_bytes ${memInfo.heapUsed}`,
    "",

    "# HELP camoufox_memory_process_rss_bytes Node.js RSS memory",
    "# TYPE camoufox_memory_process_rss_bytes gauge",
    `camoufox_memory_process_rss_bytes ${memInfo.rss}`,
    "",

    // Success rate (calculated)
    "# HELP camoufox_success_rate Request success rate (0-1)",
    "# TYPE camoufox_success_rate gauge",
    `camoufox_success_rate ${
      metrics.totalRequests > 0
        ? (metrics.successfulRequests / metrics.totalRequests).toFixed(4)
        : "1"
    }`,
    "",

    // Health status as gauge
    "# HELP camoufox_health Pool health status (1=healthy, 0.5=degraded, 0=unhealthy)",
    "# TYPE camoufox_health gauge",
    `camoufox_health ${
      metrics.healthyInstances / Math.max(1, metrics.totalInstances) >= 0.9 ? 1 :
      metrics.healthyInstances / Math.max(1, metrics.totalInstances) >= 0.7 ? 0.5 : 0
    }`,
  ];

  return lines.join("\n") + "\n";
}

// ============================================================================
// CLI Entry Point
// ============================================================================

// This file can be run standalone as a metrics server if pool exposes metrics via Redis
// For now, it's designed to be imported and used with a pool instance
