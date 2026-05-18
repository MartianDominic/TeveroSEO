/**
 * PaymentAllocationService - Business logic for payment allocation
 * Phase 101-02: Payment Reconciliation
 *
 * Implements allocation operations from CONTEXT.md D-02:
 * - Single payment -> single invoice (full or partial)
 * - Split payments (one payment -> multiple invoices)
 * - Overpayment -> client credit
 * - Apply credits to invoices
 *
 * H-08 FIX: allocateToInvoice uses transaction with FOR UPDATE lock
 * to prevent double allocation race condition.
 */
import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { PaymentAllocationRepository } from "../repositories/PaymentAllocationRepository";
import { ClientCreditRepository } from "../repositories/ClientCreditRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { createLogger } from "@/server/lib/logger";
import {
  payments,
  paymentAllocations,
  type PaymentAllocationSelect,
  type ClientCreditSelect,
} from "@/db/payment-schema";
import { createId } from "@paralleldrive/cuid2";

const log = createLogger({ module: "PaymentAllocationService" });

export interface AllocationResult {
  allocation: PaymentAllocationSelect;
  remainingUnallocated: number;
}

export interface MultiAllocationResult {
  allocations: PaymentAllocationSelect[];
  remainingUnallocated: number;
}

export interface OverpaymentCreditResult {
  credit: ClientCreditSelect | null;
  overpaymentAmount: number;
}

export interface CreditApplicationResult {
  totalApplied: number;
  remainingToCover: number;
  creditsUsed: Array<{
    creditId: string;
    amountUsed: number;
  }>;
}

