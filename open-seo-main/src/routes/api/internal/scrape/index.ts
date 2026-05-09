/**
 * Internal Scraping API - Single URL Scrape
 * Phase 95: HTTP bridge for AI-Writer to use unified ScrapingService
 *
 * POST /api/internal/scrape - Single URL scrape
 * GET /api/internal/scrape - Health check for internal API
 *
 * Authentication: x-internal-api-key header (INTERNAL_API_KEY)
 */

import { createFileRoute } from "@tanstack/react-router";
import { scrapingService } from "@/server/features/scraping";
import { logger } from "@/server/features/scraping/logging";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

// =============================================================================
// Validation Schemas
// =============================================================================

const VALID_TIERS = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'] as const;

const ScrapeRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  options: z.object({
    maxTier: z.enum(VALID_TIERS).optional(),
    startTier: z.enum(VALID_TIERS).optional(),
    forceTier: z.enum(VALID_TIERS).optional(),
    feature: z.string().max(50).optional(),
    clientId: z.string().max(100).optional(),
    skipCache: z.boolean().optional(),
    timeoutMs: z.number().int().positive().max(60000).optional(),
    includeParsedData: z.boolean().optional(),
    includeHtml: z.boolean().optional(),
  }).optional(),
});

// =============================================================================
// Authentication
// =============================================================================

function timingSafeCompare(provided: string, expected: string): boolean {
  const maxLength = Math.max(provided.length, expected.length);
  const paddedProvided = provided.padEnd(maxLength, '\0');
  const paddedExpected = expected.padEnd(maxLength, '\0');

  const providedBuffer = Buffer.from(paddedProvided, 'utf-8');
  const expectedBuffer = Buffer.from(paddedExpected, 'utf-8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return (
    timingSafeEqual(providedBuffer, expectedBuffer) &&
    provided.length === expected.length
  );
}

function validateInternalApiKey(request: Request): { success: true } | { success: false; error: string; statusCode: number } {
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
    logger.error({}, 'INTERNAL_API_KEY not configured - internal API disabled');
    return {
      success: false,
      error: 'Internal API not configured',
      statusCode: 503,
    };
  }

  const providedKey = request.headers.get('x-internal-api-key');

  if (!providedKey) {
    return {
      success: false,
      error: 'Missing internal API key',
      statusCode: 401,
    };
  }

  if (!timingSafeCompare(providedKey, internalApiKey)) {
    logger.warn({ ip: 'unknown' }, 'Invalid internal API key attempted');
    return {
      success: false,
      error: 'Invalid internal API key',
      statusCode: 401,
    };
  }

  return { success: true };
}

// =============================================================================
// Rate Limiting (Simple in-memory)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 100;

function checkRateLimit(clientId: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  let entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(clientId, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return { allowed: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/internal/scrape/")({
  server: {
    handlers: {
      /**
       * GET /api/internal/scrape/
       *
       * Health check for internal API (no auth required).
       */
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'scraping-internal-api',
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },

      /**
       * POST /api/internal/scrape/
       *
       * Scrape a single URL using the unified ScrapingService.
       */
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();

        // Validate internal API key
        const auth = validateInternalApiKey(request);
        if (!auth.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: auth.error,
              timestamp: new Date().toISOString(),
            }),
            { status: auth.statusCode, headers: { "Content-Type": "application/json" } }
          );
        }

        // Parse body
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Invalid JSON body',
              timestamp: new Date().toISOString(),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate request
        const validation = ScrapeRequestSchema.safeParse(body);
        if (!validation.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Validation failed',
              details: validation.error.issues.map((issue) => ({
                field: issue.path.join('.') || 'body',
                message: issue.message,
              })),
              timestamp: new Date().toISOString(),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const { url, options } = validation.data;
        const clientId = options?.clientId ?? 'ai-writer';

        // Rate limit check
        const rateLimit = checkRateLimit(clientId);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Rate limit exceeded',
              retryAfterSeconds: rateLimit.retryAfterSeconds,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(rateLimit.retryAfterSeconds),
              },
            }
          );
        }

        try {
          const result = await scrapingService.scrape(url, {
            maxTier: options?.maxTier,
            startTier: options?.startTier,
            forceTier: options?.forceTier,
            feature: (options?.feature ?? 'ai-writer') as any,
            clientId,
            skipCache: options?.skipCache,
            timeoutMs: options?.timeoutMs,
            includeParsedData: options?.includeParsedData,
            includeHtml: options?.includeHtml ?? true,
          });

          const response = {
            success: result.success,
            html: result.html,
            error: result.error,
            metadata: {
              tierUsed: result.tierUsed,
              fromCache: result.fromCache,
              cacheLevel: result.cacheLevel,
              costUsd: result.estimatedCostUsd,
              responseTimeMs: result.responseTimeMs,
              statusCode: result.statusCode,
              responseSizeBytes: result.responseSizeBytes,
              parsedData: result.parsedData ? {
                title: result.parsedData.title,
                metaDescription: result.parsedData.metaDescription,
                h1: result.parsedData.h1,
                canonical: result.parsedData.canonical,
                wordCount: result.parsedData.wordCount,
              } : undefined,
            },
          };

          logger.info({
            url,
            tierUsed: result.tierUsed,
            fromCache: result.fromCache,
            costUsd: result.estimatedCostUsd,
            durationMs: Date.now() - startTime,
            feature: options?.feature ?? 'ai-writer',
            clientId,
          }, 'Internal scrape completed');

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          logger.error({
            url,
            error: errorMessage,
            durationMs: Date.now() - startTime,
            feature: options?.feature ?? 'ai-writer',
          }, 'Internal scrape failed');

          return new Response(
            JSON.stringify({
              success: false,
              error: errorMessage,
              metadata: {
                tierUsed: 'direct',
                fromCache: false,
                costUsd: 0,
                responseTimeMs: Date.now() - startTime,
                statusCode: 0,
                responseSizeBytes: 0,
              },
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
