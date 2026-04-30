/**
 * API endpoint for sending contract for e-signature.
 * Phase 48-01: Contract Generation - Task 4
 *
 * POST /api/contracts/:contractId/send
 * Sends a contract for e-signature via Dokobit.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { ContractService } from "@/server/features/contracts/services/ContractService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/contracts/send" });

/**
 * POST /api/contracts/:contractId/send
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "contract": { ... },
 *     "signingUrl": "https://dokobit.com/sign/xxx"
 *   }
 * }
 */
// @ts-expect-error Route type not yet in FileRoutesByPath
export const Route = createFileRoute("/api/contracts/$contractId/send")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { contractId: string } }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          const { contractId } = params;

          if (!contractId) {
            return Response.json(
              { success: false, error: "Contract ID required" },
              { status: 400 }
            );
          }

          log.info("Sending contract for signing", { contractId });

          const result = await ContractService.sendForSigning(
            contractId,
            authContext.organizationId,
            authContext.userId
          );

          log.info("Contract sent for signing successfully", {
            contractId,
            signingUrl: result.signingUrl,
          });

          return Response.json({
            success: true,
            data: {
              contract: result.contract,
              signingUrl: result.signingUrl,
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
            if (error.code === "NOT_FOUND") {
              return Response.json({ success: false, error: error.message }, { status: 404 });
            }
            if (error.code === "CONFLICT" || error.code === "CONTRACT_INVALID_STATE") {
              return Response.json({ success: false, error: error.message }, { status: 409 });
            }
          }

          log.error("Failed to send contract for signing", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Failed to send contract for signing" },
            { status: 500 }
          );
        }
      },
    },
  },
});
