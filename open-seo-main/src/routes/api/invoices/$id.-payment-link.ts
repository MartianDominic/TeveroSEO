/**
 * API endpoint for invoice payment link retrieval.
 * Phase 48-03: Contract & Payment - Invoice payment
 *
 * GET /api/invoices/:id/payment-link
 * Returns Stripe payment URL for an invoice.
 *
 * SECURITY: Requires authentication and workspace ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/invoices/payment-link" });

export const Route = createFileRoute("/api/invoices/$id/-payment-link")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: auth.userId });

          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice || invoice.workspaceId !== auth.organizationId) {
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          if (!invoice.stripePaymentUrl) {
            return Response.json(
              { success: false, error: "Payment link not available" },
              { status: 404 }
            );
          }

          return Response.json({
            success: true,
            data: { paymentUrl: invoice.stripePaymentUrl }
          });
        } catch (error) {
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
          }

          log.error("Failed to get payment link", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Failed to get payment link" },
            { status: 500 }
          );
        }
      },
    },
  },
});
