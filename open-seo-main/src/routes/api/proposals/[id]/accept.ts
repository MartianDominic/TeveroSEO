/**
 * Accept proposal endpoint.
 * Phase 46-47: Proposal System
 *
 * POST /api/proposals/:id/accept
 * Accepts a proposal, transitioning status from viewed to accepted.
 * Logs activity with actor_type='client' per D-10.
 *
 * SECURITY:
 * - FIX H-AUTH-04: Token validation required - prevents unauthorized state changes.
 * - Rate limited to prevent DoS attacks on proposal state.
 * - Origin validation (CSRF) to prevent malicious auto-accept links.
 * - State machine enforces valid transitions (only from "viewed" status).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import { ActivityRepository } from "@/server/features/contracts/repositories/ActivityRepository";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";
import { timingSafeEqual } from "crypto";

/**
 * FIX H-AUTH-04: Request body schema with required token.
 */
const acceptRequestSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

/**
 * FIX H-AUTH-04: Timing-safe token comparison.
 */
function secureTokenCompare(a: string, b: string): boolean {
  try {
    const aBuffer = Buffer.from(a, "utf8");
    const bBuffer = Buffer.from(b, "utf8");
    if (aBuffer.length !== bBuffer.length) {
      // Perform dummy comparison to maintain constant time
      timingSafeEqual(bBuffer, bBuffer);
      return false;
    }
    return timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

/**
 * Rate limit config for proposal accept: 10 requests per minute per IP.
 * Prevents DoS attacks while allowing legitimate use.
 */
const PROPOSAL_ACCEPT_RATE_LIMIT = {
  limit: 10,
  window: 60, // 1 minute in seconds
};

/**
 * Validate request origin for CSRF protection.
 * Checks Origin and Referer headers against allowed origins.
 *
 * @param request - The incoming request
 * @returns true if the request origin is valid
 */
function validateRequestOrigin(request: Request): boolean {
  const allowedOrigins: string[] = [];

  // Production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // App URL (open-seo-main specific)
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL);
  }

  // Development URLs
  if (process.env.NODE_ENV === "development") {
    allowedOrigins.push("http://localhost:3000");
    allowedOrigins.push("http://localhost:3001");
    allowedOrigins.push("http://127.0.0.1:3000");
    allowedOrigins.push("http://127.0.0.1:3001");
  }

  // Check Origin header (most reliable for CORS requests)
  const origin = request.headers.get("origin");
  if (origin) {
    return allowedOrigins.some((allowed) => origin === allowed);
  }

  // Fallback to Referer header (may be stripped by some browsers)
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return allowedOrigins.some((allowed) => refererUrl.origin === allowed);
    } catch {
      // Invalid referer URL
      return false;
    }
  }

  // No origin or referer - reject state-changing requests without origin info
  return false;
}

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

const log = createLogger({ module: "api/proposals/accept" });

export const Route = createFileRoute("/api/proposals/id/accept")({
  server: {
    handlers: {
      POST: async ({ params, request }: { params: { id: string }; request: Request }) => {
        try {
          const proposalId = params.id;

          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          // CRIT-OSM-03: CSRF protection - validate request origin
          if (!validateRequestOrigin(request)) {
            log.warn("Invalid request origin for proposal accept", {
              proposalId,
              origin: request.headers.get("origin"),
              referer: request.headers.get("referer"),
            });
            return Response.json(
              { success: false, error: "Invalid request origin" },
              { status: 403 }
            );
          }

          // CRIT-OSM-01: Rate limiting to prevent DoS on proposal state
          const clientIP = getClientIP(request);
          const rateLimitResult = await rateLimit({
            key: `proposal-accept:${clientIP}`,
            ...PROPOSAL_ACCEPT_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            log.warn("Rate limit exceeded for proposal accept", {
              proposalId,
              clientIP,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // FIX H-AUTH-04: Parse and validate request body with token
          let requestToken: string;
          try {
            const body = await request.json();
            const parsed = acceptRequestSchema.safeParse(body);
            if (!parsed.success) {
              log.warn("Invalid accept request body", {
                proposalId,
                errors: parsed.error.issues,
              });
              return Response.json(
                { success: false, error: "Token is required for proposal acceptance" },
                { status: 400 }
              );
            }
            requestToken = parsed.data.token;
          } catch {
            return Response.json(
              { success: false, error: "Invalid request body" },
              { status: 400 }
            );
          }

          // Get current proposal to capture previous status
          const proposal = await ProposalService.findById(proposalId);
          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // FIX H-AUTH-04: Validate token matches proposal's token
          // Uses timing-safe comparison to prevent timing attacks
          if (!secureTokenCompare(requestToken, proposal.token)) {
            log.warn("Invalid token for proposal accept", {
              proposalId,
              clientIP,
            });
            return Response.json(
              { success: false, error: "Invalid or expired token" },
              { status: 403 }
            );
          }

          const previousStatus = proposal.status;

          // Validate transition (must be in viewed status per state machine)
          if (proposal.status !== "viewed") {
            return Response.json(
              {
                success: false,
                error: `Cannot accept proposal in ${proposal.status} status. Proposal must be viewed first.`,
              },
              { status: 400 }
            );
          }

          // Mark as accepted
          const updated = await ProposalService.markAccepted(proposalId);

          // Log activity with actor_type = 'client' per D-10
          await ActivityRepository.insertActivity({
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 21),
            workspaceId: proposal.workspaceId,
            entityType: "proposal",
            entityId: proposalId,
            activityType: "status_changed",
            activityData: {
              fromStatus: previousStatus,
              toStatus: "accepted",
              actorType: "client",
            },
            actorId: null, // Client action, no user ID
          });

          log.info("Proposal accepted", { proposalId });

          return Response.json({
            success: true,
            data: {
              proposalId: updated.id,
              status: updated.status,
              acceptedAt: updated.acceptedAt,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            if (error.code === "CONFLICT") {
              return Response.json(
                { success: false, error: error.message },
                { status: 409 }
              );
            }
            if (error.code === "NOT_FOUND") {
              return Response.json(
                { success: false, error: error.message },
                { status: 404 }
              );
            }
          }

          log.error(
            "Error accepting proposal",
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
