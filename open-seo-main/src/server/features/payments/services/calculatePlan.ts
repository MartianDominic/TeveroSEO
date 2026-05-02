/**
 * Payment Plan Calculator
 * Phase 60-01: Payment Flexibility & Split Payments
 *
 * Pure function for calculating payment plans.
 * Separated from PaymentScheduleService to allow testing without db dependencies.
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
import type { PlanType } from "@/db/payment-schedule-schema";

/**
 * Calculated installment for a payment plan.
 */
export interface CalculatedInstallment {
  number: number;
  amountCents: number;
  dueDate: Date;
  label: string;
}

/**
 * Calculated payment plan.
 */
export interface PaymentPlan {
  type: PlanType;
  installments: CalculatedInstallment[];
  totalAmountCents: number;
}

/**
 * Add days to a date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Error thrown for validation failures.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Calculate payment plan for a given total and plan type.
 *
 * Per D-05: 2-payment split is 50/50
 * Per D-06: 3-payment split is 40/30/30
 * Per D-07: Math.ceil for first installment to avoid rounding issues
 *
 * @param totalCents - Total amount in cents
 * @param planType - Plan type ('full' | 'split_2' | 'split_3')
 * @param startDate - Start date for calculations (defaults to today)
 * @returns Calculated payment plan
 */
export function calculatePlan(
  totalCents: number,
  planType: PlanType,
  startDate: Date = new Date()
): PaymentPlan {
  if (totalCents <= 0) {
    throw new ValidationError("Total amount must be positive");
  }

  switch (planType) {
    case "full":
      return {
        type: "full",
        installments: [
          {
            number: 1,
            amountCents: totalCents,
            dueDate: startDate,
            label: "Today",
          },
        ],
        totalAmountCents: totalCents,
      };

    case "split_2": {
      // D-05: 50/50 split
      // D-07: Math.ceil for first installment
      const firstInstallment = Math.ceil(totalCents / 2);
      const secondInstallment = totalCents - firstInstallment;

      return {
        type: "split_2",
        installments: [
          {
            number: 1,
            amountCents: firstInstallment,
            dueDate: startDate,
            label: "Today",
          },
          {
            number: 2,
            amountCents: secondInstallment,
            dueDate: addDays(startDate, 30),
            label: "In 30 days",
          },
        ],
        totalAmountCents: totalCents,
      };
    }

    case "split_3": {
      // D-06: 40/30/30 split
      // D-07: Math.ceil for first and second installments
      const firstInstallment = Math.ceil(totalCents * 0.4);
      const secondInstallment = Math.ceil(totalCents * 0.3);
      const thirdInstallment = totalCents - firstInstallment - secondInstallment;

      return {
        type: "split_3",
        installments: [
          {
            number: 1,
            amountCents: firstInstallment,
            dueDate: startDate,
            label: "Today",
          },
          {
            number: 2,
            amountCents: secondInstallment,
            dueDate: addDays(startDate, 30),
            label: "In 30 days",
          },
          {
            number: 3,
            amountCents: thirdInstallment,
            dueDate: addDays(startDate, 60),
            label: "In 60 days",
          },
        ],
        totalAmountCents: totalCents,
      };
    }

    default:
      throw new ValidationError(`Invalid plan type: ${planType}`);
  }
}
