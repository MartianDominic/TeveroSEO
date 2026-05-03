/**
 * Installation Guide API Endpoint
 * Phase 66-03: Platform-specific installation guides
 *
 * GET /api/connect/guide/:platform
 * Returns step-by-step installation guide for a specific platform.
 *
 * Query params:
 * - siteId: Optional site ID to interpolate into code snippets
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import {
  getGuide,
  SUPPORTED_PLATFORMS,
  type InstallationGuide,
} from "@/server/features/pixel/cms-guides";

const log = createLogger({ module: "api/connect/guide" });

// ============================================================================
// Request Schema
// ============================================================================

const PlatformParamSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
});

const QuerySchema = z.object({
  siteId: z.string().optional(),
});

// ============================================================================
// Response Types
// ============================================================================

interface GuideResponse {
  guide: InstallationGuide;
  snippet: string; // Pre-filled pixel script
}

interface ErrorResponse {
  error: string;
  supportedPlatforms?: string[];
}

// ============================================================================
// Pixel Script Template
// ============================================================================

const PIXEL_SCRIPT_TEMPLATE = `<script async src="https://pixel.tevero.io/t.js" data-site="{{SITE_ID}}"></script>`;

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/connect/guide/platform")({
  server: {
    handlers: {
      /**
       * GET /api/connect/guide/:platform
       *
       * Path params: platform (string)
       * Query params: siteId (optional string)
       * Response: { guide: InstallationGuide, snippet: string }
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: Record<string, string>;
      }) => {
        try {
          // Validate platform param
          const platformParsed = PlatformParamSchema.safeParse(params);
          if (!platformParsed.success) {
            return Response.json(
              {
                error: "Invalid platform parameter",
                supportedPlatforms: SUPPORTED_PLATFORMS,
              } satisfies ErrorResponse,
              { status: 400 }
            );
          }

          const { platform } = platformParsed.data;

          // Parse query params
          const url = new URL(request.url);
          const queryParsed = QuerySchema.safeParse({
            siteId: url.searchParams.get("siteId") ?? undefined,
          });

          const siteId = queryParsed.success ? queryParsed.data.siteId : undefined;

          // Get guide for platform
          const guide = getGuide(platform, siteId);

          if (!guide) {
            log.warn("Guide not found for platform", { platform });
            return Response.json(
              {
                error: `No guide found for platform: ${platform}`,
                supportedPlatforms: SUPPORTED_PLATFORMS,
              } satisfies ErrorResponse,
              { status: 404 }
            );
          }

          // Generate snippet with siteId if provided
          const snippet = siteId
            ? PIXEL_SCRIPT_TEMPLATE.replace("{{SITE_ID}}", siteId)
            : PIXEL_SCRIPT_TEMPLATE;

          const response: GuideResponse = {
            guide,
            snippet,
          };

          log.info("Guide retrieved", { platform, hasSiteId: !!siteId });

          return Response.json(response);
        } catch (error) {
          log.error(
            "Guide retrieval failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve guide" } satisfies ErrorResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
