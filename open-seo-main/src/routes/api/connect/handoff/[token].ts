/**
 * Magic Link Token Handler
 * Phase 66-05: Developer Handoff Flow
 *
 * GET /api/connect/handoff/:token
 * Validates magic link token and returns handoff with installation guide.
 *
 * POST /api/connect/handoff/:token/complete
 * Marks handoff as completed (pixel verified).
 *
 * POST /api/connect/handoff/:token/remind
 * Sends a reminder email.
 *
 * Security:
 * - T-66-14: 30-day expiry, single-use status tracking
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { DeveloperHandoffService } from "@/server/features/pixel/developer-handoff.service";
import { getGuide } from "@/server/features/pixel/cms-guides";
import { generatePixelScript } from "@/server/features/pixel/pixel-script.service";
import { pixelInstallations } from "@/db/pixel-schema";
import { eq } from "drizzle-orm";

const log = createLogger({ module: "api/connect/handoff/[token]" });

// ============================================================================
// Token Validation
// ============================================================================

const TokenSchema = z.string().min(1, "Token is required").max(64, "Token too long");

// ============================================================================
// Response Types
// ============================================================================

interface HandoffResponse {
  handoff: {
    id: string;
    developerEmail: string;
    developerName: string | null;
    status: string;
    sentAt: Date;
    openedAt: Date | null;
  };
  installation: {
    siteId: string;
    domain: string;
  };
  guide: {
    platform: string;
    steps: Array<{
      title: string;
      content: string;
    }>;
  } | null;
  snippet: string;
}

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/connect/handoff/token")({
  server: {
    handlers: {
      /**
       * GET /api/connect/handoff/:token
       *
       * Validates magic link and returns handoff with guide.
       * Updates status to 'opened' on first access.
       *
       * Response: { handoff, installation, guide, snippet }
       */
      GET: async ({ request, params }: { request: Request; params: { token: string } }) => {
        try {
          const tokenResult = TokenSchema.safeParse(params.token);

          if (!tokenResult.success) {
            return Response.json(
              { error: "Invalid token" },
              { status: 400 }
            );
          }

          const token = tokenResult.data;

          log.info("Magic link access", { token: token.slice(0, 8) + "..." });

          const handoffService = new DeveloperHandoffService(db);
          const handoff = await handoffService.getHandoffByToken(token);

          if (!handoff) {
            return Response.json(
              { error: "Invalid or expired link" },
              { status: 404 }
            );
          }

          // Get installation details
          const installation = await db.query.pixelInstallations.findFirst({
            where: eq(pixelInstallations.id, handoff.installationId),
          });

          if (!installation) {
            return Response.json(
              { error: "Installation not found" },
              { status: 404 }
            );
          }

          // Try to get platform-specific guide
          // For now, use a generic guide since we don't have platform info stored
          // In production, you'd detect or store the platform
          const guide = getGuide("custom");

          // Generate the snippet
          const snippet = generatePixelScript(installation.siteId);

          const response: HandoffResponse = {
            handoff: {
              id: handoff.id,
              developerEmail: handoff.developerEmail,
              developerName: handoff.developerName,
              status: handoff.status,
              sentAt: handoff.sentAt,
              openedAt: handoff.openedAt,
            },
            installation: {
              siteId: installation.siteId,
              domain: installation.domain,
            },
            guide: guide
              ? {
                  platform: guide.platform,
                  steps: guide.steps.map((s) => ({
                    title: s.title,
                    content: s.content,
                  })),
                }
              : null,
            snippet,
          };

          log.info("Magic link validated", {
            handoffId: handoff.id,
            status: handoff.status,
          });

          return Response.json(response);
        } catch (error) {
          log.error(
            "Magic link validation failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to validate link" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/connect/handoff/:token
       *
       * Handles actions on a handoff:
       * - action: "complete" - marks handoff as completed
       * - action: "remind" - sends reminder email
       *
       * Request body: { action: "complete" | "remind" }
       */
      POST: async ({ request, params }: { request: Request; params: { token: string } }) => {
        try {
          const tokenResult = TokenSchema.safeParse(params.token);

          if (!tokenResult.success) {
            return Response.json(
              { error: "Invalid token" },
              { status: 400 }
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const action = body.action as string;

          if (!action || !["complete", "remind"].includes(action)) {
            return Response.json(
              { error: "Invalid action", details: "Action must be 'complete' or 'remind'" },
              { status: 400 }
            );
          }

          const token = tokenResult.data;
          const handoffService = new DeveloperHandoffService(db);
          const handoff = await handoffService.getHandoffByToken(token);

          if (!handoff) {
            return Response.json(
              { error: "Invalid or expired link" },
              { status: 404 }
            );
          }

          if (action === "complete") {
            await handoffService.completeHandoff(handoff.id);
            log.info("Handoff marked complete", { handoffId: handoff.id });

            return Response.json({
              success: true,
              message: "Handoff completed",
              status: "completed",
            });
          }

          if (action === "remind") {
            const sent = await handoffService.sendReminder(handoff.id);

            if (!sent) {
              return Response.json(
                { error: "Maximum reminders reached" },
                { status: 429 }
              );
            }

            log.info("Reminder sent", { handoffId: handoff.id });

            return Response.json({
              success: true,
              message: "Reminder sent",
            });
          }

          return Response.json({ error: "Unknown action" }, { status: 400 });
        } catch (error) {
          log.error(
            "Handoff action failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Action failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});
