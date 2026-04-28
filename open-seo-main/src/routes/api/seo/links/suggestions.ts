/**
 * Link Suggestions API for AI-Writer Integration
 * Phase 40-04: T-40-04-01 - Link Suggestions API (P35/P39)
 *
 * POST /api/seo/links/suggestions
 * Returns auto-applicable link suggestions for content generation.
 *
 * Security:
 * - Requires authentication via Authorization header (Clerk JWT) or X-Client-ID
 * - Validates clientId access through resolveClientId
 * - Content size limited to prevent DoS
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { linkSuggestions } from "@/db/link-schema";
import { VelocityService } from "@/server/features/linking/services/VelocityService";
import { eq, and, gte, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { metrics, recordRequestMetrics } from "@/server/lib/metrics";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";

// =============================================================================
// Constants
// =============================================================================

/** Minimum confidence threshold for anchor text matching */
const ANCHOR_CONFIDENCE_THRESHOLD = 0.85;

/** Maximum content size in characters (5MB) */
const MAX_CONTENT_SIZE = 5_000_000;

/** Minimum content size in characters */
const MIN_CONTENT_SIZE = 100;

// =============================================================================
// Cached Services
// =============================================================================

/** Module-level cached VelocityService instance */
let cachedVelocityService: VelocityService | null = null;

/**
 * Get or create cached VelocityService instance.
 * Avoids instantiation overhead per request.
 */
function getVelocityService(): VelocityService {
  if (!cachedVelocityService) {
    cachedVelocityService = new VelocityService(db);
  }
  return cachedVelocityService;
}

// =============================================================================
// Logger
// =============================================================================

const log = createLogger({ module: "api/seo/links/suggestions" });

// =============================================================================
// Request Schema (with payload size limit)
// =============================================================================

const requestSchema = z.object({
  clientId: z.string().min(1, "clientId required"),
  content: z
    .string()
    .min(MIN_CONTENT_SIZE, `Content must be at least ${MIN_CONTENT_SIZE} characters`)
    .max(MAX_CONTENT_SIZE, `Content must not exceed ${MAX_CONTENT_SIZE} characters`),
  keyword: z.string().optional(),
  maxLinks: z.number().min(1).max(10).default(7),
});

// =============================================================================
// Response Types
// =============================================================================

interface LinkSuggestionResponse {
  anchorText: string;
  targetUrl: string;
  confidence: number;
  method: string;
  position: string | null;
}

interface SuggestionsResponse {
  links: LinkSuggestionResponse[];
  totalSuggestions: number;
  autoApplicable: number;
  remainingQuota: number;
  reason?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize text for Unicode-safe anchor matching.
 * Handles diacritics, case, punctuation variants, and whitespace.
 *
 * - NFD decomposition separates base characters from combining marks
 * - Diacritic removal: "cafe" matches "cafe"
 * - Smart quote normalization: ' vs '
 * - Dash normalization: - vs -
 * - Ellipsis normalization: ... vs ...
 * - Whitespace normalization: multiple spaces become single space
 */
function normalizeForMatching(text: string): string {
  return (
    text
      .toLowerCase()
      // NFD decomposition separates base characters from combining marks (diacritics)
      .normalize("NFD")
      // Remove combining diacritical marks (Unicode range U+0300 to U+036F)
      .replace(/[̀-ͯ]/g, "")
      // Normalize smart quotes to straight quotes
      .replace(/[‘’‚‛]/g, "'") // Single quotes
      .replace(/[“”„‟]/g, '"') // Double quotes
      // Normalize dashes (en-dash, em-dash) to hyphen
      .replace(/[–—]/g, "-")
      // Normalize ellipsis to three dots
      .replace(/…/g, "...")
      // Normalize whitespace (multiple spaces, tabs, newlines -> single space)
      .replace(/\s+/g, " ")
      .trim()
  );
}

// =============================================================================
// Route Handler
// =============================================================================

export const Route = createFileRoute("/api/seo/links/suggestions")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
        let clientId: string | undefined;
        let contentLength: number | undefined;

