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
import { runChecks, runTier5ChecksWithContext } from "@/server/lib/audit/checks/runner";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { CheckTier } from "@/server/lib/audit/checks/types";
import type { Vertical } from "@/server/features/onpage-mastery/types";
import { getVerticalClassifierService } from "@/server/features/onpage-mastery/services/VerticalClassifier";
import { createLogger } from "@/server/lib/logger";
import { metrics, recordRequestMetrics } from "@/server/lib/metrics";
import { resolveClerkContext } from "@/middleware/ensure-user/clerk";
import { AppError } from "@/server/lib/errors";
import { redis } from "@/server/lib/redis";
import { captureServerEvent } from "@/server/lib/posthog";

const log = createLogger({ module: "api/audit/run-checks" });

// Type-safe tier validation using the canonical CheckTier type
const VALID_TIERS: readonly CheckTier[] = [1, 2, 3, 4, 5];

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
    .array(z.number().refine(isValidTier, { message: "Tier must be 1, 2, 3, 4, or 5" }))
    .optional(),
  // Tier 5 options (optional - vertical will be auto-classified if not provided)
  vertical: z.enum([
    "healthcare", "legal", "financial", "ecommerce", "saas",
    "real_estate", "home_services", "hospitality", "education",
    "professional", "manufacturing", "nonprofit", "general"
  ]).optional(),
  clientId: z.string().optional(),
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
          const { html, keyword, tiers, vertical: providedVertical, clientId } = parsed.data;

          // Type-safe tier handling (no assertion needed - already validated by refine)
          const tiersToRun: CheckTier[] = tiers ?? [1, 2, 3, 4];
          const includesTier5 = tiersToRun.includes(5);

          // Run Tier 1-4 checks
          const tier1to4Tiers = tiersToRun.filter((t) => t !== 5) as CheckTier[];
          let results = tier1to4Tiers.length > 0
            ? await runChecks(html, url, { keyword, tiers: tier1to4Tiers })
            : [];

          // Run Tier 5 checks with vertical classification if requested
          if (includesTier5) {
            let vertical: Vertical | undefined = providedVertical;

            // Auto-classify vertical if not provided
            if (!vertical) {
              try {
                const classifier = getVerticalClassifierService();
                const domain = new URL(url).hostname;
                const path = new URL(url).pathname;
                const classification = await classifier.classify(
                  domain,
                  path,
                  html,
                  clientId ?? userId
                );
                vertical = classification.vertical;
                reqLog.debug("Auto-classified page vertical", {
                  url,
                  vertical,
                  confidence: classification.confidence,
                  method: classification.method,
                });
              } catch (classifyError) {
                reqLog.warn("Vertical classification failed, using 'general'", {
                  error: classifyError instanceof Error ? classifyError.message : String(classifyError),
                });
                vertical = "general";
              }
            }

            // Run Tier 5 checks with vertical context
            const tier5Results = await runTier5ChecksWithContext(html, url, {
              vertical,
              clientId: clientId ?? userId,
              keyword,
            });
            results = [...results, ...tier5Results];
          }

          const score = calculateOnPageScore(results);
          const latencyMs = Date.now() - startTime;
          const passedCount = results.filter((r) => r.passed).length;
          const failedCount = results.filter((r) => !r.passed).length;

          // Tier 5 quality gate evaluation
          const blockingFailures = results.filter((r) => !r.passed && r.blocking);
          const passesQualityGate = blockingFailures.length === 0;

          // Record centralized metrics
          metrics.increment("api.checks.total", {}, results.length);
          metrics.increment("api.checks.passed", {}, passedCount);
          metrics.increment("api.checks.failed", {}, failedCount);
          if (includesTier5) {
            metrics.increment("api.checks.tier5_blocked", {}, blockingFailures.length);
          }
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
              includesTier5,
              passesQualityGate,
              blockingFailures: blockingFailures.map((r) => r.checkId),
            },
          });

          reqLog.info("Audit checks complete", {
            url,
            total: results.length,
            passed: passedCount,
            failed: failedCount,
            score: score.score,
            latencyMs,
            passesQualityGate,
          });

          return Response.json({
            findings: results,
            score,
            totalChecks: results.length,
            passedChecks: passedCount,
            failedChecks: failedCount,
            // Tier 5 quality gate info
            qualityGate: includesTier5 ? {
              passes: passesQualityGate,
              blockingFailures: blockingFailures.map((r) => ({
                checkId: r.checkId,
                message: r.message,
              })),
              readyForPublish: passesQualityGate && score.score >= 80,
            } : undefined,
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
