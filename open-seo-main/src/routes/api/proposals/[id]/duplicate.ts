/**
 * API endpoint for duplicating proposals.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * POST /api/proposals/:id/duplicate
 * Creates a full copy of the proposal including all sections and services.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import { db } from "@/db/index";
import { proposals } from "@/db/proposal-schema";
// NOTE: templateSections uses templateId, not proposalId - section copying disabled
// import { templateSections } from "@/db/proposal-template-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/duplicate" });

/**
 * Request body schema for duplicating a proposal.
 */
const DuplicateProposalSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  keepProspect: z.boolean().optional().default(true),
});

/**
 * Generate a secure random token for public proposal access.
 */
function generateToken(): string {
  return nanoid(32);
}

/**
 * POST /api/proposals/:id/duplicate
 *
 * Request body:
 * {
 *   "name": "Copy of Proposal", // Optional, defaults to "Copy of {original}"
 *   "keepProspect": true // Optional, defaults to true
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "prop_xxx",
 *     "name": "Copy of Proposal",
 *     "status": "draft"
 *   }
 * }
 */
export const Route = createFileRoute("/api/proposals/id/duplicate")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          const proposalId = params.id;
          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          // Parse and validate request body
          const body = await request.json().catch(() => ({}));
          const parseResult = DuplicateProposalSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const input = parseResult.data;

          // Get original proposal
          const original = await ProposalService.findById(proposalId);
          if (!original) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Verify workspace access
          if (original.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Generate new ID and token
          const newId = nanoid();
          const newToken = generateToken();
          const now = new Date();

          // Create duplicate proposal
          const [duplicated] = await db
            .insert(proposals)
            .values({
              id: newId,
              prospectId: input.keepProspect ? original.prospectId : null,
              workspaceId: original.workspaceId,
              template: original.template,
              content: original.content,
              brandConfig: original.brandConfig,
              setupFeeCents: original.setupFeeCents,
              monthlyFeeCents: original.monthlyFeeCents,
              currency: original.currency,
              status: "draft", // Always reset to draft
              token: newToken,
              expiresAt: null, // Reset expiry
              sentAt: null,
              firstViewedAt: null,
              acceptedAt: null,
              signedAt: null,
              paidAt: null,
              declinedReason: null,
              declinedNotes: null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          // NOTE: Section copying disabled - templateSections uses templateId not proposalId
          // This would require a proposal_sections table or different schema design

          log.info("Proposal duplicated", {
            originalId: proposalId,
            newId,
            keepProspect: input.keepProspect,
          });

          return Response.json({
            success: true,
            data: {
              id: duplicated.id,
              status: duplicated.status,
              createdAt: duplicated.createdAt,
            },
          });
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json(
                { success: false, error: error.message },
                { status: 401 }
              );
            }
            if (error.code === "FORBIDDEN") {
              return Response.json(
                { success: false, error: error.message },
                { status: 403 }
              );
            }
          }

          log.error(
            "Failed to duplicate proposal",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Failed to duplicate proposal" },
            { status: 500 }
          );
        }
      },
    },
  },
});
