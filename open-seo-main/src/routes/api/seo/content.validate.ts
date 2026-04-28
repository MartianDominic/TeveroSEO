/**
 * Content Validation API
 * Phase 40: Gap Closure - Content validation with 107 SEO checks
 *
 * POST /api/seo/content/validate
 * Validates HTML content against SEO checks (Tier 1 and 2 only, no external APIs)
 *
 * Request: { html: string, keyword: string, url?: string }
 * Response: { score, breakdown, findings, approved, totalChecks, failedChecks }
 *
 * Security:
 * - Requires authentication via Clerk JWT or X-Client-ID header
 * - Rate limited: 10 requests/minute per client
 * - Payload size limited to 5MB
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runLocalChecks } from "@/server/lib/audit/checks/runner";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { CheckResult } from "@/server/lib/audit/checks/types";
import { createLogger } from "@/server/lib/logger";
import { metrics as centralMetrics, recordRequestMetrics } from "@/server/lib/metrics";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { redis } from "@/server/lib/redis";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/seo/content/validate" });

// Configuration from environment with sensible defaults
const QUALITY_THRESHOLD = parseInt(process.env.SEO_QUALITY_THRESHOLD ?? "80", 10);
const RATE_LIMIT_MAX = 10; // requests per window
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window

// Payload size limits: min 100 chars, max 5MB
const MAX_HTML_SIZE = 5_000_000;

const validateRequestSchema = z.object({
  html: z
    .string()
    .min(100, "HTML content must be at least 100 characters")
    .max(MAX_HTML_SIZE, `HTML content must not exceed ${MAX_HTML_SIZE} characters`),
  keyword: z.string().min(1, "Keyword is required"),
  url: z.string().url().optional(),
});

// Metrics tracking - simple in-memory counters with periodic logging
// In production, this would be replaced with Prometheus/StatsD
interface ValidationMetrics {
  totalValidations: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  totalScore: number;
  lastResetAt: number;
}

const metrics: ValidationMetrics = {
  totalValidations: 0,
  passCount: 0,
  failCount: 0,
  errorCount: 0,
  totalScore: 0,
  lastResetAt: Date.now(),
};

// Log metrics every 100 validations or every 5 minutes
function recordMetric(score: number, approved: boolean, isError = false): void {
  metrics.totalValidations++;
  if (isError) {
    metrics.errorCount++;
  } else if (approved) {
    metrics.passCount++;
    metrics.totalScore += score;
  } else {
    metrics.failCount++;
    metrics.totalScore += score;
  }

  const fiveMinutes = 5 * 60 * 1000;
  const shouldLogMetrics =
    metrics.totalValidations % 100 === 0 ||
    Date.now() - metrics.lastResetAt > fiveMinutes;

  if (shouldLogMetrics && metrics.totalValidations > 0) {
    const avgScore = metrics.totalScore / (metrics.passCount + metrics.failCount || 1);
    const passRate = ((metrics.passCount / metrics.totalValidations) * 100).toFixed(1);
    log.info("Content validation metrics", {
      totalValidations: metrics.totalValidations,
      passCount: metrics.passCount,
      failCount: metrics.failCount,
      errorCount: metrics.errorCount,
      averageScore: Math.round(avgScore * 100) / 100,
      passRate: `${passRate}%`,
    });
    metrics.lastResetAt = Date.now();
  }
}

/**
 * Rate limit check using Redis sliding window.
 * @param identifier - Client or user identifier for rate limiting
 * @returns true if request is allowed, false if rate limited
 */
