/**
 * Invoice Payment Schedule API
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * GET /api/invoices/:id/schedule
 * Returns existing payment schedule for an invoice.
 * PUBLIC endpoint - clients access via shared link.
 *
 * POST /api/invoices/:id/schedule
 * Creates a new payment schedule with the selected plan.
 * Validates planType against workspace's availablePlans.
 */
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";
import {
  calculatePlan,
  type PlanType,
} from "@/lib/format-currency";

const log = createLogger({ module: "api/invoices/schedule" });

/**
 * Supported plan types.
 * T-60-05: Validated against workspace's availablePlans whitelist.
 */
const VALID_PLAN_TYPES = ["full", "split_2", "split_3"] as const;

/**
 * Request schema for creating a schedule.
 */
const createScheduleSchema = z.object({
  planType: z.enum(VALID_PLAN_TYPES),
});

/**
 * Schedule installment shape returned by API.
 */
interface ScheduleInstallmentResponse {
  id: string;
  installmentNumber: number;
  amountCents: number;
  dueAt: string; // ISO date string
  status: "pending" | "processing" | "paid" | "overdue" | "failed";
  paidAt: string | null;
  paymentUrl: string | null;
}

/**
 * Schedule response shape.
 */
interface ScheduleResponse {
  id: string;
  invoiceId: string;
  planType: PlanType;
  totalInstallments: number;
  installments: ScheduleInstallmentResponse[];
  createdAt: string;
}

/**
 * Default available plans when workspace settings not configured.
 */
const DEFAULT_AVAILABLE_PLANS: PlanType[] = ["full", "split_2", "split_3"];

/**
 * Get available plans for a workspace.
 * Falls back to all plans if not configured.
 */
async function getAvailablePlans(workspaceId: string): Promise<PlanType[]> {
  // TODO: Once 60-01 adds splitPaymentsEnabled and availablePlans to
  // WorkspacePaymentSettingsRepository, use those values.
  // For now, return all plans as available.
  try {
    const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(workspaceId);

    // Check if split payments are enabled via extended settings
    // Once 60-01 completes, this will read from actual settings
    if (settings) {
      // Placeholder: Return all plans for now
      // TODO: return settings.availablePlans ?? DEFAULT_AVAILABLE_PLANS;
      return DEFAULT_AVAILABLE_PLANS;
    }

    return DEFAULT_AVAILABLE_PLANS;
  } catch {
    return DEFAULT_AVAILABLE_PLANS;
  }
}

/**
 * Check if split payments are enabled for a workspace.
 */
