/**
 * Internal API endpoint for AI-Writer content insights.
 *
 * Provides P96 analytics insights for AI-Writer content workflows:
 * - brief: Trending topics, content gaps for brief generation
 * - voice: Top-performing content for voice analysis
 * - optimization: Striking distance keywords for SEO optimization
 * - check: Pre-publish cannibalization detection
 *
 * SECURITY: Protected by HMAC-signed requests (X-Internal-Signature + X-Internal-Timestamp).
 * This endpoint is for internal service-to-service communication only.
 *
 * Usage from AI-Writer:
 * ```python
 * import hmac
 * import hashlib
 * import time
 * import requests
 *
 * def get_content_insights(client_id: str, site_id: str, insight_type: str):
 *     timestamp = str(int(time.time() * 1000))
 *     payload = json.dumps({
 *         "clientId": client_id,
 *         "siteId": site_id,
 *         "insightType": insight_type
 *     })
 *
 *     signature = hmac.new(
 *         INTERNAL_API_KEY.encode(),
 *         f"{timestamp}.{payload}".encode(),
 *         hashlib.sha256
 *     ).hexdigest()
 *
 *     response = requests.post(
 *         "http://localhost:3001/api/internal/analytics/content-insights",
 *         headers={
 *             "Content-Type": "application/json",
 *             "X-Internal-Signature": signature,
 *             "X-Internal-Timestamp": timestamp,
 *             "X-Source-Service": "ai-writer"
 *         },
 *         data=payload
 *     )
 *     return response.json()
 * ```
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { requireInternalAuth } from "@/server/middleware/internal-auth";
import {
  getContentInsightsService,
  type ContentBriefInsights,
  type VoiceInsights,
  type OptimizationInsights,
  type PrePublishCheck,
} from "@/server/features/analytics/services/ContentInsightsService";

const log = createLogger({ module: "api/internal/analytics/content-insights" });

/**
 * Request schema for content insights endpoint
 */
const requestSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  siteId: z.string().uuid("siteId must be a valid UUID"),
  insightType: z.enum(["brief", "voice", "optimization", "check"]),
  targetKeywords: z.array(z.string()).optional(), // Required for 'check' type
});

/**
 * Response type discriminated by insight type
 */
type ContentInsightsResponse =
  | { success: true; type: "brief"; data: ContentBriefInsights }
  | { success: true; type: "voice"; data: VoiceInsights }
  | { success: true; type: "optimization"; data: OptimizationInsights }
  | { success: true; type: "check"; data: PrePublishCheck }
  | { success: false; error: string; details?: unknown };

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/internal/analytics/content-insights")({
  server: {
    handlers: {
      /**
       * POST /api/internal/analytics/content-insights
       *
       * Get P96 analytics insights for AI-Writer content workflows.
       *
       * Request Body:
       * - clientId: string (UUID) - The client/workspace ID
       * - siteId: string (UUID) - The GSC site ID
       * - insightType: "brief" | "voice" | "optimization" | "check"
       * - targetKeywords: string[] (optional) - Required for "check" type
       *
       * Response:
       * - success: boolean
       * - type: InsightType
       * - data: Insights specific to the requested type
       */
      POST: async ({ request }: { request: Request }): Promise<Response> => {
        // Clone request to read body for signature verification
        const clonedRequest = request.clone();
        let bodyText = "";
        try {
          bodyText = await clonedRequest.text();
        } catch {
          // Empty body will be caught by validation
        }

        // Verify internal auth using HMAC signature
        const authError = await requireInternalAuth(request, bodyText);
        if (authError) {
          return authError;
        }

        // Parse and validate request body
        let body: z.infer<typeof requestSchema>;
        try {
          const parsed = JSON.parse(bodyText || "{}");
          body = requestSchema.parse(parsed);
        } catch (error) {
          if (error instanceof z.ZodError) {
            log.warn("Invalid request body", { errors: error.flatten() });
            return Response.json(
              {
                success: false,
                error: "Invalid request",
                details: error.flatten(),
              } satisfies ContentInsightsResponse,
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          log.warn("Failed to parse request body");
          return Response.json(
            {
              success: false,
              error: "Invalid JSON in request body",
            } satisfies ContentInsightsResponse,
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const { clientId, siteId, insightType, targetKeywords } = body;

        // Validate targetKeywords is provided for 'check' type
        if (insightType === "check" && (!targetKeywords || targetKeywords.length === 0)) {
          return Response.json(
            {
              success: false,
              error: "targetKeywords required for 'check' insight type",
            } satisfies ContentInsightsResponse,
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const service = getContentInsightsService();
        const startTime = Date.now();

        try {
          let response: ContentInsightsResponse;

          switch (insightType) {
            case "brief": {
              const data = await service.getBriefInsights(siteId);
              response = { success: true, type: "brief", data };
              break;
            }

            case "voice": {
              const data = await service.getVoiceInsights(siteId);
              response = { success: true, type: "voice", data };
              break;
            }

            case "optimization": {
              const data = await service.getOptimizationInsights(siteId);
              response = { success: true, type: "optimization", data };
              break;
            }

            case "check": {
              const data = await service.getPrePublishCheck(siteId, targetKeywords!);
              response = { success: true, type: "check", data };
              break;
            }

            default: {
              // TypeScript exhaustiveness check
              const _exhaustive: never = insightType;
              throw new Error(`Unknown insight type: ${_exhaustive}`);
            }
          }

          const duration = Date.now() - startTime;
          log.info("Content insights generated", {
            clientId,
            siteId,
            insightType,
            durationMs: duration,
          });

          return Response.json(response, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          log.error(
            "Failed to generate content insights",
            error instanceof Error ? error : new Error(String(error)),
            { clientId, siteId, insightType, durationMs: duration }
          );

          return Response.json(
            {
              success: false,
              error: "Failed to generate insights",
            } satisfies ContentInsightsResponse,
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },

      /**
       * GET handler returns method not allowed
       */
      GET: async (): Promise<Response> => {
        return Response.json(
          { success: false, error: "Method not allowed. Use POST." },
          { status: 405, headers: { "Content-Type": "application/json", Allow: "POST" } }
        );
      },
    },
  },
});
