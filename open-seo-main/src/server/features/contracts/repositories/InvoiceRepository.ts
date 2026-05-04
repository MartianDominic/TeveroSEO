/**
 * Invoice Repository
 * Phase 45: Data Foundation
 * H-CONC-01: Added optimistic locking for concurrent webhook safety
 *
 * CRUD operations for invoices table with Stripe integration.
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  type InvoiceInsert,
  type InvoiceSelect,
  type InvoiceStatus,
} from "@/db/invoice-schema";

/**
 * Error thrown when optimistic lock fails due to concurrent modification.
 * Callers should refresh data and retry or return 409 Conflict.
 */
export class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimisticLockError";
  }
}

/**
 * Insert a new invoice.
 */
export async function insertInvoice(
  invoice: InvoiceInsert,
): Promise<InvoiceSelect> {
  const [inserted] = await db.insert(invoices).values(invoice).returning();
  return inserted;
}

/**
 * Get an invoice by ID.
 *
 * SECURITY: This method does NOT filter by workspace.
 * Use getInvoiceByIdScoped() for tenant-safe access, or
 * call assertTenantAccess() at service layer after retrieval.
 */
export async function getInvoiceById(
  invoiceId: string,
): Promise<InvoiceSelect | undefined> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return invoice;
}

/**
 * Get an invoice by ID with workspace scope.
 * Returns undefined if invoice doesn't exist OR belongs to different workspace.
 * Use this for tenant-safe data access.
 */
export async function getInvoiceByIdScoped(
  invoiceId: string,
  workspaceId: string,
): Promise<InvoiceSelect | undefined> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  return invoice;
}

/**
 * Get an invoice by Stripe invoice ID.
 */
export async function getInvoiceByStripeId(
  stripeInvoiceId: string,
): Promise<InvoiceSelect | undefined> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);
  return invoice;
}

/**
 * Get an invoice by Revolut order ID.
 * Phase 54-03: Added for multi-provider support.
 */
export async function getInvoiceByRevolutOrderId(
  revolutOrderId: string,
): Promise<InvoiceSelect | undefined> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.revolutOrderId, revolutOrderId))
    .limit(1);
  return invoice;
}

/**
 * Get invoices for a workspace with optional filters.
 */
export async function getInvoicesByWorkspace(
  workspaceId: string,
  options?: {
    status?: InvoiceStatus;
    clientId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<InvoiceSelect[]> {
  const conditions = [eq(invoices.workspaceId, workspaceId)];

  if (options?.status) {
    conditions.push(eq(invoices.status, options.status));
  }

  if (options?.clientId) {
    conditions.push(eq(invoices.clientId, options.clientId));
  }

  return await db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

/**
 * Get invoices for a specific client.
 */
export async function getInvoicesByClient(
  clientId: string,
  options?: {
    status?: InvoiceStatus;
    limit?: number;
  },
): Promise<InvoiceSelect[]> {
  const conditions = [eq(invoices.clientId, clientId)];

  if (options?.status) {
    conditions.push(eq(invoices.status, options.status));
  }

  return await db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .limit(options?.limit ?? 50);
}

/**
 * Update invoice status.
 * @deprecated Use updateInvoiceStatusWithVersion for concurrent-safe updates
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  additionalFields?: Partial<
    Pick<
      InvoiceSelect,
      | "sentAt"
      | "paidAt"
      | "stripeInvoiceId"
      | "stripePaymentIntentId"
      | "stripePaymentUrl"
    >
  >,
): Promise<InvoiceSelect | undefined> {
  const [updated] = await db
    .update(invoices)
    .set({
      status,
      version: sql`${invoices.version} + 1`,
      updatedAt: new Date(),
      ...additionalFields,
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated;
}

/**
 * Update invoice status with optimistic locking.
 * H-CONC-01: Prevents race conditions in concurrent webhook callbacks.
 *
 * @param invoiceId - Invoice ID to update
 * @param status - New status
 * @param expectedVersion - Version the caller expects (from their read)
 * @param additionalFields - Optional additional fields to update
 * @returns Updated invoice
 * @throws OptimisticLockError if version mismatch (concurrent modification)
 */
export async function updateInvoiceStatusWithVersion(
  invoiceId: string,
  status: InvoiceStatus,
  expectedVersion: number,
  additionalFields?: Partial<
    Pick<
      InvoiceSelect,
      | "sentAt"
      | "paidAt"
      | "stripeInvoiceId"
      | "stripePaymentIntentId"
      | "stripePaymentUrl"
    >
  >,
): Promise<InvoiceSelect> {
  const result = await db
    .update(invoices)
    .set({
      status,
      version: sql`${invoices.version} + 1`,
      updatedAt: new Date(),
      ...additionalFields,
    })
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.version, expectedVersion) // Optimistic lock check
      )
    )
    .returning();

  if (result.length === 0) {
    throw new OptimisticLockError(
      `Invoice ${invoiceId} was modified concurrently (expected version ${expectedVersion})`
    );
  }

  return result[0];
}

