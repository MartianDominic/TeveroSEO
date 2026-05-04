/**
 * Payment Schedule Repository
 * Phase 60-01: Payment Flexibility & Split Payments
 *
 * CRUD operations for payment_schedules and payment_installments tables.
 * Handles schedule creation, installment tracking, and overdue detection.
 */
import { eq, and, lt, gte, sql } from "drizzle-orm";
import { db, type DrizzleTransaction } from "@/db";
import {
  paymentSchedules,
  paymentInstallments,
  type PaymentScheduleInsert,
  type PaymentScheduleSelect,
  type PaymentInstallmentInsert,
  type PaymentInstallmentSelect,
  type InstallmentStatus,
} from "@/db/payment-schedule-schema";
import { invoices } from "@/db/invoice-schema";
import type { PaymentProviderType } from "../types";

/**
 * Insert a new payment schedule.
 * Accepts optional transaction for atomic operations.
 */
export async function insertSchedule(
  schedule: PaymentScheduleInsert,
  tx?: DrizzleTransaction
): Promise<PaymentScheduleSelect> {
  const executor = tx ?? db;
  const [inserted] = await executor
    .insert(paymentSchedules)
    .values(schedule)
    .returning();
  return inserted;
}

/**
 * Insert multiple installments for a schedule.
 * Accepts optional transaction for atomic operations.
 */
export async function insertInstallments(
  installments: PaymentInstallmentInsert[],
  tx?: DrizzleTransaction
): Promise<PaymentInstallmentSelect[]> {
  if (installments.length === 0) {
    return [];
  }
  const executor = tx ?? db;
  return await executor
    .insert(paymentInstallments)
    .values(installments)
    .returning();
}

/**
 * Get a payment schedule by ID (internal use only).
 *
 * WARNING: This method does NOT filter by workspace.
 * Use getScheduleByIdScoped() for tenant-safe access.
 */
export async function getScheduleById(
  scheduleId: string
): Promise<PaymentScheduleSelect | undefined> {
  const [schedule] = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.id, scheduleId))
    .limit(1);
  return schedule;
}

/**
 * Get a payment schedule by ID with workspace scope.
 * Joins with invoices to verify workspace ownership.
 *
 * SECURITY: Returns undefined if schedule doesn't exist OR belongs to different workspace.
 */
export async function getScheduleByIdScoped(
  scheduleId: string,
  workspaceId: string
): Promise<PaymentScheduleSelect | undefined> {
  const result = await db
    .select({ schedule: paymentSchedules })
    .from(paymentSchedules)
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(
      and(
        eq(paymentSchedules.id, scheduleId),
        eq(invoices.workspaceId, workspaceId)
      )
    )
    .limit(1);
  return result[0]?.schedule;
}

/**
 * Get a payment schedule by invoice ID.
 */
export async function getScheduleByInvoiceId(
  invoiceId: string
): Promise<PaymentScheduleSelect | undefined> {
  const [schedule] = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.invoiceId, invoiceId))
    .limit(1);
  return schedule;
}

/**
 * Get a payment schedule by invoice ID with workspace scope.
 *
 * SECURITY: Returns undefined if schedule doesn't exist OR belongs to different workspace.
 */
export async function getScheduleByInvoiceIdScoped(
  invoiceId: string,
  workspaceId: string
): Promise<PaymentScheduleSelect | undefined> {
  const result = await db
    .select({ schedule: paymentSchedules })
    .from(paymentSchedules)
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(
      and(
        eq(paymentSchedules.invoiceId, invoiceId),
        eq(invoices.workspaceId, workspaceId)
      )
    )
    .limit(1);
  return result[0]?.schedule;
}

/**
 * Get a schedule with all its installments.
 */
export async function getScheduleWithInstallments(
  invoiceId: string
): Promise<
  | (PaymentScheduleSelect & { installments: PaymentInstallmentSelect[] })
  | undefined
> {
  const schedule = await getScheduleByInvoiceId(invoiceId);
  if (!schedule) {
    return undefined;
  }

  const installments = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.scheduleId, schedule.id))
    .orderBy(paymentInstallments.installmentNumber);

  return { ...schedule, installments };
}

/**
 * Get a single installment by ID.
 */
export async function getInstallmentById(
  installmentId: string
): Promise<PaymentInstallmentSelect | undefined> {
  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.id, installmentId))
    .limit(1);
  return installment;
}

/**
 * Get installments for a schedule.
 */
export async function getInstallmentsByScheduleId(
  scheduleId: string
): Promise<PaymentInstallmentSelect[]> {
  return await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.scheduleId, scheduleId))
    .orderBy(paymentInstallments.installmentNumber);
}

/**
 * Get upcoming installments due exactly N days from now for a specific workspace.
 * Used by reminder worker (D-20).
 * P60-H05: Fixed to use exact date range instead of all pending <= futureDate.
 *
 * SECURITY: Requires workspaceId to ensure per-workspace isolation.
 */
