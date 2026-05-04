/**
 * Invoice Repository
 * Phase 45: Data Foundation
 *
 * CRUD operations for invoices table with Stripe integration.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  type InvoiceInsert,
  type InvoiceSelect,
  type InvoiceStatus,
} from "@/db/invoice-schema";

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
      updatedAt: new Date(),
      ...additionalFields,
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated;
}

/**
 * Update invoice status with provider-specific fields.
 * Phase 54-03: Added for multi-provider support.
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
 * Delete an invoice (hard delete).
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  await db.delete(invoices).where(eq(invoices.id, invoiceId));
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
  updateInvoiceStatusWithProvider,
  updateInvoiceStripeDetails,
  deleteInvoice,
};
