/**
 * Invoice Payment Schedule API
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * GET /api/invoices/:id/schedule
 * Returns existing payment schedule for an invoice.
 *
 * POST /api/invoices/:id/schedule
 * Creates a new payment schedule with the selected plan.
 * Validates planType against workspace's availablePlans.
 *
 * SECURITY MODEL (CRIT-04 review):
 * These endpoints are PUBLIC by design - clients access them via payment links
 * embedded in invoices sent via email. The invoice ID (UUID) acts as an
 * unguessable access token. This mirrors the proposal public view pattern.
 *
 * Mitigations:
 * - Invoice IDs are UUIDv4 (122-bit entropy, unguessable)
 * - POST only works on invoices with status="sent" (prevents draft manipulation)
 * - All actions are logged with IP for audit trail
 * - Rate limiting should be applied at infrastructure level (nginx/cloudflare)
 * - Schedule creation is idempotent (returns existing if already created)
 *
 * NOT a vulnerability because:
 * - No sensitive data exposed beyond what client already knows (their invoice)
 * - Actions are limited (view schedule, choose payment plan)
 * - Cannot enumerate invoices (UUID required)
 */
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { PaymentScheduleService } from "@/server/features/payments/services/PaymentScheduleService";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";
import type { PlanType } from "@/db/payment-schedule-schema";

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
  try {
    const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(workspaceId);

    if (settings?.availablePlans && settings.availablePlans.length > 0) {
      return settings.availablePlans as PlanType[];
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
  try {
    const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(workspaceId);

    if (settings) {
      // Use the splitPaymentsEnabled flag from workspace settings
      return settings.splitPaymentsEnabled === true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get existing schedule for an invoice.
 * Wired to PaymentScheduleService for persistence.
 */
async function getScheduleForInvoice(invoiceId: string): Promise<ScheduleResponse | null> {
  const result = await PaymentScheduleService.getScheduleWithInstallments(invoiceId);

  if (!result) {
    return null;
  }

  return {
    id: result.schedule.id,
    invoiceId: result.schedule.invoiceId,
    planType: result.schedule.planType as PlanType,
    totalInstallments: result.schedule.totalInstallments,
    installments: result.installments.map((inst) => ({
      id: inst.id,
      installmentNumber: inst.installmentNumber,
      amountCents: inst.amountCents,
      dueAt: inst.dueAt.toISOString(),
      status: inst.status as ScheduleInstallmentResponse["status"],
      paidAt: inst.paidAt?.toISOString() ?? null,
      paymentUrl: inst.paymentUrl ?? null,
    })),
    createdAt: result.schedule.createdAt.toISOString(),
  };
}

/**
 * Create a new schedule for an invoice.
 * Wired to PaymentScheduleService for persistence with transaction wrapping.
 */
async function createScheduleForInvoice(
  invoiceId: string,
  planType: PlanType,
  totalCents: number,
  _workspaceId: string
): Promise<ScheduleResponse> {
  const result = await PaymentScheduleService.createScheduleForInvoice(
    invoiceId,
    totalCents,
    planType
  );

  // T-60-07: Log schedule creation for audit trail
  log.info("Created payment schedule", {
    invoiceId,
    planType,
    scheduleId: result.schedule.id,
    totalInstallments: result.installments.length,
  });

  return {
    id: result.schedule.id,
    invoiceId: result.schedule.invoiceId,
    planType: result.schedule.planType as PlanType,
    totalInstallments: result.schedule.totalInstallments,
    installments: result.installments.map((inst) => ({
      id: inst.id,
      installmentNumber: inst.installmentNumber,
      amountCents: inst.amountCents,
      dueAt: inst.dueAt.toISOString(),
      status: inst.status as ScheduleInstallmentResponse["status"],
      paidAt: inst.paidAt?.toISOString() ?? null,
      paymentUrl: inst.paymentUrl ?? null,
    })),
    createdAt: result.schedule.createdAt.toISOString(),
  };
}

export const Route = createFileRoute("/api/invoices/$id/schedule")({
  server: {
    handlers: {
      /**
       * GET /api/invoices/:id/schedule
       * Returns existing schedule for an invoice, or null if none exists.
       */
      GET: async ({ params, request }: { params: { id: string }; request: Request }) => {
        try {
          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice) {
            // CRIT-04: Log failed lookups for security monitoring
            log.warn("Invoice schedule lookup failed - not found", {
              invoiceId: params.id,
              ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
            });
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          // CRIT-04: Log successful access for audit trail
          log.debug("Invoice schedule accessed", {
            invoiceId: params.id,
            workspaceId: invoice.workspaceId,
            ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
          });

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
        const clientIp = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");

        try {
          // Parse and validate request body
          const body = await request.json();
          const parsed = createScheduleSchema.safeParse(body);

          if (!parsed.success) {
            log.warn("Invalid schedule creation request", {
              invoiceId: params.id,
              ip: clientIp,
              error: parsed.error.message,
            });
            return Response.json(
              { success: false, error: "Invalid plan type" },
              { status: 400 }
            );
          }

          const { planType } = parsed.data;

          // Get invoice
          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice) {
            // CRIT-04: Log failed lookups for security monitoring
            log.warn("Schedule creation failed - invoice not found", {
              invoiceId: params.id,
              ip: clientIp,
            });
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          if (invoice.status !== "sent") {
            // CRIT-04: Log attempts to schedule non-sent invoices
            log.warn("Schedule creation rejected - invalid invoice status", {
              invoiceId: params.id,
              status: invoice.status,
              ip: clientIp,
            });
            return Response.json(
              { success: false, error: "Invoice is not available for payment" },
              { status: 400 }
            );
          }

          // CRIT-04: Log schedule creation attempt for audit trail
          log.info("Payment schedule creation requested", {
            invoiceId: params.id,
            workspaceId: invoice.workspaceId,
            planType,
            ip: clientIp,
          });

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
              // P60-H04: Create a modified invoice-like object with installment metadata
              // The installmentId is critical for webhook routing to handle installment payments
              const installmentInvoice = {
                ...invoice,
                totalCents: firstInstallment.amountCents,
                // Metadata for installment tracking - used by webhook handler
                // This extends the invoice object for createPaymentSession
                installmentMetadata: {
                  installmentId: firstInstallment.id,
                  invoiceId: invoice.id,
                  workspaceId: invoice.workspaceId,
                  scheduleId: schedule.id,
                  installmentNumber: String(firstInstallment.installmentNumber),
                },
              };

              const session = await provider.createPaymentSession(installmentInvoice as any);
              checkoutUrl = session.paymentUrl;

              // Update first installment with payment URL in the database
              await PaymentScheduleService.updateInstallmentStatus(
                firstInstallment.id,
                "pending",
                { paymentUrl: session.paymentUrl }
              );

              // Update local object for response
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
