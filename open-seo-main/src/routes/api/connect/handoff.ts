/**
 * Developer Handoff API Endpoint
 * Phase 66-05: Developer Handoff Flow
 * Phase 68-03: Standardized API envelope
 *
 * POST /api/connect/handoff
 * Creates a developer handoff and sends email with installation instructions.
 *
 * GET /api/connect/handoff
 * Gets handoffs for a site (requires siteId query param).
 *
 * Security:
 * - T-66-13: Email format validation
 * - T-66-15: Rate limit 5 handoffs per site per day
 * - T-66-16: Sender name sanitization
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import {
  DeveloperHandoffService,
  type CreateHandoffRequest,
} from "@/server/features/pixel/developer-handoff.service";
import { getEmailService } from "@/server/services/email/EmailService";
import { successResponse, errorResponse } from "@/server/lib/response";

const log = createLogger({ module: "api/connect/handoff" });

// ============================================================================
// Request Schemas
// ============================================================================

const CreateHandoffSchema = z.object({
  installationId: z.string().min(1, "Installation ID is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(254, "Email too long"),
  name: z.string().max(100, "Name too long").optional(),
  message: z.string().max(500, "Message too long").optional(),
  senderName: z.string().min(1, "Sender name is required").max(100, "Sender name too long"),
  domain: z.string().min(1, "Domain is required"),
});

const GetHandoffsSchema = z.object({
  installationId: z.string().min(1, "Installation ID is required"),
});

// ============================================================================
// Response Types
// ============================================================================

interface CreateHandoffResponse {
  handoffId: string;
  magicLink: string;
  status: "sent";
}

interface HandoffListResponse {
  handoffs: Array<{
    id: string;
    developerEmail: string;
    developerName: string | null;
    status: string;
    sentAt: Date;
    openedAt: Date | null;
    completedAt: Date | null;
    reminderCount: number;
  }>;
}

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/connect/handoff")({
  server: {
    handlers: {
      /**
       * POST /api/connect/handoff
       *
       * Creates a developer handoff and sends installation instructions.
       *
       * Request body: { installationId, email, name?, message?, senderName, domain }
       * Response: { success: true, data: { handoffId, magicLink, status } }
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = CreateHandoffSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(400, "Invalid input", {
              code: "VALIDATION_ERROR",
              details: parsed.error.issues,
            });
          }

          log.info("Creating developer handoff", {
            installationId: parsed.data.installationId,
            email: parsed.data.email,
          });

          // Create handoff request
          const handoffRequest: CreateHandoffRequest = {
            installationId: parsed.data.installationId,
            email: parsed.data.email,
            name: parsed.data.name,
            message: parsed.data.message,
            senderName: parsed.data.senderName,
            domain: parsed.data.domain,
          };

          // Create service with email integration
          const emailService = getEmailService();
          const handoffService = new DeveloperHandoffService(db, {
            sendEmail: async (options) => {
              const result = await emailService.sendEmail({
                templateId: options.templateId as any,
                to: options.to,
                workspaceId: options.workspaceId,
                variables: options.variables,
              });
              return {
                success: result.success,
                messageId: result.messageId,
              };
            },
          });

          const result = await handoffService.createHandoff(handoffRequest);

          const response: CreateHandoffResponse = {
            handoffId: result.id,
            magicLink: result.magicLink,
            status: "sent",
          };

          log.info("Developer handoff created", {
            handoffId: result.id,
            email: parsed.data.email,
          });

          // Return 201 with success envelope
          const successResp = successResponse(response);
          return new Response(successResp.body, {
            status: 201,
            headers: successResp.headers,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          // Handle known errors
          if (message.includes("Rate limit")) {
            return errorResponse(429, "Rate limit exceeded", {
              code: "RATE_LIMIT_EXCEEDED",
              details: message,
            });
          }

          if (message.includes("Installation not found")) {
            return errorResponse(404, "Installation not found", { code: "NOT_FOUND" });
          }

          if (message.includes("Invalid email")) {
            return errorResponse(400, "Invalid email format", { code: "VALIDATION_ERROR" });
          }

          log.error(
            "Failed to create handoff",
            error instanceof Error ? error : new Error(message)
          );

          return errorResponse(500, "Failed to create handoff", {
            code: "INTERNAL_ERROR",
            details: "An unexpected error occurred",
          });
        }
      },

      /**
       * GET /api/connect/handoff?installationId=xxx
       *
       * Gets all handoffs for a pixel installation.
       *
       * Response: { success: true, data: { handoffs: [...] } }
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const installationId = url.searchParams.get("installationId");

          const parsed = GetHandoffsSchema.safeParse({ installationId });

          if (!parsed.success) {
            return errorResponse(400, "Invalid input", {
              code: "VALIDATION_ERROR",
              details: parsed.error.issues,
            });
          }

          const handoffService = new DeveloperHandoffService(db);
          const handoffs = await handoffService.getHandoffsForSite(
            parsed.data.installationId
          );

          const response: HandoffListResponse = {
            handoffs: handoffs.map((h) => ({
              id: h.id,
              developerEmail: h.developerEmail,
              developerName: h.developerName,
              status: h.status,
              sentAt: h.sentAt,
              openedAt: h.openedAt,
              completedAt: h.completedAt,
              reminderCount: h.reminderCount,
            })),
          };

          return successResponse(response);
        } catch (error) {
          log.error(
            "Failed to get handoffs",
            error instanceof Error ? error : new Error(String(error))
          );

          return errorResponse(500, "Failed to get handoffs", { code: "INTERNAL_ERROR" });
        }
      },
    },
  },
});
