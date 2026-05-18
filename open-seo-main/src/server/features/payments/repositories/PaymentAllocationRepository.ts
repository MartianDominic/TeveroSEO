/**
 * PaymentAllocationRepository - Data access for payment allocations
 * Phase 101-02: Payment Reconciliation
 *
 * Handles CRUD for payment_allocations table, supporting:
 * - Split payments (one payment -> multiple invoices)
 * - Partial payments (multiple payments -> one invoice)
 *
 * Security (H-05, H-15):
 * - ALL queries scoped by workspaceId via join with payments table
 * - Soft-deleted payments excluded via isNull(payments.softDeletedAt)
 */
import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  paymentAllocations,
  payments,
  type PaymentAllocationSelect,
  type PaymentAllocationInsert,
} from "@/db/payment-schema";
import { createId } from "@paralleldrive/cuid2";

export const PaymentAllocationRepository = {
  /**
   * Create a new payment allocation.
   *
   * REPO-01 FIX: Verifies payment belongs to workspace before creating allocation.
   * This prevents cross-tenant access if called directly with a paymentId from
   * a different workspace.
   *
   * @param data - Allocation data (paymentId, invoiceId, allocatedCents)
   * @param workspaceId - Workspace for tenant isolation verification
   */
  async create(
    data: Omit<PaymentAllocationInsert, "id">,
    workspaceId?: string
  ): Promise<PaymentAllocationSelect> {
    // REPO-01 FIX: Verify payment belongs to workspace before creating allocation
    if (workspaceId) {
      const [payment] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.id, data.paymentId),
            eq(payments.workspaceId, workspaceId),
            isNull(payments.softDeletedAt)
          )
        )
        .limit(1);

      if (!payment) {
        throw new Error(
          `Payment not found or access denied: ${data.paymentId}`
        );
      }
    }

    const [allocation] = await db
      .insert(paymentAllocations)
      .values({
        id: createId(),
        ...data,
      })
      .returning();
    return allocation;
  },

  /**
   * Find all allocations for a payment.
   * Scoped by workspaceId and excludes soft-deleted payments (H-05, H-15).
   */
  async findByPaymentId(
    paymentId: string,
    workspaceId: string
  ): Promise<PaymentAllocationSelect[]> {
    return db
      .select({
        id: paymentAllocations.id,
        paymentId: paymentAllocations.paymentId,
        invoiceId: paymentAllocations.invoiceId,
        allocatedCents: paymentAllocations.allocatedCents,
        createdAt: paymentAllocations.createdAt,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(
        and(
          eq(paymentAllocations.paymentId, paymentId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );
  },

  /**
   * Find all allocations for an invoice.
   * Scoped by workspaceId via payment join and excludes soft-deleted payments (H-05, H-15).
   */
  async findByInvoiceId(
    invoiceId: string,
    workspaceId: string
  ): Promise<PaymentAllocationSelect[]> {
    return db
      .select({
        id: paymentAllocations.id,
        paymentId: paymentAllocations.paymentId,
        invoiceId: paymentAllocations.invoiceId,
        allocatedCents: paymentAllocations.allocatedCents,
        createdAt: paymentAllocations.createdAt,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(
        and(
          eq(paymentAllocations.invoiceId, invoiceId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );
  },

  /**
   * Get total allocated amount for a payment (sum of all allocations).
   * Scoped by workspaceId and excludes soft-deleted payments (H-05, H-15).
   */
  async getTotalAllocatedForPayment(
    paymentId: string,
    workspaceId: string
  ): Promise<number> {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${paymentAllocations.allocatedCents}), 0)`,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(
        and(
          eq(paymentAllocations.paymentId, paymentId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );
    return Number(result?.total ?? 0);
  },

  /**
   * Get total allocated amount for an invoice (sum of all allocations).
   * Scoped by workspaceId via payment join and excludes soft-deleted payments (H-05, H-15).
   */
  async getTotalAllocatedForInvoice(
    invoiceId: string,
    workspaceId: string
  ): Promise<number> {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${paymentAllocations.allocatedCents}), 0)`,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(
        and(
          eq(paymentAllocations.invoiceId, invoiceId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );
    return Number(result?.total ?? 0);
  },

  /**
   * Delete allocation by ID.
   * Scoped by workspaceId to prevent cross-tenant deletion (H-05, H-15).
   */
  async delete(allocationId: string, workspaceId: string): Promise<void> {
    // First verify the allocation belongs to a payment in this workspace
    const [allocation] = await db
      .select({ id: paymentAllocations.id })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(
        and(
          eq(paymentAllocations.id, allocationId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      )
      .limit(1);

    if (!allocation) {
      throw new Error(`Allocation not found or access denied: ${allocationId}`);
    }

    await db
      .delete(paymentAllocations)
      .where(eq(paymentAllocations.id, allocationId));
  },

  /**
   * Delete all allocations for a payment.
   * Scoped by workspaceId to prevent cross-tenant deletion (H-05, H-15).
   */
  async deleteByPaymentId(paymentId: string, workspaceId: string): Promise<void> {
    // First verify the payment belongs to this workspace and is not soft-deleted
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      )
      .limit(1);

    if (!payment) {
      throw new Error(`Payment not found or access denied: ${paymentId}`);
    }

    await db
      .delete(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId));
  },
};
