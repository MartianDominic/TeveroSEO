/**
 * Public proposal fetch endpoint.
 * Phase 46-47: Proposal System
 *
 * GET /api/proposals/public/:token
 * Fetches proposal by public access token (no auth required).
 * Tracks view with GDPR-compliant IP hashing.
 *
 * SECURITY:
 * - No authentication required - token provides access.
 * - Uses 32-char nanoid tokens (~10^57 entropy) to prevent enumeration.
 * - H-TSK-01 FIX: Rate limited to prevent enumeration attacks and DoS.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import {
  ViewTrackingService,
  detectDeviceType,
} from "@/server/features/proposals/tracking/ViewTrackingService";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

const log = createLogger({ module: "api/proposals/public" });

/**
 * H-TSK-01 FIX: Rate limit config for public proposal fetch: 30 requests per minute per IP.
 * Generous limit for legitimate viewing but prevents enumeration attacks.
 */
const PROPOSAL_PUBLIC_RATE_LIMIT = {
  limit: 30,
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

export const Route = createFileRoute("/api/proposals/public/$token")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { token: string };
      }) => {
        try {
          const { token } = params;

          if (!token) {
            return Response.json(
              { success: false, error: "Token is required" },
              { status: 400 }
            );
          }

          // H-TSK-01 FIX: Rate limiting to prevent enumeration and DoS
          const clientIP = getClientIP(request);
          const rateLimitResult = await rateLimit({
            key: `proposal-public:${clientIP}`,
            ...PROPOSAL_PUBLIC_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            log.warn("Rate limit exceeded for public proposal fetch", {
              token: token.slice(0, 8) + "...", // Log partial token only
              clientIP,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Fetch proposal by token (throws if expired per D-06)
          const proposal = await ProposalService.findByToken(token);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Track view (called here for SSR, beacon provides backup tracking)
          const userAgent = request.headers.get("user-agent") || "";
          const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0] ||
            request.headers.get("x-real-ip") ||
            "127.0.0.1";

          try {
            await ViewTrackingService.trackProposalView({
              proposalId: proposal.id,
              deviceType: detectDeviceType(userAgent),
              ipAddress,
              userAgent,
            });
          } catch (trackError) {
            // Don't fail the request if tracking fails
            log.warn("View tracking failed", {
              proposalId: proposal.id,
              error:
                trackError instanceof Error
                  ? trackError.message
                  : String(trackError),
            });
          }

          // Return proposal data (sanitized for public view)
          return Response.json({
            success: true,
            data: {
              id: proposal.id,
              content: proposal.content,
              brandConfig: proposal.brandConfig,
              setupFeeCents: proposal.setupFeeCents,
              monthlyFeeCents: proposal.monthlyFeeCents,
              currency: proposal.currency,
              status: proposal.status,
              expiresAt: proposal.expiresAt,
              createdAt: proposal.createdAt,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            if (error.code === "GONE") {
              return Response.json(
                { success: false, error: "Proposal has expired" },
                { status: 410 }
              );
            }
          }

          log.error(
            "Error fetching public proposal",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