/**
 * Update invoice status with provider-specific fields.
 * Phase 54-03: Added for multi-provider support.
 * @deprecated Use updateInvoiceStatusWithProviderAndVersion for concurrent-safe updates
 */
export async function updateInvoiceStatusWithProvider(
  invoiceId: string,
  status: InvoiceStatus,
  paymentProvider: "stripe" | "revolut",
  revolutOrderId?: string,
  revolutCheckoutUrl?: string,
  additionalFields?: Partial<
    Pick<
      InvoiceSelect,
      | "sentAt"
      | "paidAt"
      | "stripeInvoiceId"
      | "stripePaymentIntentId"
      | "stripePaymentUrl"
    >
  >,
): Promise<InvoiceSelect | undefined> {
  const [updated] = await db
    .update(invoices)
    .set({
      status,
      paymentProvider,
      version: sql`${invoices.version} + 1`,
      updatedAt: new Date(),
      ...(revolutOrderId && { revolutOrderId }),
      ...(revolutCheckoutUrl && { revolutCheckoutUrl }),
      ...additionalFields,
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated;
}

/**
 * Update invoice status with provider-specific fields and optimistic locking.
 * H-CONC-01: Prevents race conditions in concurrent webhook callbacks.
 *
 * @param invoiceId - Invoice ID to update
 * @param status - New status
 * @param expectedVersion - Version the caller expects (from their read)
 * @param paymentProvider - Payment provider
 * @param revolutOrderId - Optional Revolut order ID
 * @param revolutCheckoutUrl - Optional Revolut checkout URL
 * @param additionalFields - Optional additional fields to update
 * @returns Updated invoice
 * @throws OptimisticLockError if version mismatch (concurrent modification)
 */
export async function updateInvoiceStatusWithProviderAndVersion(
  invoiceId: string,
  status: InvoiceStatus,
  expectedVersion: number,
  paymentProvider: "stripe" | "revolut",
  revolutOrderId?: string,
  revolutCheckoutUrl?: string,
  additionalFields?: Partial<
    Pick<
      InvoiceSelect,
      | "sentAt"
      | "paidAt"
      | "stripeInvoiceId"
      | "stripePaymentIntentId"
      | "stripePaymentUrl"
    >
  >,
): Promise<InvoiceSelect> {
  const result = await db
    .update(invoices)
    .set({
      status,
      paymentProvider,
      version: sql`${invoices.version} + 1`,
      updatedAt: new Date(),
      ...(revolutOrderId && { revolutOrderId }),
      ...(revolutCheckoutUrl && { revolutCheckoutUrl }),
      ...additionalFields,
    })
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.version, expectedVersion) // Optimistic lock check
      )
    )
    .returning();

  if (result.length === 0) {
    throw new OptimisticLockError(
      `Invoice ${invoiceId} was modified concurrently (expected version ${expectedVersion})`
    );
  }

  return result[0];
}

/**
 * Update Stripe payment details.
 */
export async function updateInvoiceStripeDetails(
  invoiceId: string,
  stripeDetails: {
    stripeInvoiceId?: string;
    stripePaymentIntentId?: string;
    stripePaymentUrl?: string;
  },
): Promise<InvoiceSelect | undefined> {
  const [updated] = await db
    .update(invoices)
    .set({
      ...stripeDetails,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated;
}

/**
 * Delete an invoice (hard delete) with workspace scope.
 * Phase 69-03: Added workspaceId parameter for tenant-safe deletion.
 */
export async function deleteInvoice(
  invoiceId: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .delete(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)))
    .returning({ id: invoices.id });
  return result.length > 0;
}

export const InvoiceRepository = {
  insertInvoice,
  getInvoiceById,
  getInvoiceByIdScoped,
  getInvoiceByStripeId,
  getInvoiceByRevolutOrderId,
  getInvoicesByWorkspace,
  getInvoicesByClient,
  updateInvoiceStatus,
  updateInvoiceStatusWithVersion,
  updateInvoiceStatusWithProvider,
  updateInvoiceStatusWithProviderAndVersion,
  updateInvoiceStripeDetails,
  deleteInvoice,
};