export async function getUpcomingInstallments(
  daysAhead: number,
  workspaceId: string
): Promise<PaymentInstallmentSelect[]> {
  const now = new Date();

  // Start of target day (midnight)
  const startOfTargetDay = new Date(now);
  startOfTargetDay.setDate(startOfTargetDay.getDate() + daysAhead);
  startOfTargetDay.setHours(0, 0, 0, 0);

  // End of target day (just before midnight next day)
  const endOfTargetDay = new Date(startOfTargetDay);
  endOfTargetDay.setDate(endOfTargetDay.getDate() + 1);

  const result = await db
    .select({ installment: paymentInstallments })
    .from(paymentInstallments)
    .innerJoin(paymentSchedules, eq(paymentInstallments.scheduleId, paymentSchedules.id))
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(
      and(
        eq(paymentInstallments.status, "pending"),
        gte(paymentInstallments.dueAt, startOfTargetDay),
        lt(paymentInstallments.dueAt, endOfTargetDay),
        eq(invoices.workspaceId, workspaceId)
      )
    )
    .orderBy(paymentInstallments.dueAt);

  return result.map(r => r.installment);
}

/**
 * Get overdue installments (pending with due date in the past) for a specific workspace.
 *
 * SECURITY: Requires workspaceId to ensure per-workspace isolation.
 */
export async function getOverdueInstallments(
  workspaceId: string
): Promise<PaymentInstallmentSelect[]> {
  const now = new Date();

  const result = await db
    .select({ installment: paymentInstallments })
    .from(paymentInstallments)
    .innerJoin(paymentSchedules, eq(paymentInstallments.scheduleId, paymentSchedules.id))
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(
      and(
        eq(paymentInstallments.status, "pending"),
        lt(paymentInstallments.dueAt, now),
        eq(invoices.workspaceId, workspaceId)
      )
    )
    .orderBy(paymentInstallments.dueAt);

  return result.map(r => r.installment);
}

/**
 * Get the first unpaid installment for a schedule.
 * Used to determine which installment to pay next.
 */
export async function getFirstUnpaidInstallment(
  scheduleId: string
): Promise<PaymentInstallmentSelect | undefined> {
  const [installment] = await db
    .select()
    .from(paymentInstallments)
    .where(
      and(
        eq(paymentInstallments.scheduleId, scheduleId),
        sql`${paymentInstallments.status} IN ('pending', 'overdue', 'failed')`
      )
    )
    .orderBy(paymentInstallments.installmentNumber)
    .limit(1);
  return installment;
}

/**
 * Update installment status.
 */
export async function updateInstallmentStatus(
  installmentId: string,
  status: InstallmentStatus,
  paymentData?: {
    paymentId?: string;
    paymentProvider?: PaymentProviderType;
    paymentUrl?: string;
    paidAt?: Date;
  }
): Promise<PaymentInstallmentSelect | undefined> {
  const updateFields: Partial<PaymentInstallmentSelect> = {
    status,
    updatedAt: new Date(),
  };

  if (paymentData?.paymentId) {
    updateFields.paymentId = paymentData.paymentId;
  }
  if (paymentData?.paymentProvider) {
    updateFields.paymentProvider = paymentData.paymentProvider;
  }
  if (paymentData?.paymentUrl) {
    updateFields.paymentUrl = paymentData.paymentUrl;
  }
  if (paymentData?.paidAt || status === "paid") {
    updateFields.paidAt = paymentData?.paidAt ?? new Date();
  }

  const [updated] = await db
    .update(paymentInstallments)
    .set(updateFields)
    .where(eq(paymentInstallments.id, installmentId))
    .returning();

  return updated;
}

/**
 * Mark reminder as sent for an installment.
 */
export async function markReminderSent(
  installmentId: string
): Promise<PaymentInstallmentSelect | undefined> {
  const [updated] = await db
    .update(paymentInstallments)
    .set({
      reminderSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentInstallments.id, installmentId))
    .returning();

  return updated;
}

/**
 * Mark all overdue installments as overdue status for a specific workspace.
 * Called by daily worker per-workspace.
 *
 * SECURITY: Requires workspaceId to ensure per-workspace isolation.
 */
export async function markOverdueInstallments(workspaceId: string): Promise<number> {
  const now = new Date();

  // First get the IDs of overdue installments for this workspace
  const overdueInstallments = await db
    .select({ id: paymentInstallments.id })
    .from(paymentInstallments)
    .innerJoin(paymentSchedules, eq(paymentInstallments.scheduleId, paymentSchedules.id))
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(
      and(
        eq(paymentInstallments.status, "pending"),
        lt(paymentInstallments.dueAt, now),
        eq(invoices.workspaceId, workspaceId)
      )
    );

  if (overdueInstallments.length === 0) {
    return 0;
  }

  // Update only those installments
  const ids = overdueInstallments.map(i => i.id);
  const result = await db
    .update(paymentInstallments)
    .set({
      status: "overdue",
      updatedAt: now,
    })
    .where(sql`${paymentInstallments.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
    .returning();

  return result.length;
}

/**
 * Delete a payment schedule and all its installments.
 * Cascades via FK constraint.
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  await db
    .delete(paymentSchedules)
    .where(eq(paymentSchedules.id, scheduleId));
}

export const PaymentScheduleRepository = {
  insertSchedule,
  insertInstallments,
  getScheduleById,
  getScheduleByIdScoped,
  getScheduleByInvoiceId,
  getScheduleByInvoiceIdScoped,
  getScheduleWithInstallments,
  getInstallmentById,
  getInstallmentsByScheduleId,
  getUpcomingInstallments,
  getOverdueInstallments,
  getFirstUnpaidInstallment,
  updateInstallmentStatus,
  markReminderSent,
  markOverdueInstallments,
  deleteSchedule,
};
