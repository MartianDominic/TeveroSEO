/**
 * Currency formatting utilities.
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * Provides consistent currency formatting across payment components.
 * Supports EUR (Lithuanian/European format) and USD (US format).
 */

/**
 * Formats amount in cents to display string without currency symbol.
 *
 * @param cents - Amount in cents
 * @param currency - Currency code (EUR, USD, etc.)
 * @returns Formatted amount string (e.g., "4,200.00" for USD, "4.200,00" for EUR)
 *
 * @example
 * formatCents(420000, "EUR") // "4.200,00"
 * formatCents(420000, "USD") // "4,200.00"
 */
export function formatCents(cents: number, currency: string): string {
  const amount = cents / 100;

  if (currency === "EUR") {
    // Lithuanian/European format: 4.200,00
    return amount.toLocaleString("lt-LT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (currency === "USD") {
    // US format: 4,200.00
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Fallback for other currencies
  return amount.toFixed(2);
}

/**
 * Formats amount in cents to display string with currency code.
 *
 * @param cents - Amount in cents
 * @param currency - Currency code (EUR, USD, etc.)
 * @returns Formatted currency string (e.g., "EUR 4,200.00" or "$4,200.00")
 *
 * @example
 * formatCurrency(420000, "EUR") // "EUR 4.200,00"
 * formatCurrency(420000, "USD") // "$4,200.00"
 */
export function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;

  if (currency === "EUR") {
    // European format: EUR 4.200,00
    return `EUR ${amount.toLocaleString("lt-LT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (currency === "USD") {
    // US format with symbol: $4,200.00
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  // Fallback for other currencies
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Payment plan types supported by the system.
 */
export type PlanType = "full" | "split_2" | "split_3";

/**
 * Installment details within a payment plan.
 */
export interface Installment {
  number: number;
  amount: number;
  dueDate: Date;
  label: string;
}

/**
 * Complete payment plan with all installments.
 */
export interface PaymentPlan {
  type: PlanType;
  installments: Installment[];
  totalAmount: number;
}

/**
 * Adds days to a date.
 *
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date with days added
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculates a payment plan breakdown based on total and plan type.
 *
 * Plan split logic:
 * - full: 100% today
 * - split_2: 50% today, 50% in 30 days
 * - split_3: 40% today, 30% in 30 days, 30% in 60 days
 *
 * Uses Math.ceil for first installment to avoid rounding issues.
 *
 * @param totalCents - Total invoice amount in cents
 * @param planType - Type of payment plan
 * @returns Calculated payment plan with installments
 *
 * @example
 * calculatePlan(420000, "split_2")
 * // Returns:
 * // {
 * //   type: "split_2",
 * //   installments: [
 * //     { number: 1, amount: 210000, dueDate: today, label: "Today" },
 * //     { number: 2, amount: 210000, dueDate: +30days, label: "In 30 days" }
 * //   ],
 * //   totalAmount: 420000
 * // }
 */
export function calculatePlan(
  totalCents: number,
  planType: PlanType
): PaymentPlan {
  const today = new Date();

  switch (planType) {
    case "full":
      return {
        type: "full",
        installments: [
          { number: 1, amount: totalCents, dueDate: today, label: "Today" },
        ],
        totalAmount: totalCents,
      };

    case "split_2": {
      const half = Math.ceil(totalCents / 2);
      return {
        type: "split_2",
        installments: [
          { number: 1, amount: half, dueDate: today, label: "Today" },
          {
            number: 2,
            amount: totalCents - half,
            dueDate: addDays(today, 30),
            label: "In 30 days",
          },
        ],
        totalAmount: totalCents,
      };
    }

    case "split_3": {
      const first = Math.ceil(totalCents * 0.4);
      const second = Math.ceil(totalCents * 0.3);
      const third = totalCents - first - second;
      return {
        type: "split_3",
        installments: [
          { number: 1, amount: first, dueDate: today, label: "Today (40%)" },
          {
            number: 2,
            amount: second,
            dueDate: addDays(today, 30),
            label: "In 30 days (30%)",
          },
          {
            number: 3,
            amount: third,
            dueDate: addDays(today, 60),
            label: "In 60 days (30%)",
          },
        ],
        totalAmount: totalCents,
      };
    }

    default:
      // Fallback to full payment
      return {
        type: "full",
        installments: [
          { number: 1, amount: totalCents, dueDate: today, label: "Today" },
        ],
        totalAmount: totalCents,
      };
  }
}

/**
 * Gets human-readable plan name.
 *
 * @param planType - Type of payment plan
 * @returns Human-readable plan name
 */
export function getPlanName(planType: PlanType): string {
  switch (planType) {
    case "full":
      return "Pay in full";
    case "split_2":
      return "Pay in 2 installments";
    case "split_3":
      return "Pay in 3 installments";
    default:
      return "Pay in full";
  }
}