async function isSplitPaymentsEnabled(workspaceId: string): Promise<boolean> {
  // TODO: Once 60-01 adds splitPaymentsEnabled to settings, use that.
  // For now, return true to enable split payments.
  try {
    const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(workspaceId);

    // Placeholder: Enable split payments if any provider is configured
    if (settings && (settings.stripeEnabled || settings.revolutEnabled)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get existing schedule for an invoice.
 * TODO: Replace with PaymentScheduleService.getScheduleWithInstallments once 60-01 completes.
 */
async function getScheduleForInvoice(invoiceId: string): Promise<ScheduleResponse | null> {
  // TODO: Once 60-01 creates PaymentScheduleService and schema,
  // call PaymentScheduleService.getScheduleWithInstallments(invoiceId)
  // For now, return null (no schedule exists)
  return null;
}

/**
 * Create a new schedule for an invoice.
 * TODO: Replace with PaymentScheduleService.createScheduleForInvoice once 60-01 completes.
 */
async function createScheduleForInvoice(
  invoiceId: string,
  planType: PlanType,
  totalCents: number,
  _workspaceId: string
): Promise<ScheduleResponse> {
  // Calculate plan breakdown
  const plan = calculatePlan(totalCents, planType);

  // Generate schedule ID
  const scheduleId = crypto.randomUUID();
  const now = new Date();

  // Create installment records
  // TODO: Once 60-01 creates the schema, persist to database
  const installments: ScheduleInstallmentResponse[] = plan.installments.map((inst, index) => ({
    id: `${scheduleId}-${index + 1}`,
    installmentNumber: inst.number,
    amountCents: inst.amount,
    dueAt: inst.dueDate.toISOString(),
    status: "pending" as const,
    paidAt: null,
    paymentUrl: null, // Will be set when checkout is created
  }));

  // T-60-07: Log schedule creation for audit trail
  log.info("Created payment schedule", {
    invoiceId,
    planType,
    scheduleId,
    totalInstallments: installments.length,
  });

  return {
    id: scheduleId,
    invoiceId,
    planType,
    totalInstallments: installments.length,
    installments,
    createdAt: now.toISOString(),
  };
}

export const Route = createFileRoute("/api/invoices/$id/schedule")({
  server: {
    handlers: {
      /**
       * GET /api/invoices/:id/schedule
       * Returns existing schedule for an invoice, or null if none exists.
       */
      GET: async ({ params }: { params: { id: string } }) => {
        try {
          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice) {
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          // T-60-08: Check if schedule already exists
          const existingSchedule = await getScheduleForInvoice(params.id);

          return Response.json({
            success: true,
            data: {
              schedule: existingSchedule,
            },
          });
        } catch (error) {
          log.error(
            "Failed to get payment schedule",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Failed to load schedule" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/invoices/:id/schedule
       * Creates a new payment schedule with the selected plan.
       * Returns the schedule and checkout URL for the first installment.
       */
      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          // Parse and validate request body
          const body = await request.json();
          const parsed = createScheduleSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Invalid plan type" },
              { status: 400 }
            );
          }

          const { planType } = parsed.data;

          // Get invoice
          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice) {
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          if (invoice.status !== "sent") {
            return Response.json(
              { success: false, error: "Invoice is not available for payment" },
              { status: 400 }
            );
          }

          // T-60-05: Validate planType against workspace's availablePlans whitelist
          const availablePlans = await getAvailablePlans(invoice.workspaceId);
          if (!availablePlans.includes(planType)) {
            return Response.json(
              { success: false, error: "Selected payment plan is not available" },
              { status: 400 }
            );
          }

          // Check if split payments are enabled
          const splitEnabled = await isSplitPaymentsEnabled(invoice.workspaceId);
          if (!splitEnabled && planType !== "full") {
            return Response.json(
              { success: false, error: "Split payments are not enabled for this workspace" },
              { status: 400 }
            );
          }

          // T-60-08: Check if schedule already exists
          const existingSchedule = await getScheduleForInvoice(params.id);
          if (existingSchedule) {
            // Return existing schedule instead of creating new one
            return Response.json({
              success: true,
              data: {
                schedule: existingSchedule,
                checkoutUrl: existingSchedule.installments[0]?.paymentUrl || null,
              },
            });
          }

          // Create the schedule
          const schedule = await createScheduleForInvoice(
            params.id,
            planType,
            invoice.totalCents,
            invoice.workspaceId
          );

          // Create checkout session for first installment
          let checkoutUrl: string | null = null;

          try {
            // Get payment provider
            const provider = await PaymentProviderFactory.getProvider({
              workspaceId: invoice.workspaceId,
            });

            // Create a checkout session for the first installment amount
            const firstInstallment = schedule.installments[0];
            if (firstInstallment) {
              // Create a modified invoice-like object for the first installment
              const installmentInvoice = {
                ...invoice,
                totalCents: firstInstallment.amountCents,
                // Add metadata for installment tracking
              };

              const session = await provider.createPaymentSession(installmentInvoice);
              checkoutUrl = session.paymentUrl;

              // Update first installment with payment URL
              firstInstallment.paymentUrl = session.paymentUrl;
            }
          } catch (paymentError) {
            log.error(
              "Failed to create checkout session for first installment",
              paymentError instanceof Error ? paymentError : new Error(String(paymentError))
            );
            // Continue without checkout URL - client can retry
          }

          return Response.json({
            success: true,
            data: {
              schedule,
              checkoutUrl,
            },
          });
        } catch (error) {
          log.error(
            "Failed to create payment schedule",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Failed to create payment schedule" },
            { status: 500 }
          );
        }
      },
    },
  },
});
