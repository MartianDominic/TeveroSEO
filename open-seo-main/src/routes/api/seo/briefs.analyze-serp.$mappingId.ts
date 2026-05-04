/**
 * SERP analysis preview endpoint for content briefs.
 * Phase 36: Content Brief Generation
 *
 * HIGH-06-01 FIX: Added rate limiting
 * HIGH-06-03 FIX: Standardized response envelope
 * MEDIUM-06-02 FIX: Added Zod validation
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { previewSerp } from "@/server/features/briefs/services/BriefGenerator";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import {
  rateLimit,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/server/middleware/rate-limit";

const log = createLogger({ module: "api/seo/briefs/analyze-serp" });

const analyzeSerpBodySchema = z.object({
  locationCode: z.number().int().positive().optional(),
});

function successResponse<T>(data: T) {
  return { success: true, data };
}

function errorResponse(error: string) {
  return { success: false, error };
}

async function extractRateLimitKey(request: Request): Promise<string> {
  const clientId = request.headers.get("X-Client-ID");
  if (clientId) return clientId;
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return `ip:${forwarded.split(",")[0].trim()}`;
  return "anonymous";
}

export const Route = createFileRoute("/api/seo/briefs/analyze-serp/$mappingId")({
  server: {
    handlers: {
      /**
       * POST /api/seo/briefs/analyze-serp/:mappingId
       * Returns SERP analysis without creating a brief.
       *
       * Body: { locationCode? }
       */
      POST: async ({ request, params }: { request: Request; params: { mappingId: string } }) => {
        try {
          // HIGH-06-01: Apply rate limiting for SERP analysis
          const rateLimitKey = await extractRateLimitKey(request);
          const rateLimitResult = await rateLimit({
            key: `${RATE_LIMITS.SERP_ANALYZE.keyPrefix}${rateLimitKey}`,
            limit: RATE_LIMITS.SERP_ANALYZE.limit,
            window: RATE_LIMITS.SERP_ANALYZE.window,
          });

          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          await requireApiAuth(request);

          // Validate client ownership
          const clientId = await resolveClientId(request.headers, request.url);
          if (!clientId) {
            return Response.json(
              errorResponse("client_id header or query parameter is required"),
              { status: 400 },
            );
          }

          const { mappingId } = params;

          // MEDIUM-06-02: Parse and validate with Zod
          let rawBody: unknown = {};
          try {
            rawBody = await request.json();
          } catch {
            // Empty body is valid, use defaults
          }

          const validation = analyzeSerpBodySchema.safeParse(rawBody);
          const locationCode = validation.success ? validation.data.locationCode ?? 2840 : 2840;

          const analysis = await previewSerp(clientId, mappingId, locationCode);
          return addRateLimitHeaders(
            Response.json(successResponse(analysis)),
            rateLimitResult
          );
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(errorResponse(error.message), { status });
          }
          log.error(
            "POST error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(errorResponse("Internal server error"), { status: 500 });
        }
      },
    },
  },
});
