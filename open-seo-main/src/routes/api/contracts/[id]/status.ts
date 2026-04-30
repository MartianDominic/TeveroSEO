import { createAPIFileRoute } from "@tanstack/start/api";
import { ContractRepository } from "@/server/features/contracts/repositories/ContractRepository";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { ActivityRepository } from "@/server/features/contracts/repositories/ActivityRepository";
import { AppError, toClientError } from "@/server/lib/errors";
import { getAuth } from "@/server/lib/auth";

export const Route = createAPIFileRoute("/api/contracts/$id/status")({
  GET: async ({ request, params }) => {
    try {
      const auth = await getAuth(request);
      if (!auth?.workspaceId) {
        throw new AppError("UNAUTHENTICATED", "Authentication required");
      }

      const contract = await ContractRepository.getContractById(params.id);

      if (!contract || contract.workspaceId !== auth.workspaceId) {
        throw new AppError("NOT_FOUND", "Contract not found");
      }

      // Get associated invoice
      const invoices = await InvoiceRepository.getInvoicesByWorkspace(
        auth.workspaceId,
        { limit: 100 }
      );
      const invoice = invoices.find((inv) => inv.contractId === contract.id) || null;

      // Get activities
      const activities = await ActivityRepository.getActivitiesByEntity(
        "contract",
        contract.id,
        { limit: 20 }
      );

      return new Response(
        JSON.stringify({
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
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      const status =
        error instanceof AppError && error.code === "NOT_FOUND" ? 404 : 500;
      return new Response(
        JSON.stringify({
          success: false,
          error: toClientError(error).message,
        }),
        {
          status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});