        try {
          // ---------------------------------------------------------------------
          // 1. Authentication - validate JWT/API key
          // ---------------------------------------------------------------------
          const auth = await requireApiAuth(request);

          // ---------------------------------------------------------------------
          // 2. Authorization - resolve and validate clientId from headers/URL
          // resolveClientId throws AppError("FORBIDDEN") if clientId is invalid
          // ---------------------------------------------------------------------
          const resolvedClientId = await resolveClientId(request.headers, request.url);

          // ---------------------------------------------------------------------
          // 3. Parse and validate request body
          // ---------------------------------------------------------------------
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = requestSchema.safeParse(body);

          if (!parsed.success) {
            recordRequestMetrics("suggestions", startTime, "validation_error");
            log.warn("Invalid request payload", {
              errors: parsed.error.issues,
              resolvedClientId,
            });
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          clientId = parsed.data.clientId;
          contentLength = parsed.data.content.length;

          // ---------------------------------------------------------------------
          // 4. Authorization - verify clientId in body matches resolved clientId
          // This prevents clients from accessing other clients' data
          // ---------------------------------------------------------------------
          if (resolvedClientId && resolvedClientId !== clientId) {
            recordRequestMetrics("suggestions", startTime, "error", { clientId });
            log.warn("Client ID mismatch", {
              clientId,
              resolvedClientId,
              contentLength,
              userId: auth.userId,
            });
            return Response.json(
              { error: "Forbidden: clientId mismatch" },
              { status: 403 }
            );
          }

          // If no clientId was resolved from headers/URL, require it to be validated
          if (!resolvedClientId) {
            recordRequestMetrics("suggestions", startTime, "error", { clientId });
            log.warn("Client access denied - no resolved clientId", {
              clientId,
              contentLength,
              userId: auth.userId,
            });
            return Response.json(
              { error: "Forbidden: X-Client-ID header required" },
              { status: 403 }
            );
          }

          const { content, maxLinks } = parsed.data;

          // ---------------------------------------------------------------------
          // 5. Normalize content for Unicode-safe matching
          // ---------------------------------------------------------------------
          const contentNormalized = normalizeForMatching(content);

          // ---------------------------------------------------------------------
          // 6. Check velocity limits using cached service
          // ---------------------------------------------------------------------
          const velocityService = getVelocityService();
          const stats = await velocityService.getVelocityStats(clientId);
          const remaining = stats.limits.maxNewLinksPerDay - stats.linksToday;

          if (remaining <= 0) {
            metrics.increment("api.suggestions.quota_exhausted", { clientId });
            recordRequestMetrics("suggestions", startTime, "success", { clientId });

            const response: SuggestionsResponse = {
              links: [],
              totalSuggestions: 0,
              autoApplicable: 0,
              remainingQuota: 0,
              reason: "Daily link insertion quota exhausted",
            };

            log.info("Link quota exhausted", {
              clientId,
              contentLength,
              linksToday: stats.linksToday,
            });

            return Response.json(response);
          }

          // ---------------------------------------------------------------------
          // 7. Fetch pending auto-applicable suggestions above confidence threshold
          // ---------------------------------------------------------------------
          const suggestions = await db
            .select()
            .from(linkSuggestions)
            .where(
              and(
                eq(linkSuggestions.clientId, clientId),
                eq(linkSuggestions.status, "pending"),
                eq(linkSuggestions.isAutoApplicable, true),
                gte(linkSuggestions.anchorConfidence, ANCHOR_CONFIDENCE_THRESHOLD)
              )
            )
            .orderBy(desc(linkSuggestions.score))
            .limit(50);

          // ---------------------------------------------------------------------
          // 8. Filter suggestions that match content with Unicode normalization
          // ---------------------------------------------------------------------
          const applicableLinks: LinkSuggestionResponse[] = [];

          for (const suggestion of suggestions) {
            if (applicableLinks.length >= Math.min(maxLinks, remaining)) {
              break;
            }

            const anchorNormalized = normalizeForMatching(suggestion.anchorText);
            if (contentNormalized.includes(anchorNormalized)) {
              applicableLinks.push({
                anchorText: suggestion.anchorText,
                targetUrl: suggestion.targetUrl,
                confidence: suggestion.anchorConfidence ?? ANCHOR_CONFIDENCE_THRESHOLD,
                method: suggestion.insertionMethod ?? "wrap_existing",
                position: suggestion.existingTextMatch,
              });
            }
          }

          const response: SuggestionsResponse = {
            links: applicableLinks,
            totalSuggestions: suggestions.length,
            autoApplicable: applicableLinks.length,
            remainingQuota: remaining - applicableLinks.length,
          };

          // Record endpoint-specific metrics
          metrics.increment("api.suggestions.total_suggestions", { clientId }, suggestions.length);
          metrics.increment("api.suggestions.links_returned", { clientId }, applicableLinks.length);
          recordRequestMetrics("suggestions", startTime, "success", { clientId });

          log.info("Link suggestions returned", {
            clientId,
            contentLength,
            total: suggestions.length,
            applicable: applicableLinks.length,
            latencyMs: Date.now() - startTime,
          });

          return Response.json(response);
        } catch (error) {
          // Handle known AppError types with appropriate status codes
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "NOT_FOUND"
                    ? 404
                    : 400;

            recordRequestMetrics("suggestions", startTime, "error", { clientId });
            log.warn("Request failed with AppError", {
              clientId,
              contentLength,
              errorCode: error.code,
              errorMessage: error.message,
              latencyMs: Date.now() - startTime,
            });

            return Response.json({ error: error.message }, { status });
          }

          // Enhanced error logging with full request context
          recordRequestMetrics("suggestions", startTime, "error", { clientId });
          log.error(
            "Link suggestions failed",
            error instanceof Error ? error : new Error(String(error)),
            {
              requestId,
              clientId,
              contentLength,
              latencyMs: Date.now() - startTime,
              errorType: error instanceof Error ? error.constructor.name : typeof error,
              stack: error instanceof Error ? error.stack : undefined,
            }
          );

          return Response.json(
            { error: "Failed to get link suggestions" },
            { status: 500 }
          );
        }
      },
    },
  },
});
