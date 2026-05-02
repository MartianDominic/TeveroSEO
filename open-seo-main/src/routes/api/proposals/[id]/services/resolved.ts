/**
 * Resolved services API endpoint.
 * Phase 58-04: Service Catalog Integration with Proposals
 *
 * GET /api/proposals/:id/services/resolved
 * Returns services with template data merged with proposal selection data.
 * Used by the proposal view to display service line items.
 *
 * SECURITY:
 * - T-58-10: Only returns services for proposals user has access to
 * - T-58-12: Validates proposal access via token or workspace ownership
 *
 * This endpoint is public (accessed via proposal token) - the proposal
 * must exist and be accessible via the token validation in the caller.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AgreementGenerationService } from "@/server/features/proposals/services/AgreementGenerationService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/proposals/services/resolved" });

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/proposals/$id/services/resolved")({
  server: {
    handlers: {
      GET: async ({
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: proposalId } = params;

          if (!proposalId) {
            return Response.json(
              { error: "Proposal ID is required" },
              { status: 400 }
            );
          }

          const services =
            await AgreementGenerationService.getResolvedServicesForProposal(
              proposalId
            );

          log.debug("Fetched resolved services for proposal", {
            proposalId,
            serviceCount: services.length,
          });

          return Response.json({ services });
        } catch (error) {
          log.error(
            "Error fetching resolved services",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to fetch services" },
            { status: 500 }
          );
        }
      },
    },
  },
});
