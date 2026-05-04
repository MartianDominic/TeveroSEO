/**
 * Payment Schedule Service
 * Phase 60-01: Payment Flexibility & Split Payments
 *
 * Business logic for creating and managing payment schedules.
 * Handles plan calculations and installment lifecycle.
 *
 * Plan Types:
 * - full: 1 installment, 100% today
 * - split_2: 2 installments, 50/50 (D-05)
 * - split_3: 3 installments, 40/30/30 (D-06)
 *
 * Calculation Rules:
 * - D-07: Math.ceil for first installment to avoid rounding issues
 * - All amounts in cents for precision
 */
import { nanoid } from "nanoid";
import { db } from "@/db";
import { PaymentScheduleRepository } from "../repositories/PaymentScheduleRepository";
import type {
  PlanType,
  InstallmentStatus,
  PaymentScheduleSelect,
  PaymentInstallmentSelect,
} from "@/db/payment-schedule-schema";
import type { PaymentProviderType } from "../types";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

// Import and re-export calculatePlan from pure module (no db dependencies for testing)
import { calculatePlan } from "./calculatePlan";
export { calculatePlan, type CalculatedInstallment, type PaymentPlan } from "./calculatePlan";

const log = createLogger({ module: "PaymentScheduleService" });

/**
 * Schedule with installments for display.
 */
export interface ScheduleWithInstallments {
  schedule: PaymentScheduleSelect;
  installments: PaymentInstallmentSelect[];
  totalPaidCents: number;
  totalRemainingCents: number;
  nextInstallment: PaymentInstallmentSelect | null;
}

/**
 * Create a payment schedule for an invoice.
 *
 * @param invoiceId - Invoice ID to create schedule for
 * @param totalCents - Total invoice amount in cents
 * @param planType - Plan type to use
 * @returns Created schedule with installments
 */
export async function createScheduleForInvoice(
  invoiceId: string,
  totalCents: number,
  planType: PlanType
): Promise<ScheduleWithInstallments> {
  // Check if schedule already exists
  const existingSchedule =
    await PaymentScheduleRepository.getScheduleByInvoiceId(invoiceId);
  if (existingSchedule) {
    throw new AppError(
      "CONFLICT",
      `Payment schedule already exists for invoice ${invoiceId}`
    );
  }

  // Calculate the plan
  const plan = calculatePlan(totalCents, planType);

  // P60-H02: Wrap schedule and installment creation in a transaction
  // to prevent orphaned records if one insert fails
  const result = await db.transaction(async (tx) => {
    // Create schedule
    const schedule = await PaymentScheduleRepository.insertSchedule(
      {
        id: nanoid(),
        invoiceId,
        planType,
        totalInstallments: plan.installments.length,
      },
      tx
    );

    // Create installments
    const installmentData = plan.installments.map((inst) => ({
      id: nanoid(),
      scheduleId: schedule.id,
      installmentNumber: inst.number,
      amountCents: inst.amountCents,
      dueAt: inst.dueDate,
      status: "pending" as InstallmentStatus,
    }));

    const installments = await PaymentScheduleRepository.insertInstallments(
      installmentData,
      tx
    );

    return { schedule, installments };
  });

  log.info("Payment schedule created", {
    invoiceId,
    scheduleId: result.schedule.id,
    planType,
    installmentCount: result.installments.length,
  });

  return {
    schedule: result.schedule,
    installments: result.installments,
    totalPaidCents: 0,
    totalRemainingCents: totalCents,
    nextInstallment: result.installments[0] ?? null,
  };
}

/**
 * Get schedule with installments for display.
 *
 * @param invoiceId - Invoice ID to get schedule for
 * @returns Schedule with installments and progress info
 */
