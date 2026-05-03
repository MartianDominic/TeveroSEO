/**
 * API endpoint for sending proposal emails.
 * Phase 46-47: Proposal System
 *
 * POST /api/proposals/:id/send
 * Sends the proposal email to the prospect and transitions status to "sent".
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import { EmailService } from "@/server/features/proposals/services/EmailService";
import { ProspectService } from "@/server/features/prospects/services/ProspectService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

/** Rate limit config for proposal sending: 20 per hour per user */
const PROPOSAL_SEND_RATE_LIMIT = {
  limit: 20,
  window: 3600, // 1 hour in seconds
};

const log = createLogger({ module: "api/proposals/send" });

/**
 * Request body schema for sending a proposal.
 * recipientEmail and recipientName are optional - will use prospect contact info if not provided.
 */
const SendProposalSchema = z.object({
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().min(1).optional(),
  expirationDays: z.number().int().min(1).max(90).optional(),
});

/**
 * POST /api/proposals/:id/send
 *
 * Request body (all fields optional):
 * {
 *   "recipientEmail": "contact@example.com", // Falls back to prospect.contactEmail
 *   "recipientName": "John Doe", // Falls back to prospect.contactName
 *   "expirationDays": 30 // Default: 30 days
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "proposalId": "prop_xxx",
 *     "status": "sent",
 *     "sentAt": "2026-04-30T12:00:00Z",
 *     "expiresAt": "2026-05-30T12:00:00Z",
 *     "messageId": "email_xxx"
 *   }
 * }
 */
export const Route = createFileRoute("/api/proposals/id/send")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          // Rate limit: 20 sends per hour per user
          const rateLimitResult = await rateLimit({
            key: `proposal-send:${authContext.userId}`,
            ...PROPOSAL_SEND_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          const proposalId = params.id;
          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          // Parse and validate request body
          const body = await request.json().catch(() => ({}));
          const parseResult = SendProposalSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json(
              { success: false, error: "Invalid input", details: parseResult.error.issues },
              { status: 400 }
            );
          }

          const input = parseResult.data;

          // Get proposal
          const proposal = await ProposalService.findById(proposalId);
          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Check status - can only send from draft
          if (proposal.status !== "draft") {
            return Response.json(
              { success: false, error: `Cannot send proposal in ${proposal.status} status. Only draft proposals can be sent.` },
              { status: 400 }
            );
          }

          // Get prospect for contact info
          let recipientEmail = input.recipientEmail;
          let recipientName = input.recipientName;
          let companyName = "Client";

          if (proposal.prospectId) {
            const prospect = await ProspectService.findById(proposal.prospectId);
            if (prospect) {
              recipientEmail = recipientEmail || prospect.contactEmail || undefined;
              recipientName = recipientName || prospect.contactName || undefined;
              companyName = prospect.companyName || prospect.domain;
            }
          }

          // Validate we have a recipient email
          if (!recipientEmail) {
            return Response.json(
              { success: false, error: "No recipient email provided or found on prospect. Please provide recipientEmail in the request body." },
              { status: 400 }
            );
          }

          log.info("Sending proposal email", { proposalId, to: recipientEmail });

          // Send email
          const emailResult = await EmailService.sendProposalEmail({
            proposal,
            recipientEmail,
            recipientName: recipientName || "Client",
            companyName,
          });

          if (!emailResult.success) {
            log.error("Failed to send proposal email", undefined, { proposalId, error: emailResult.error });
            return Response.json(
              { success: false, error: emailResult.error || "Failed to send email" },
              { status: 500 }
            );
          }

          // Mark proposal as sent
          const expiresAt = input.expirationDays
            ? new Date(Date.now() + input.expirationDays * 24 * 60 * 60 * 1000)
            : undefined;

          const updatedProposal = await ProposalService.markSent(proposalId, expiresAt);

          log.info("Proposal sent successfully", { proposalId, to: recipientEmail, messageId: emailResult.messageId });

          return Response.json({
            success: true,
            data: {
              proposalId: updatedProposal.id,
              status: updatedProposal.status,
              sentAt: updatedProposal.sentAt,
              expiresAt: updatedProposal.expiresAt,
              messageId: emailResult.messageId,
            },
          });
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json({ success: false, error: error.message }, { status: 401 });
            }
            if (error.code === "FORBIDDEN") {
              return Response.json({ success: false, error: error.message }, { status: 403 });
            }
            if (error.code === "AUTH_CONFIG_MISSING") {
              log.error("Email service not configured", undefined, { error: error.message });
              return Response.json(
                { success: false, error: "Email service not configured. Please contact administrator." },
                { status: 503 }
              );
            }
            if (error.code === "CONFLICT") {
              return Response.json({ success: false, error: error.message }, { status: 409 });
            }
          }

          log.error("Failed to send proposal", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Failed to send proposal" },
            { status: 500 }
          );
        }
      },
    },
  },
});
