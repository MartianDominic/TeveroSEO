/**
 * Payment Schedule View Component
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * Client-facing view of their payment schedule after first payment.
 * Shows all installments with their status (paid, pending, overdue).
 *
 * Design reference: D-10 in DESIGN.md
 */
import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  InstallmentCard,
  type InstallmentStatus,
} from "./InstallmentCard";
import { formatCurrency, type PlanType } from "@/lib/format-currency";

/**
 * Installment data structure from API/database.
 */
export interface ScheduleInstallment {
  id: string;
  installmentNumber: number;
  amountCents: number;
  dueAt: Date;
  status: InstallmentStatus;
  paidAt: Date | null;
  paymentUrl: string | null;
}

/**
 * Payment schedule data structure.
 */
export interface PaymentSchedule {
  id: string;
  planType: PlanType;
  totalInstallments: number;
  installments: ScheduleInstallment[];
}

/**
 * Props for the PaymentScheduleView component.
 */
export interface PaymentScheduleViewProps {
  /** Payment schedule data */
  schedule: PaymentSchedule;
  /** Invoice number for display */
  invoiceNumber: string;
  /** Currency code (EUR, USD) */
  currency: string;
  /** Callback when "Pay Now" button is clicked for an installment */
  onPayInstallment?: (installmentId: string, paymentUrl: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Finds the next installment to be paid (first non-paid installment).
 */
function findNextInstallment(
  installments: ScheduleInstallment[]
): ScheduleInstallment | null {
  return (
    installments.find(
      (i) =>
        i.status === "pending" ||
        i.status === "processing" ||
        i.status === "overdue" ||
        i.status === "failed"
    ) || null
  );
}

/**
 * Calculates summary statistics for the schedule.
 */
function calculateScheduleSummary(
  installments: ScheduleInstallment[],
  currency: string
): { paid: number; remaining: number; paidCount: number } {
  const paid = installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);

  const remaining = installments
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);

  const paidCount = installments.filter((i) => i.status === "paid").length;

  return { paid, remaining, paidCount };
}

/**
 * PaymentScheduleView displays the client's payment schedule.
 *
 * Features:
 * - Shows all installments with correct status badges
 * - Paid installments show checkmark and paid date
 * - Next unpaid installment has "Pay Now" button
 * - Reminder note displayed at bottom
 * - Uses v6 design tokens consistently
 *
 * @example
 * <PaymentScheduleView
 *   schedule={schedule}
 *   invoiceNumber="INV-2024-0042"
 *   currency="EUR"
 *   onPayInstallment={(id, url) => window.location.href = url}
 * />
 */
export function PaymentScheduleView({
  schedule,
  invoiceNumber,
  currency,
  onPayInstallment,
  className,
}: PaymentScheduleViewProps): React.ReactElement {
  const { paid, remaining, paidCount } = calculateScheduleSummary(
    schedule.installments,
    currency
  );

  const nextInstallment = findNextInstallment(schedule.installments);
  const allPaid = schedule.installments.every((i) => i.status === "paid");

  const handlePayNow = (installment: ScheduleInstallment) => {
    if (installment.paymentUrl && onPayInstallment) {
      onPayInstallment(installment.id, installment.paymentUrl);
    }
  };

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>Your Payment Schedule</CardTitle>
        <CardDescription>Invoice #{invoiceNumber}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary section */}
        {!allPaid && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">
                {paidCount} of {schedule.totalInstallments} payments completed
              </p>
              {remaining > 0 && (
                <p className="text-sm font-medium mt-1">
                  Remaining: {formatCurrency(remaining, currency)}
                </p>
              )}
            </div>
            {paid > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-sm font-medium text-green-600">
                  {formatCurrency(paid, currency)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Installments list */}
        <div className="space-y-3" role="list" aria-label="Payment installments">
          {schedule.installments.map((installment) => {
            const isNext =
              nextInstallment && installment.id === nextInstallment.id;

            return (
              <div key={installment.id} className="space-y-2">
                <InstallmentCard
                  number={installment.installmentNumber}
                  amount={installment.amountCents}
                  currency={currency}
                  dueDate={installment.dueAt}
                  status={installment.status}
                  paidAt={installment.paidAt}
                  isNext={isNext ?? undefined}
                  totalInstallments={schedule.totalInstallments}
                />

                {/* Pay Now button for next installment */}
                {isNext &&
                  installment.paymentUrl &&
                  installment.status !== "paid" && (
                    <Button
                      onClick={() => handlePayNow(installment)}
                      className="w-full"
                      variant={
                        installment.status === "overdue"
                          ? "destructive"
                          : "default"
                      }
                    >
                      {installment.status === "overdue"
                        ? "Pay Now (Overdue)"
                        : "Pay Now"}
                    </Button>
                  )}
              </div>
            );
          })}
        </div>

        {/* Completion message */}
        {allPaid && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium">All payments completed</p>
              <p className="text-sm mt-1">
                Thank you for completing all your payments for this invoice.
              </p>
            </div>
          </div>
        )}

        {/* Reminder note for pending payments */}
        {!allPaid && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Info
              className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              We&apos;ll send you a reminder 3 days before your next payment is
              due.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
