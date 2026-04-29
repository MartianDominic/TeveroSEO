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

/**
 * List of blocked internal/private addresses for SSRF protection.
 * HIGH-INPUT-02: Prevent requests to internal infrastructure.
 */
const BLOCKED_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
  "10.", // Private Class A
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", // Private Class B
  "192.168.", // Private Class C
  "::1", // IPv6 localhost
  "[::1]",
];

/**
 * Check if domain matches any blocked internal pattern.
 */
function isBlockedDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return BLOCKED_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Zod schema for platform detection with SSRF protection.
 * HIGH-INPUT-02: Validate domain format and block internal addresses.
 */
const DetectPlatformSchema = z.object({
  domain: z.string()
    .min(1, "Domain is required")
    .max(253, "Domain must be at most 253 characters")
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/,
      "Invalid domain format"
    )
    .refine(
      (domain) => !isBlockedDomain(domain),
      { message: "Internal addresses are not allowed" }
    ),
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
