/**
 * Platform Detection API Endpoint
 * Phase 66-03: CMS Platform Detection
 * Phase 68-03: Standardized API envelope
 *
 * POST /api/connect/detect
 * Detects CMS platform from a URL with 95%+ accuracy.
 *
 * Security:
 * - T-66-08: URL format validation via Zod
 * - T-66-09: 3 second timeout, uses existing crawler rate limits
 * - T-66-10: SSRF protection - blocks internal IPs
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import {
  PlatformDetectorService,
  type PlatformDetectionResult,
} from "@/server/features/pixel/platform-detector.service";
import { CMS_GUIDES } from "@/server/features/pixel/cms-guides";
import { successResponse, errorResponse } from "@/server/lib/response";

const log = createLogger({ module: "api/connect/detect" });

// ============================================================================
// SSRF Protection (T-66-10)
// ============================================================================

/**
 * Blocked patterns for SSRF protection.
 * Prevents requests to internal infrastructure.
 */
const BLOCKED_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
  "10.", // Private Class A
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.", // Private Class B
  "192.168.", // Private Class C
  "::1", // IPv6 localhost
  "[::1]",
  "fc00:", // IPv6 private
  "fd00:",
  "fe80:", // IPv6 link-local
];

/**
 * Check if URL matches any blocked internal pattern.
 */
function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return BLOCKED_PATTERNS.some((pattern) => hostname.includes(pattern));
  } catch {
    return true; // Invalid URLs are blocked
  }
}

// ============================================================================
// Request Schema (T-66-08)
// ============================================================================

const DetectRequestSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL must be at most 2048 characters")
    .refine(
      (url) => {
        // Add protocol if missing
        const withProtocol = url.startsWith("http") ? url : `https://${url}`;
        try {
          new URL(withProtocol);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid URL format" }
    )
    .refine((url) => !isBlockedUrl(url.startsWith("http") ? url : `https://${url}`), {
      message: "Internal addresses are not allowed",
    }),
});

// ============================================================================
// Response Types
// ============================================================================

interface DetectResponse {
  platform: string;
  confidence: number;
  features: string[];
  paidPlanRequired: boolean | string;
  estimatedTime: string;
  hasGuide: boolean;
}

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/connect/detect")({
  server: {
    handlers: {
      /**
       * POST /api/connect/detect
       *
       * Request body: { url: string }
       * Response: { success: true, data: { platform, confidence, features, paidPlanRequired, estimatedTime, hasGuide } }
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = DetectRequestSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(400, "Invalid input", {
              code: "VALIDATION_ERROR",
              details: parsed.error.issues,
            });
          }

          // Normalize URL
          const url = parsed.data.url.startsWith("http")
            ? parsed.data.url
            : `https://${parsed.data.url}`;

          log.info("Platform detection started", { url });

          // Detect platform with 3 second timeout (T-66-09)
          const detector = new PlatformDetectorService({ timeout: 3000 });
          const result = await detector.detectPlatform(url);

          // Check if we have a guide for this platform
          const hasGuide = result.platform in CMS_GUIDES;

          // Get paid plan info from guide if available
          let paidPlanRequired: boolean | string = result.paidPlanRequired;
          if (hasGuide) {
            const guide = CMS_GUIDES[result.platform];
            paidPlanRequired = guide.paidPlanRequired;
          }

          const response: DetectResponse = {
            platform: result.platform,
            confidence: result.confidence,
            features: result.features,
            paidPlanRequired,
            estimatedTime: result.estimatedTime,
            hasGuide,
          };

          log.info("Platform detection completed", {
            url,
            platform: result.platform,
            confidence: result.confidence,
          });

          return successResponse(response);
        } catch (error) {
          log.error(
            "Platform detection failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return errorResponse(500, "Detection failed", {
            code: "INTERNAL_ERROR",
            details: "An unexpected error occurred",
          });
        }
      },
    },
  },
});
