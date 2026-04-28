/**
 * Audit Run Checks API
 * Phase 40-04: T-40-04-04 - apps/web Check Proxy (P32)
 *
 * POST /api/audit/run-checks
 * Runs SEO checks against provided HTML content.
 * Used by apps/web to proxy check execution to open-seo-main.
 *
 * Security:
 * - Requires Clerk JWT authentication
 * - Rate limited to 10 requests/minute per user
 * - HTML payload limited to 5MB
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runChecks } from "@/server/lib/audit/checks/runner";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { CheckTier } from "@/server/lib/audit/checks/types";
import { createLogger } from "@/server/lib/logger";
import { metrics, recordRequestMetrics } from "@/server/lib/metrics";
import { resolveClerkContext } from "@/middleware/ensure-user/clerk";
import { AppError } from "@/server/lib/errors";
import { redis } from "@/server/lib/redis";
import { captureServerEvent } from "@/server/lib/posthog";

const log = createLogger({ module: "api/audit/run-checks" });

// Type-safe tier validation using the canonical CheckTier type
const VALID_TIERS: readonly CheckTier[] = [1, 2, 3, 4];

function isValidTier(n: number): n is CheckTier {
  return (VALID_TIERS as readonly number[]).includes(n);
}

const requestSchema = z.object({
  html: z
    .string()
    .min(100, "HTML content required (minimum 100 characters)")
    .max(5_000_000, "HTML content too large (maximum 5MB)"),
  url: z.string().url("Valid URL required"),
  keyword: z.string().optional(),
  tiers: z
    .array(z.number().refine(isValidTier, { message: "Tier must be 1, 2, 3, or 4" }))
    .optional(),
});

/**
 * Rate limiter using Redis sliding window.
 * Returns { allowed: boolean, retryAfter?: number }
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;

  // Use Redis sorted set for sliding window
  const redisKey = `ratelimit:${key}`;

  // Remove old entries outside the window
  await redis.zremrangebyscore(redisKey, 0, windowStart);

  // Count current requests in window
  const count = await redis.zcard(redisKey);

  if (count >= limit) {
    // Get oldest entry to calculate retry-after
    const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const retryAfter =
      oldest.length >= 2
        ? Math.ceil((Number(oldest[1]) + windowMs - now) / 1000)
        : windowSeconds;
    return { allowed: false, retryAfter };
  }

  // Add current request
  await redis.zadd(redisKey, now, `${now}:${crypto.randomUUID()}`);
  await redis.expire(redisKey, windowSeconds + 1);

  return { allowed: true };
}

export const Route = createFileRoute("/api/audit/run-checks")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
        let userId = "anonymous";
        let organizationId = "anonymous";
        let url: string | undefined;
        let htmlLength: number | undefined;

        try {
          // CRITICAL: Authentication
          const authContext = await resolveClerkContext(request.headers);
          userId = authContext.userId;
          organizationId = authContext.organizationId;
          const reqLog = log.child({ userId, organizationId });

          // CRITICAL: Rate limiting (10 requests/minute per user)
          const rateLimitResult = await checkRateLimit(
            `audit:${userId}`,
            10,
            60
          );

          if (!rateLimitResult.allowed) {
            metrics.increment("api.requests", { endpoint: "run-checks", status: "rate_limited" });
            reqLog.warn("Rate limit exceeded", {
              retryAfter: rateLimitResult.retryAfter,
            });
            return Response.json(
              {
                error: "Rate limit exceeded",
                retryAfter: rateLimitResult.retryAfter,
              },
              {
                status: 429,
                headers: {
                  "Retry-After": String(rateLimitResult.retryAfter),
                },
              }
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = requestSchema.safeParse(body);

          if (!parsed.success) {
            recordRequestMetrics("run-checks", startTime, "validation_error");
            reqLog.warn("Invalid request payload", {
              errors: parsed.error.issues.map((i) => i.message),
            });
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          // Capture context for error logging
          url = parsed.data.url;
          htmlLength = parsed.data.html.length;
          const { html, keyword, tiers } = parsed.data;

          // Type-safe tier handling (no assertion needed - already validated by refine)
          const tiersToRun: CheckTier[] = tiers ?? [1, 2, 3, 4];

          const results = await runChecks(html, url, {
            keyword,
            tiers: tiersToRun,
          });

          const score = calculateOnPageScore(results);
          const latencyMs = Date.now() - startTime;
          const passedCount = results.filter((r) => r.passed).length;
          const failedCount = results.filter((r) => !r.passed).length;

          // Record centralized metrics
          metrics.increment("api.checks.total", {}, results.length);
          metrics.increment("api.checks.passed", {}, passedCount);
          metrics.increment("api.checks.failed", {}, failedCount);
          recordRequestMetrics("run-checks", startTime, "success");

          // MEDIUM: Metrics tracking (PostHog event)
          await captureServerEvent({
            distinctId: userId,
            event: "audit_checks_run",
            organizationId,
            properties: {
              url,
              totalChecks: results.length,
              passedChecks: passedCount,
              failedChecks: failedCount,
              score: score.score,
              latencyMs,
              tiers: tiersToRun,
              hasKeyword: !!keyword,
            },
          });

          reqLog.info("Audit checks complete", {
            url,
            total: results.length,
            passed: passedCount,
            failed: failedCount,
            score: score.score,
            latencyMs,
          });

          return Response.json({
            findings: results,
            score,
            totalChecks: results.length,
            passedChecks: passedCount,
            failedChecks: failedCount,
          });
        } catch (error) {
          const latencyMs = Date.now() - startTime;
          recordRequestMetrics("run-checks", startTime, "error");

          // MEDIUM: Enhanced error context
          if (error instanceof AppError) {
            // Known application errors
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
              VALIDATION_ERROR: 400,
              RATE_LIMITED: 429,
            };
            const status = statusMap[error.code] ?? 500;

            log.warn("Request failed with AppError", {
              code: error.code,
              message: error.message,
              userId,
              latencyMs,
            });

            return Response.json(
              { error: error.message || error.code },
              { status }
            );
          }

          // Enhanced error logging with full request context
          log.error(
            "Audit checks failed",
            error instanceof Error ? error : new Error(String(error)),
            {
              requestId,
              userId,
              organizationId,
              url,
              htmlLength,
              latencyMs,
              errorType: error instanceof Error ? error.constructor.name : typeof error,
              stack: error instanceof Error ? error.stack : undefined,
            }
          );

          return Response.json(
            { error: "Failed to run checks" },
            { status: 500 }
          );
        }
      },
    },
  },
});
