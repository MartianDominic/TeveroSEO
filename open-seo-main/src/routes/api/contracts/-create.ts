/**
 * API endpoint for contract creation from accepted proposals.
 * Phase 48-01: Contract Generation - Task 4
 *
 * POST /api/contracts/create
 * Creates a contract from an accepted proposal.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { ContractService } from "@/server/features/contracts/services/ContractService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { z } from "zod";

const log = createLogger({ module: "api/contracts/create" });

const createContractSchema = z.object({
  proposalId: z.string().min(1, "Proposal ID required"),
});

/**
 * POST /api/contracts/create
 *
 * Request body:
 * {
 *   "proposalId": "prop_xxx"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "contract_xxx",
 *     "status": "draft",
 *     "proposalId": "prop_xxx",
 *     ...
 *   }
 * }
 */
// @ts-expect-error Route type not yet in FileRoutesByPath
export const Route = createFileRoute("/api/contracts/create")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          const body = await request.json();

          // Validate request body
          const validationResult = createContractSchema.safeParse(body);
          if (!validationResult.success) {
            return Response.json(
              {
                success: false,
                error: validationResult.error.issues[0]?.message || "Invalid request",
              },
              { status: 400 }
            );
          }

          const { proposalId } = validationResult.data;

          log.info("Creating contract from proposal", { proposalId });

          const contract = await ContractService.createFromProposal(
            proposalId,
            authContext.organizationId
          );

          log.info("Contract created successfully", { contractId: contract.id });

          return Response.json({
            success: true,
            data: contract,
          }, { status: 201 });
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json({ success: false, error: error.message }, { status: 401 });
            }
            if (error.code === "FORBIDDEN") {
              return Response.json({ success: false, error: error.message }, { status: 403 });
            }
            if (error.code === "NOT_FOUND") {
              return Response.json({ success: false, error: error.message }, { status: 404 });
            }
            if (error.code === "VALIDATION_ERROR") {
              return Response.json({ success: false, error: error.message }, { status: 400 });
            }
          }

          log.error("Failed to create contract", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Failed to create contract" },
            { status: 500 }
          );
        }
      },
    },
  },
});
