/**
 * API endpoint for contract status and details.
 * Phase 48: Contract & Payment
 *
 * GET /api/contracts/:id/status
 * Returns contract with content, invoice, and activity history.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ContractRepository } from "@/server/features/contracts/repositories/ContractRepository";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { ActivityRepository } from "@/server/features/contracts/repositories/ActivityRepository";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/contracts/status" });

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/contracts/$id/status")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          log.debug("Authenticated request for contract status", { userId: auth.userId, contractId: params.id });

          const contract = await ContractRepository.getContractById(params.id);

          if (!contract || contract.workspaceId !== auth.organizationId) {
            return Response.json(
              { success: false, error: "Contract not found" },
              { status: 404 }
            );
          }

          // Get associated invoice
          const invoices = await InvoiceRepository.getInvoicesByWorkspace(
            auth.organizationId,
            { limit: 100 }
          );
          const invoice = invoices.find((inv) => inv.contractId === contract.id) || null;

          // Get activities
          const activities = await ActivityRepository.getActivitiesByEntity(
            "contract",
            contract.id,
            { limit: 20 }
          );

          return Response.json({
            success: true,
            data: {
              ...contract,
              createdAt: contract.createdAt.toISOString(),
              updatedAt: contract.updatedAt.toISOString(),
              signedAt: contract.signedAt?.toISOString() || null,
              sentAt: contract.sentAt?.toISOString() || null,
              executedAt: contract.executedAt?.toISOString() || null,
              expiresAt: contract.expiresAt?.toISOString() || null,
              invoice: invoice
                ? {
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    status: invoice.status,
                    totalCents: invoice.totalCents,
                    currency: invoice.currency,
                    stripePaymentUrl: invoice.stripePaymentUrl,
                    paidAt: invoice.paidAt?.toISOString() || null,
                    createdAt: invoice.createdAt.toISOString(),
                  }
                : null,
              activities: activities.map((a) => ({
                id: a.id,
                activityType: a.activityType,
                activityData: a.activityData,
                createdAt: a.createdAt.toISOString(),
              })),
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json({ success: false, error: error.message }, { status: 401 });
            }
            if (error.code === "NOT_FOUND") {
              return Response.json({ success: false, error: error.message }, { status: 404 });
            }
          }

          log.error("Failed to get contract status", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to get contract status" },
            { status: 500 }
          );
        }
      },
    },
  },
});
