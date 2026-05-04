/**
 * Track proposal view endpoint.
 * Phase 46-47: Proposal System
 *
 * POST /api/proposals/track
 * Receives tracking data from beacon and records view.
 *
 * SECURITY:
 * - No authentication required - called by beacon endpoint.
 * - Uses ViewTrackingService which provides 5-minute session deduplication.
 * - H-TSK-01 FIX: Rate limited to prevent tracking spam and DoS.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import {
  ViewTrackingService,
  detectDeviceType,
} from "@/server/features/proposals/tracking/ViewTrackingService";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

const log = createLogger({ module: "api/proposals/track" });

/**
 * H-TSK-01 FIX: Rate limit config for tracking: 60 requests per minute per IP.
 * Higher limit since beacon may send multiple heartbeats, but still prevents spam.
 */
const PROPOSAL_TRACK_RATE_LIMIT = {
  limit: 60,
  window: 60, // 1 minute in seconds
};

/**
 * Extract client IP for rate limiting.
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("X-Real-IP");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/**
 * Request body schema for tracking.
 */
const TrackSchema = z.object({
  token: z.string().min(1),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export const Route = createFileRoute("/api/proposals/track")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // H-TSK-01 FIX: Rate limiting to prevent tracking spam
          const clientIP = getClientIP(request);
          const rateLimitResult = await rateLimit({
            key: `proposal-track:${clientIP}`,
            ...PROPOSAL_TRACK_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            log.warn("Rate limit exceeded for proposal tracking", {
              clientIP,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          const body = await request.json().catch(() => ({}));
          const parseResult = TrackSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json({ success: false }, { status: 400 });
          }

          const input = parseResult.data;

          // Find proposal by token
          const proposal = await ProposalService.findByToken(input.token);
          if (!proposal) {
            return Response.json({ success: false }, { status: 404 });
          }

          // Track view (ViewTrackingService handles deduplication)
          await ViewTrackingService.trackProposalView({
            proposalId: proposal.id,
            deviceType: detectDeviceType(input.userAgent || ""),
            ipAddress: input.ipAddress || "127.0.0.1",
            userAgent: input.userAgent || "",
          });

          return Response.json({ success: true });
        } catch (error) {
          log.warn("Tracking failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
