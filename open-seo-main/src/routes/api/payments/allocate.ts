/**
 * Payment Allocation API Route
 * Phase 101-02: Payment Reconciliation
 *
 * POST /api/payments/allocate - Allocate payment to invoice(s)
 * POST /api/payments/allocate/credits - Apply client credits to invoice
 *
 * Supports:
 * - Single invoice allocation (full or partial)
 * - Split payments (one payment -> multiple invoices)
 * - Overpayment credits
 * - Client credit application
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PaymentAllocationService } from "@/server/features/payments/services/PaymentAllocationService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import {
  paymentAllocateRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";

const log = createLogger({ module: "PaymentAllocateAPI" });

/**
 * Single allocation schema
 */
const SingleAllocationSchema = z.object({
  type: z.literal("single"),
  paymentId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountCents: z.number().int().positive(),
  createCreditForOverpayment: z.boolean().optional(),
  clientId: z.string().optional(), // Required if createCreditForOverpayment is true
});

/**
 * Split allocation schema (one payment -> multiple invoices)
 */
const SplitAllocationSchema = z.object({
  type: z.literal("split"),
  paymentId: z.string().min(1),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().min(1),
        amountCents: z.number().int().positive(),
      })
    )
    .min(2, "Split allocation requires at least 2 invoices"),
  createCreditForOverpayment: z.boolean().optional(),
  clientId: z.string().optional(),
});

/**
 * Apply credits schema
 */
const ApplyCreditsSchema = z.object({
  type: z.literal("credits"),
  clientId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountToCover: z.number().int().positive(),
});

const AllocationRequestSchema = z.discriminatedUnion("type", [
  SingleAllocationSchema,
  SplitAllocationSchema,
  ApplyCreditsSchema,
]);

export const Route = createFileRoute("/api/payments/allocate")({
  server: {
    handlers: {
      /**
       * POST /api/payments/allocate
       * Allocate payment to invoice(s) or apply credits.
       *
       * Body types:
       * - { type: "single", paymentId, invoiceId, amountCents }
       * - { type: "split", paymentId, allocations: [{invoiceId, amountCents}] }
       * - { type: "credits", clientId, invoiceId, amountToCover }
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          // M-SEC-01: Rate limit financial endpoints (10 req/min per user)
          const rateLimitResult = await paymentAllocateRateLimiter(auth.userId);
          if (!rateLimitResult.allowed) {
            log.warn("Rate limit exceeded for payment allocation", {
              userId: auth.userId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          const body = (await request.json()) as Record<string, unknown>;

          const parsed = AllocationRequestSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parsed.error.issues.map((issue) => ({
                  path: issue.path,
                  message: issue.message,
                })),
              },
              { status: 422 }
            );
          }

          const data = parsed.data;

          switch (data.type) {
            case "single": {
              const result = await PaymentAllocationService.allocateToInvoice(
                data.paymentId,
                data.invoiceId,
                data.amountCents,
                auth.organizationId
              );

              // Handle overpayment credit if requested
              let credit = null;
              if (data.createCreditForOverpayment && result.remainingUnallocated > 0) {
                if (!data.clientId) {
                  return Response.json(
                    { success: false, error: "clientId required for overpayment credit" },
                    { status: 422 }
                  );
                }
                const creditResult = await PaymentAllocationService.createOverpaymentCredit(
                  data.paymentId,
                  data.clientId,
                  auth.organizationId
                );
                credit = creditResult.credit;
              }

              log.info("Single allocation completed", {
                paymentId: data.paymentId,
                invoiceId: data.invoiceId,
                amountCents: data.amountCents,
                remainingUnallocated: result.remainingUnallocated,
                creditCreated: !!credit,
              });

              return addRateLimitHeaders(
                Response.json({
                  success: true,
                  data: {
                    allocation: result.allocation,
                    remainingUnallocated: result.remainingUnallocated,
                    credit,
                  },
                }),
                rateLimitResult
              );
            }

            case "split": {
              const result = await PaymentAllocationService.allocateToMultiple(
                data.paymentId,
                data.allocations,
                auth.organizationId
              );

              // Handle overpayment credit if requested
              let credit = null;
              if (data.createCreditForOverpayment && result.remainingUnallocated > 0) {
                if (!data.clientId) {
                  return Response.json(
                    { success: false, error: "clientId required for overpayment credit" },
                    { status: 422 }
                  );
                }
                const creditResult = await PaymentAllocationService.createOverpaymentCredit(
                  data.paymentId,
                  data.clientId,
                  auth.organizationId
                );
                credit = creditResult.credit;
              }

              log.info("Split allocation completed", {
                paymentId: data.paymentId,
                allocationCount: result.allocations.length,
                remainingUnallocated: result.remainingUnallocated,
                creditCreated: !!credit,
              });

              return addRateLimitHeaders(
                Response.json({
                  success: true,
                  data: {
                    allocations: result.allocations,
                    remainingUnallocated: result.remainingUnallocated,
                    credit,
                  },
                }),
                rateLimitResult
              );
            }

            case "credits": {
              const result = await PaymentAllocationService.applyCreditsToInvoice(
                data.clientId,
                data.invoiceId,
                data.amountToCover,
                auth.organizationId
              );

              log.info("Credits applied to invoice", {
                clientId: data.clientId,
                invoiceId: data.invoiceId,
                totalApplied: result.totalApplied,
                remainingToCover: result.remainingToCover,
                creditsUsedCount: result.creditsUsed.length,
              });

              return addRateLimitHeaders(
                Response.json({ success: true, data: result }),
                rateLimitResult
              );
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("UNAUTHENTICATED")) {
            return Response.json(
              { success: false, error: "Unauthorized" },
              { status: 401 }
            );
          }

          if (error instanceof Error && error.message.includes("not found")) {
            return Response.json(
              { success: false, error: error.message },
              { status: 404 }
            );
          }

          if (
            error instanceof Error &&
            (error.message.includes("Cannot allocate") ||
              error.message.includes("exceeds unallocated"))
          ) {
            return Response.json(
              { success: false, error: error.message },
              { status: 400 }
            );
          }

          log.error(
            "Failed to process allocation",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Failed to process allocation" },
            { status: 500 }
          );
        }
      },
    },
  },
});
