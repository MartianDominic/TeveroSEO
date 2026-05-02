/**
 * Track proposal view endpoint.
 * Phase 46-47: Proposal System
 *
 * POST /api/proposals/track
 * Receives tracking data from beacon and records view.
 *
 * SECURITY: No authentication required - called by beacon endpoint.
 * Uses ViewTrackingService which provides 5-minute session deduplication.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import {
  ViewTrackingService,
  detectDeviceType,
} from "@/server/features/proposals/tracking/ViewTrackingService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/proposals/track" });

/**
 * Request body schema for tracking.
 */
const TrackSchema = z.object({
  token: z.string().min(1),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/proposals/track")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
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