async function checkRateLimit(identifier: string): Promise<boolean> {
  const key = `rate:content-validate:${identifier}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS * 1000;

  // Use Redis transaction for atomic operations
  const multi = redis.multi();

  // Remove old entries outside the window
  multi.zremrangebyscore(key, 0, windowStart);

  // Count requests in current window
  multi.zcard(key);

  // Add current request
  multi.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);

  // Set TTL to auto-cleanup
  multi.expire(key, RATE_LIMIT_WINDOW_SECONDS + 10);

  const results = await multi.exec();
  if (!results) {
    // Redis transaction failed, allow request but log warning
    log.warn("Rate limit check failed, allowing request", { identifier });
    return true;
  }

  // Second result is the count before adding current request
  const currentCount = results[1]?.[1] as number | undefined;
  return (currentCount ?? 0) < RATE_LIMIT_MAX;
}

export interface ContentValidationResponse {
  score: number;
  breakdown: {
    base: number;
    tier1: number;
    tier2: number;
    tier3: number;
  };
  gates: string[];
  findings: Array<{
    checkId: string;
    passed: boolean;
    severity: string;
    message: string;
    editRecipe?: string;
  }>;
  approved: boolean;
  totalChecks: number;
  failedChecks: number;
}

// Route path: /api/seo/content/validate (file path dots become slashes in URL)
export const Route = createFileRoute("/api/seo/content/validate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Create request-scoped logger for error context
        const requestLog = log.child({ requestId: crypto.randomUUID() });
        const startTime = Date.now();
        // Track context for error logging
        let clientId: string | undefined;
        let keyword: string | undefined;
        let htmlLength: number | undefined;

        try {
          // 1. Authentication check
          const auth = await requireApiAuth(request);
          clientId = (await resolveClientId(request.headers, request.url)) ?? undefined;

          // Use clientId for rate limiting if available, otherwise fall back to userId
          const rateLimitKey = clientId ?? auth.userId;

          // 2. Rate limiting check
          const allowed = await checkRateLimit(rateLimitKey);
          if (!allowed) {
            centralMetrics.increment("api.requests", { endpoint: "content.validate", status: "rate_limited" });
            requestLog.warn("Rate limit exceeded", {
              clientId,
              userId: auth.userId,
            });
            return Response.json(
              { error: "Rate limit exceeded. Maximum 10 requests per minute." },
              { status: 429 }
            );
          }

          // 3. Parse and validate request body
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = validateRequestSchema.safeParse(body);

          if (!parsed.success) {
            recordRequestMetrics("content.validate", startTime, "validation_error");
            requestLog.warn("Invalid request payload", {
              issues: parsed.error.issues,
              clientId,
            });
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          // Capture context for error logging
          keyword = parsed.data.keyword;
          htmlLength = parsed.data.html.length;
          const { html, url } = parsed.data;
          const checkUrl = url || "https://example.com/generated-content";

          // 4. Run Tier 1 and Tier 2 checks (no external API dependencies)
          const results = await runLocalChecks(html, checkUrl, keyword);

          // 5. Calculate score with gates
          const scoreResult = calculateOnPageScore(results);

          // 6. Filter failed checks for findings
          const failedChecks = results.filter((r: CheckResult) => !r.passed);

          const response: ContentValidationResponse = {
            score: scoreResult.score,
            breakdown: scoreResult.breakdown,
            gates: scoreResult.gates,
            findings: failedChecks.map((f: CheckResult) => ({
              checkId: f.checkId,
              passed: f.passed,
              severity: f.severity,
              message: f.message,
              editRecipe: f.editRecipe,
            })),
            approved: scoreResult.score >= QUALITY_THRESHOLD,
            totalChecks: results.length,
            failedChecks: failedChecks.length,
          };

          // 7. Record metrics and log success
          centralMetrics.increment("api.validation.total_checks", {}, results.length);
          centralMetrics.increment("api.validation.failed_checks", {}, failedChecks.length);
          centralMetrics.increment(
            response.approved ? "api.validation.approved" : "api.validation.rejected",
            {}
          );
          recordRequestMetrics("content.validate", startTime, "success");
          recordMetric(scoreResult.score, response.approved);

          requestLog.info("Content validation complete", {
            score: scoreResult.score,
            approved: response.approved,
            totalChecks: results.length,
            failedChecks: failedChecks.length,
            keyword,
            clientId,
            userId: auth.userId,
          });

          return Response.json(response);
        } catch (error) {
          // Record error metric
          recordRequestMetrics("content.validate", startTime, "error");
          recordMetric(0, false, true);

          // Handle known error types with appropriate status codes
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "VALIDATION_ERROR"
                    ? 400
                    : 500;

            requestLog.warn("Request rejected", {
              errorCode: error.code,
              errorMessage: error.message,
            });

            return Response.json({ error: error.message }, { status });
          }

          // Enhanced error logging with full request context
          requestLog.error(
            "Content validation failed",
            error instanceof Error ? error : new Error(String(error)),
            {
              clientId,
              keyword,
              htmlLength,
              latencyMs: Date.now() - startTime,
              errorType: error instanceof Error ? error.constructor.name : typeof error,
              stack: error instanceof Error ? error.stack : undefined,
            }
          );

          return Response.json(
            { error: "Content validation failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});
