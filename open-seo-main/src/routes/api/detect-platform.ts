/**
 * Platform Detection API Route
 * Phase 31-04: API Endpoints
 *
 * Detects the CMS platform of a given domain using multi-probe fingerprinting.
 *
 * POST /api/detect-platform
 * Body: { domain: "example.com" }
 * Returns: { platform, confidence, signals }
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { detectPlatform } from "@/server/features/connections/services/PlatformDetector";
import { createLogger } from "@/server/lib/logger";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/detect-platform" });

const DetectPlatformSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
});

export const Route = createFileRoute("/api/detect-platform")({
  server: {
    handlers: {
      // POST /api/detect-platform
      POST: async ({ request }: { request: Request }) => {
        try {
          // CRITICAL: Authentication required
          await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = DetectPlatformSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const result = await detectPlatform(parsed.data.domain);

          log.info("Platform detection completed", {
            domain: parsed.data.domain,
            platform: result.platform,
            confidence: result.confidence,
          });

          return Response.json(result);
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json({ error: error.message }, { status: 401 });
            }
            if (error.code === "FORBIDDEN") {
              return Response.json({ error: error.message }, { status: 403 });
            }
          }

          // detectPlatform handles its own errors and returns a result
          // This catch is for unexpected errors
          log.error(
            "Platform detection failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
