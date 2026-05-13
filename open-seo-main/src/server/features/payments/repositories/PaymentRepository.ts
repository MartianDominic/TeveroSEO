/**
 * Payment Repository
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * CRUD operations for the payments table.
 * All queries scoped by workspaceId for tenant isolation (T-101-04).
 */
import { eq, and, desc, isNull } from "drizzle-orm";
import { db, type DrizzleTransaction } from "@/db";
import {
  payments,
  type PaymentInsert,
  type PaymentSelect,
} from "@/db/payment-schema";
import { nanoid } from "nanoid";

/**
 * PaymentRepository provides CRUD operations for payments.
 * Uses workspace scoping for all queries (security requirement).
 */
export const PaymentRepository = {
  /**
   * Create a new payment record.
   * Generates ID if not provided.
   */
  async create(
    data: Omit<PaymentInsert, "id">,
    tx?: DrizzleTransaction
  ): Promise<PaymentSelect> {
    const executor = tx ?? db;
    const id = nanoid();
    const [payment] = await executor
      .insert(payments)
      .values({ ...data, id })
      .returning();
    return payment;
  },

  /**
   * Find payment by ID within workspace.
   */
  async findById(
    id: string,
    workspaceId: string,
    tx?: DrizzleTransaction
  ): Promise<PaymentSelect | null> {
    const executor = tx ?? db;
    const [payment] = await executor
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, id),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );
    return payment ?? null;
  },

  /**
   * Find payment by external ID (provider + externalId) within workspace.
   * Used for idempotency check during ingestion.
   */
  async findByExternalId(
    provider: string,
    externalId: string,
    workspaceId: string,
    tx?: DrizzleTransaction
  ): Promise<PaymentSelect | null> {
    const executor = tx ?? db;
    const [payment] = await executor
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.provider, provider),
          eq(payments.externalId, externalId),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      );
    return payment ?? null;
  },

  /**
   * Find payments by workspace with optional filters.
   */
  async findByWorkspace(
    workspaceId: string,
    options?: { status?: string; limit?: number },
    tx?: DrizzleTransaction
  ): Promise<PaymentSelect[]> {
    const executor = tx ?? db;

    // Build conditions array
    const conditions = [
      eq(payments.workspaceId, workspaceId),
      isNull(payments.softDeletedAt),
    ];

    if (options?.status) {
      conditions.push(eq(payments.status, options.status));
    }

    return executor
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(desc(payments.receivedAt))
      .limit(options?.limit ?? 100);
  },

  /**
   * Update payment status and optionally match data.
   */
  async updateStatus(
    id: string,
    workspaceId: string,
    status: string,
    matchData?: {
      matchedInvoiceId?: string;
      confidence?: number;
      matchType?: string;
    },
    tx?: DrizzleTransaction
  ): Promise<PaymentSelect | null> {
    const executor = tx ?? db;
    const [updated] = await executor
      .update(payments)
      .set({ status, ...matchData, updatedAt: new Date() })
      .where(
        and(
          eq(payments.id, id),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      )
      .returning();
    return updated ?? null;
  },

  /**
   * Soft delete a payment record.
   */
  async softDelete(
    id: string,
    workspaceId: string,
    tx?: DrizzleTransaction
  ): Promise<PaymentSelect | null> {
    const executor = tx ?? db;
    const [deleted] = await executor
      .update(payments)
      .set({ softDeletedAt: new Date() })
      .where(
        and(
          eq(payments.id, id),
          eq(payments.workspaceId, workspaceId),
          isNull(payments.softDeletedAt)
        )
      )
      .returning();
    return deleted ?? null;
  },
};
