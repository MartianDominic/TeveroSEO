/**
 * PaymentReviewService - Review queue management for low-confidence matches
 * Phase 101-02: Payment Reconciliation
 *
 * Handles payments in review queue (< 90% confidence):
 * - List payments needing review
 * - Get suggested matches for a payment
 * - Accept or reject suggested match
 * - Manual match assignment
 */
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, type PaymentSelect } from "@/db/payment-schema";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { AutoMatchEngine } from "./AutoMatchEngine";
import { PaymentAllocationService } from "./PaymentAllocationService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "PaymentReviewService" });

export interface ReviewQueueItem {
  payment: PaymentSelect;
  suggestions: Array<{
    id: string;
    invoiceNumber: string;
    totalCents: number;
    confidence: number;
  }>;
}

export interface ReviewDecision {
  action: "accept" | "reject" | "manual";
  invoiceId?: string;
  allocations?: Array<{ invoiceId: string; amountCents: number }>;
}

export const PaymentReviewService = {
  /**
   * Get all payments in review queue for a workspace.
   * Returns payments with status 'review' and their match suggestions.
   */
  async getReviewQueue(
    workspaceId: string,
    limit = 50
  ): Promise<ReviewQueueItem[]> {
    const reviewPayments = await PaymentRepository.findByWorkspace(workspaceId, {
      status: "review",
      limit,
    });

    // Get suggestions for each payment
    const queueItems: ReviewQueueItem[] = [];
    for (const payment of reviewPayments) {
      const matchResult = await AutoMatchEngine.autoMatch(payment);
      queueItems.push({
        payment,
        suggestions: matchResult.suggestedInvoices ?? [],
      });
    }

    log.info("Review queue retrieved", {
      workspaceId,
      count: queueItems.length,
    });

    return queueItems;
  },

  /**
   * Get a single payment's review details.
   */
  async getReviewItem(
    paymentId: string,
    workspaceId: string
  ): Promise<ReviewQueueItem | null> {
    const payment = await PaymentRepository.findById(paymentId, workspaceId);
    if (!payment) {
      return null;
    }

    const matchResult = await AutoMatchEngine.autoMatch(payment);
    return {
      payment,
      suggestions: matchResult.suggestedInvoices ?? [],
    };
  },

  /**
   * Process a review decision for a payment.
   *
   * @param paymentId - Payment being reviewed
   * @param decision - Accept suggested, reject, or manually assign
   * @param workspaceId - Workspace for tenant isolation
   */
  async processReviewDecision(
    paymentId: string,
    decision: ReviewDecision,
    workspaceId: string
  ): Promise<PaymentSelect> {
    const payment = await PaymentRepository.findById(paymentId, workspaceId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== "review") {
      throw new Error(`Payment ${paymentId} is not in review queue (status: ${payment.status})`);
    }

    switch (decision.action) {
      case "accept":
        if (!decision.invoiceId) {
          throw new Error(
            "Accept decision requires an invoiceId. " +
            "Use 'manual' action to manually assign an invoice, or " +
            "'reject' to mark as unmatchable."
          );
        }
        return this.acceptSuggestedMatch(payment, decision.invoiceId, workspaceId);

      case "reject":
        return this.rejectMatch(payment, workspaceId);

      case "manual":
        if (decision.allocations && decision.allocations.length > 1) {
          // Split payment across multiple invoices
          await PaymentAllocationService.allocateToMultiple(
            paymentId,
            decision.allocations,
            workspaceId
          );
          return (await PaymentRepository.findById(paymentId, workspaceId))!;
        } else if (decision.invoiceId) {
          // Single invoice assignment
          await PaymentAllocationService.allocateToInvoice(
            paymentId,
            decision.invoiceId,
            payment.netAmountCents,
            workspaceId
          );
          return (await PaymentRepository.findById(paymentId, workspaceId))!;
        }
        throw new Error("Manual decision requires invoiceId or allocations");

      default:
        throw new Error(`Unknown decision action: ${decision.action}`);
    }
  },

  /**
   * Accept a suggested match for a payment.
   */
  async acceptSuggestedMatch(
    payment: PaymentSelect,
    invoiceId: string,
    workspaceId: string
  ): Promise<PaymentSelect> {
    // Allocate full payment to the invoice
    await PaymentAllocationService.allocateToInvoice(
      payment.id,
      invoiceId,
      payment.netAmountCents,
      workspaceId
    );

    // Update status to matched (manual match)
    const updated = await PaymentRepository.updateStatus(
      payment.id,
      workspaceId,
      "matched",
      {
        matchedInvoiceId: invoiceId,
        confidence: 100, // Manual confirmation is 100%
        matchType: "manual",
      }
    );

    log.info("Suggested match accepted", {
      paymentId: payment.id,
      invoiceId,
    });

    return updated!;
  },

  /**
   * Reject all suggestions - mark as needing further review or manual handling.
   */
  async rejectMatch(
    payment: PaymentSelect,
    workspaceId: string
  ): Promise<PaymentSelect> {
    // Keep in review but clear any partial match data
    const updated = await PaymentRepository.updateStatus(
      payment.id,
      workspaceId,
      "review",
      {
        matchedInvoiceId: undefined,
        confidence: 0,
        matchType: "none",
      }
    );

    log.info("Match rejected", { paymentId: payment.id });

    return updated!;
  },

  /**
   * Get review queue statistics for a workspace.
   * Uses SQL aggregation for accurate counts (no arbitrary limits).
   */
  async getReviewStats(workspaceId: string): Promise<{
    pendingCount: number;
    reviewCount: number;
    matchedCount: number;
    allocatedCount: number;
    totalUnmatched: number;
    pendingAmountCents: number;
    reviewAmountCents: number;
  }> {
    const [stats] = await db
      .select({
        pendingCount: sql<number>`CAST(COUNT(*) FILTER (WHERE ${payments.status} = 'pending') AS INTEGER)`,
        reviewCount: sql<number>`CAST(COUNT(*) FILTER (WHERE ${payments.status} = 'review') AS INTEGER)`,
        matchedCount: sql<number>`CAST(COUNT(*) FILTER (WHERE ${payments.status} = 'matched') AS INTEGER)`,
        allocatedCount: sql<number>`CAST(COUNT(*) FILTER (WHERE ${payments.status} = 'allocated') AS INTEGER)`,
        pendingAmountCents: sql<number>`CAST(COALESCE(SUM(${payments.netAmountCents}) FILTER (WHERE ${payments.status} = 'pending'), 0) AS INTEGER)`,
        reviewAmountCents: sql<number>`CAST(COALESCE(SUM(${payments.netAmountCents}) FILTER (WHERE ${payments.status} = 'review'), 0) AS INTEGER)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );

    const pendingCount = stats?.pendingCount ?? 0;
    const reviewCount = stats?.reviewCount ?? 0;

    return {
      pendingCount,
      reviewCount,
      matchedCount: stats?.matchedCount ?? 0,
      allocatedCount: stats?.allocatedCount ?? 0,
      totalUnmatched: pendingCount + reviewCount,
      pendingAmountCents: stats?.pendingAmountCents ?? 0,
      reviewAmountCents: stats?.reviewAmountCents ?? 0,
    };
  },
};