export const PaymentAllocationService = {
  /**
   * Allocate a payment (or part of it) to a single invoice.
   *
   * H-08 FIX: Uses database transaction with FOR UPDATE lock to prevent
   * double allocation race condition. Concurrent requests will serialize
   * on the payment row lock.
   *
   * @param paymentId - The payment to allocate from
   * @param invoiceId - The invoice to allocate to
   * @param amountCents - Amount to allocate
   * @param workspaceId - Workspace for tenant isolation
   */
  async allocateToInvoice(
    paymentId: string,
    invoiceId: string,
    amountCents: number,
    workspaceId: string
  ): Promise<AllocationResult> {
    // H-08: Wrap entire check-and-allocate in transaction with row lock
    return await db.transaction(async (tx) => {
      // Lock payment row for update - prevents concurrent modifications
      const [payment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, paymentId),
            eq(payments.workspaceId, workspaceId),
            isNull(payments.softDeletedAt)
          )
        )
        .for("update"); // PostgreSQL row-level lock

      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      // Calculate available balance within locked transaction
      const [allocSum] = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${paymentAllocations.allocatedCents}), 0)`,
        })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      const totalAllocated = Number(allocSum?.total ?? 0);
      const unallocatedBalance = payment.netAmountCents - totalAllocated;

      if (amountCents > unallocatedBalance) {
        throw new Error(
          `Cannot allocate ${amountCents} cents. Unallocated balance is ${unallocatedBalance} cents.`
        );
      }

      // Create allocation within same transaction
      const [allocation] = await tx
        .insert(paymentAllocations)
        .values({
          id: createId(),
          paymentId,
          invoiceId,
          allocatedCents: amountCents,
        })
        .returning();

      // Calculate new remaining balance
      const remainingUnallocated = unallocatedBalance - amountCents;

      // Update payment status to 'allocated' if fully allocated
      const newTotal = totalAllocated + amountCents;
      await tx
        .update(payments)
        .set({
          status: "allocated",
          matchedInvoiceId: invoiceId,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      log.info("Payment allocated to invoice (atomic)", {
        paymentId,
        invoiceId,
        allocatedCents: amountCents,
        remainingUnallocated,
        fullyAllocated: newTotal === payment.netAmountCents,
      });

      return {
        allocation,
        remainingUnallocated,
      };
    });
  },

  /**
   * Allocate a payment to multiple invoices (split payment).
   *
   * RACE-01 FIX: Uses database transaction with FOR UPDATE lock to prevent
   * TOCTOU race condition. Same pattern as allocateToInvoice().
   *
   * @param paymentId - The payment to allocate from
   * @param allocations - Array of { invoiceId, amountCents } to allocate
   * @param workspaceId - Workspace for tenant isolation
   */
  async allocateToMultiple(
    paymentId: string,
    allocations: Array<{ invoiceId: string; amountCents: number }>,
    workspaceId: string
  ): Promise<MultiAllocationResult> {
    // RACE-01 FIX: Wrap entire check-and-allocate in transaction with row lock
    return await db.transaction(async (tx) => {
      // Lock payment row for update - prevents concurrent modifications
      const [payment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, paymentId),
            eq(payments.workspaceId, workspaceId),
            isNull(payments.softDeletedAt)
          )
        )
        .for("update"); // PostgreSQL row-level lock

      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      // Calculate available balance within locked transaction
      const [allocSum] = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${paymentAllocations.allocatedCents}), 0)`,
        })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      const totalAllocated = Number(allocSum?.total ?? 0);
      const unallocatedBalance = payment.netAmountCents - totalAllocated;

      // Calculate total requested allocation
      const totalRequested = allocations.reduce((sum, a) => sum + a.amountCents, 0);
      if (totalRequested > unallocatedBalance) {
        throw new Error(
          `Total allocation ${totalRequested} exceeds unallocated balance ${unallocatedBalance}`
        );
      }

      // Create all allocations within same transaction
      const createdAllocations: PaymentAllocationSelect[] = [];
      for (const alloc of allocations) {
        const [created] = await tx
          .insert(paymentAllocations)
          .values({
            id: createId(),
            paymentId,
            invoiceId: alloc.invoiceId,
            allocatedCents: alloc.amountCents,
          })
          .returning();
        createdAllocations.push(created);
      }

      // Update payment status within transaction
      await tx
        .update(payments)
        .set({
          status: "allocated",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      const remainingUnallocated = unallocatedBalance - totalRequested;

      log.info("Payment split across multiple invoices (atomic)", {
        paymentId,
        invoiceCount: allocations.length,
        totalAllocated: totalRequested,
        remainingUnallocated,
      });

      return {
        allocations: createdAllocations,
        remainingUnallocated,
      };
    });
  },

  /**
   * Create a client credit from overpayment (payment amount > allocated amount).
   *
   * @param paymentId - The payment with excess amount
   * @param clientId - The client to credit
   * @param workspaceId - Workspace for tenant isolation
   */
  async createOverpaymentCredit(
    paymentId: string,
    clientId: string,
    workspaceId: string
  ): Promise<OverpaymentCreditResult> {
    const payment = await PaymentRepository.findById(paymentId, workspaceId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    // Calculate overpayment (workspace-scoped per H-05)
    const totalAllocated = await PaymentAllocationRepository.getTotalAllocatedForPayment(paymentId, workspaceId);
    const overpaymentAmount = payment.netAmountCents - totalAllocated;

    if (overpaymentAmount <= 0) {
      log.info("No overpayment to credit", { paymentId, totalAllocated });
      return {
        credit: null,
        overpaymentAmount: 0,
      };
    }

    // Create client credit
    const credit = await ClientCreditRepository.create({
      workspaceId,
      clientId,
      sourcePaymentId: paymentId,
      amountCents: overpaymentAmount,
      usedCents: 0,
      currency: payment.currency ?? "EUR",
      reason: "overpayment",
    });

    log.info("Overpayment credit created", {
      paymentId,
      clientId,
      creditId: credit.id,
      amountCents: overpaymentAmount,
    });

    return {
      credit,
      overpaymentAmount,
    };
  },

  /**
   * Apply available client credits to an invoice.
   * Uses credits in FIFO order (oldest first) until amount is covered or credits exhausted.
   *
   * @param clientId - The client whose credits to use
   * @param invoiceId - The invoice to apply credits to
   * @param amountToCover - Amount needed to cover (in cents)
   * @param workspaceId - Workspace for tenant isolation
   */
  async applyCreditsToInvoice(
    clientId: string,
    invoiceId: string,
    amountToCover: number,
    workspaceId: string
  ): Promise<CreditApplicationResult> {
    // Get available credits for client
    const availableCredits = await ClientCreditRepository.findAvailableByClientId(
      clientId,
      workspaceId
    );

    if (availableCredits.length === 0) {
      return {
        totalApplied: 0,
        remainingToCover: amountToCover,
        creditsUsed: [],
      };
    }

    let remainingToCover = amountToCover;
    const creditsUsed: Array<{ creditId: string; amountUsed: number }> = [];

    // Apply credits in order (FIFO by createdAt)
    for (const credit of availableCredits) {
      if (remainingToCover <= 0) break;

      const availableInCredit = credit.amountCents - (credit.usedCents ?? 0);
      const amountToUse = Math.min(availableInCredit, remainingToCover);

      if (amountToUse > 0) {
        // Atomic credit use with race condition protection (H-18)
        const result = await ClientCreditRepository.useCredit(credit.id, workspaceId, amountToUse);

        if (result.success) {
          creditsUsed.push({
            creditId: credit.id,
            amountUsed: amountToUse,
          });
          remainingToCover -= amountToUse;
        } else {
          // Credit was depleted by concurrent request or expired - skip and try next
          log.warn("Credit use failed (concurrent depletion or expired)", {
            creditId: credit.id,
            attemptedAmount: amountToUse,
          });
        }
      }
    }

    const totalApplied = amountToCover - remainingToCover;

    log.info("Credits applied to invoice", {
      clientId,
      invoiceId,
      totalApplied,
      remainingToCover,
      creditsUsedCount: creditsUsed.length,
    });

    return {
      totalApplied,
      remainingToCover,
      creditsUsed,
    };
  },
};
