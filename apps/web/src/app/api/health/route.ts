import { NextResponse } from "next/server";
import {
  getServiceCircuitStates,
  type CircuitState,
} from "@/lib/utils/service-circuit-breakers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check types for monitoring.
 */
interface HealthCheck {
  status: "ok" | "degraded" | "failed";
  latencyMs?: number;
  error?: string;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  threshold: number;
  lastFailure: number | null;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  timestamp: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    aiWriter: HealthCheck;
    openSeo: HealthCheck;
  };
  circuitBreakers: Record<string, CircuitBreakerState>;
  version?: string;
}

/**
 * Check database connectivity via AI-Writer backend health endpoint.
 * The AI-Writer backend has direct database access, so its health indicates DB health.
 * FIX CRITICAL-DB-002: Actually verify database connectivity instead of returning fake "ok".
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const aiWriterUrl = process.env.AI_WRITER_URL;
    if (!aiWriterUrl) {
      // If AI-Writer not configured, we can't verify database
      // Return degraded status to indicate the check couldn't run
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: "AI-Writer URL not configured - cannot verify database",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Call AI-Writer health endpoint which has direct DB access
    const response = await fetch(`${aiWriterUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        status: "failed",
        latencyMs: Date.now() - start,
        error: `Backend health check failed: HTTP ${response.status}`,
      };
    }

    // Parse response to check if database is healthy
    const healthData = await response.json();

    // AI-Writer health endpoint returns database status
    if (healthData.database === "error" || healthData.status === "unhealthy") {
      return {
        status: "failed",
        latencyMs: Date.now() - start,
        error: healthData.database_error || "Database connection failed",
      };
    }

    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "failed",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

/**
 * Check Redis connectivity.
 * Attempts a PING command to verify Redis is reachable.
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Check if Redis URL is configured
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return {
        status: "ok",
        latencyMs: 0,
        error: "Redis not configured (optional)",
      };
    }

    // Dynamic import for optional Redis dependency
    const { Redis } = await import("ioredis");
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    await redis.ping();
    await redis.quit();

    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "failed",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check AI-Writer backend connectivity.
 */
async function checkAIWriter(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const aiWriterUrl = process.env.AI_WRITER_URL;
    if (!aiWriterUrl) {
      return {
        status: "ok",
        latencyMs: 0,
        error: "AI-Writer not configured (optional)",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${aiWriterUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "failed",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check open-seo-main backend connectivity.
 * FIX H-COMM-03: Added open-seo health check to detect broken instances.
 */
async function checkOpenSeo(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const openSeoUrl = process.env.OPEN_SEO_URL;
    if (!openSeoUrl) {
      return {
        status: "ok",
        latencyMs: 0,
        error: "open-seo not configured (optional)",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${openSeoUrl}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "failed",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Comprehensive health check endpoint.
 *
 * Returns:
 * - 200: All systems healthy
 * - 503: One or more critical systems unhealthy
 *
 * SECURITY (API-H08): Circuit breaker details and internal check results
 * are only returned for authenticated requests (via X-Health-Token header).
 * Unauthenticated requests receive minimal pass/fail status only.
 *
 * Fixes HIGH-CONN-002: Missing health check endpoint.
 */
export async function GET(request: Request) {
  // Check for internal health token (for monitoring systems)
  const healthToken = request.headers.get("X-Health-Token");
  const expectedToken = process.env.HEALTH_CHECK_TOKEN;
  const isAuthenticated = expectedToken && healthToken === expectedToken;

  const [database, redis, aiWriter, openSeo] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAIWriter(),
    checkOpenSeo(),
  ]);

  const checks = { database, redis, aiWriter, openSeo };

  // Determine overall status
  // Database is critical, Redis and AI-Writer are optional
  const dbOk = database.status === "ok";
  const hasFailures = Object.values(checks).some((c) => c.status === "failed");
  const hasDegraded = Object.values(checks).some((c) => c.status === "degraded");

  let overallStatus: HealthResponse["status"];
  if (!dbOk) {
    overallStatus = "unhealthy";
  } else if (hasFailures || hasDegraded) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  // Get circuit breaker states for monitoring
  const circuitBreakers = getServiceCircuitStates();

  // Check if any circuit breaker is open (indicates service issues)
  const hasOpenCircuits = Object.values(circuitBreakers).some(
    (cb) => cb.state === "open"
  );

  // If circuits are open, degrade status (but don't fail health check)
  if (hasOpenCircuits && overallStatus === "healthy") {
    overallStatus = "degraded";
  }

  // Return 503 if database (critical) is unhealthy
  const httpStatus = dbOk ? 200 : 503;

  // SECURITY: For unauthenticated requests, return minimal info only
  // This prevents information disclosure about internal service states
  if (!isAuthenticated) {
    return NextResponse.json(
      {
        status: overallStatus,
        service: "tevero-web",
        timestamp: new Date().toISOString(),
      },
      { status: httpStatus }
    );
  }

  // Authenticated requests get full details for monitoring/debugging
  const response: HealthResponse = {
    status: overallStatus,
    service: "tevero-web",
    timestamp: new Date().toISOString(),
    checks,
    circuitBreakers,
    version: process.env.npm_package_version || process.env.NEXT_PUBLIC_APP_VERSION,
  };

  return NextResponse.json(response, { status: httpStatus });
}