export async function getScheduleWithInstallments(
  invoiceId: string
): Promise<ScheduleWithInstallments | null> {
  const result =
    await PaymentScheduleRepository.getScheduleWithInstallments(invoiceId);
  if (!result) {
    return null;
  }

  const { installments, ...schedule } = result;

  const totalPaidCents = installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);

  const totalRemainingCents = installments
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);

  const nextInstallment =
    installments.find(
      (i) => i.status === "pending" || i.status === "overdue" || i.status === "failed"
    ) ?? null;

  return {
    schedule,
    installments,
    totalPaidCents,
    totalRemainingCents,
    nextInstallment,
  };
}

/**
 * Get the first unpaid installment for a schedule.
 *
 * @param scheduleId - Schedule ID
 * @returns First unpaid installment or null
 */
export async function getFirstUnpaidInstallment(
  scheduleId: string
): Promise<PaymentInstallmentSelect | null> {
  const installment =
    await PaymentScheduleRepository.getFirstUnpaidInstallment(scheduleId);
  return installment ?? null;
}

/**
 * Record a successful payment for an installment.
 *
 * @param installmentId - Installment ID
 * @param paymentProvider - Provider used ('stripe' | 'revolut')
 * @param paymentId - Provider's payment ID
 */
export async function recordPayment(
  installmentId: string,
  paymentProvider: PaymentProviderType,
  paymentId: string
): Promise<PaymentInstallmentSelect> {
  const installment =
    await PaymentScheduleRepository.getInstallmentById(installmentId);
  if (!installment) {
    throw new AppError("NOT_FOUND", `Installment ${installmentId} not found`);
  }

  if (installment.status === "paid") {
    throw new AppError(
      "CONFLICT",
      `Installment ${installmentId} already paid`
    );
  }

  const updated = await PaymentScheduleRepository.updateInstallmentStatus(
    installmentId,
    "paid",
    {
      paymentId,
      paymentProvider,
      paidAt: new Date(),
    }
  );

  log.info("Installment payment recorded", {
    installmentId,
    paymentProvider,
    paymentId,
  });

  return updated!;
}

/**
 * Update installment status.
 *
 * @param installmentId - Installment ID
 * @param status - New status
 * @param paymentData - Optional payment data
 */
export async function updateInstallmentStatus(
  installmentId: string,
  status: InstallmentStatus,
  paymentData?: {
    paymentId?: string;
    paymentProvider?: PaymentProviderType;
    paymentUrl?: string;
  }
): Promise<PaymentInstallmentSelect> {
  const installment =
    await PaymentScheduleRepository.getInstallmentById(installmentId);
  if (!installment) {
    throw new AppError("NOT_FOUND", `Installment ${installmentId} not found`);
  }

  const updated = await PaymentScheduleRepository.updateInstallmentStatus(
    installmentId,
    status,
    paymentData
  );

  log.info("Installment status updated", {
    installmentId,
    oldStatus: installment.status,
    newStatus: status,
  });

  return updated!;
}

/**
 * Get upcoming installments for reminders.
 *
 * SECURITY: Requires workspaceId for per-tenant isolation.
 *
 * @param daysAhead - Number of days to look ahead
 * @param workspaceId - Workspace ID for tenant isolation
 * @returns List of upcoming installments
 */
export async function getUpcomingInstallments(
  daysAhead: number,
  workspaceId: string
): Promise<PaymentInstallmentSelect[]> {
  return PaymentScheduleRepository.getUpcomingInstallments(daysAhead, workspaceId);
}

/**
 * Get overdue installments.
 *
 * SECURITY: Requires workspaceId for per-tenant isolation.
 *
 * @param workspaceId - Workspace ID for tenant isolation
 * @returns List of overdue installments
 */
export async function getOverdueInstallments(
  workspaceId: string
): Promise<PaymentInstallmentSelect[]> {
  return PaymentScheduleRepository.getOverdueInstallments(workspaceId);
}

export const PaymentScheduleService = {
  calculatePlan,
  createScheduleForInvoice,
  getScheduleWithInstallments,
  getFirstUnpaidInstallment,
  recordPayment,
  updateInstallmentStatus,
  getUpcomingInstallments,
  getOverdueInstallments,
};
