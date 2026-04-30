/**
 * Public proposal fetch endpoint.
 * Phase 46-47: Proposal System
 *
 * GET /api/proposals/public/:token
 * Fetches proposal by public access token (no auth required).
 * Tracks view with GDPR-compliant IP hashing.
 *
 * SECURITY: No authentication required - token provides access.
 * Uses 32-char nanoid tokens (~10^57 entropy) to prevent enumeration.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import {
  ViewTrackingService,
  detectDeviceType,
} from "@/server/features/proposals/tracking/ViewTrackingService";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/proposals/public" });

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
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
