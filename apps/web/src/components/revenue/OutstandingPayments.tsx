"use client";

/**
 * Outstanding payments section component.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-16: Outstanding payments grouped by urgency with actions.
 * - Overdue (red)
 * - Due this week (yellow)
 * - Upcoming (gray)
 */

import { Mail, Phone, FileText } from "lucide-react";

import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

import { Button } from "@tevero/ui";
import { Card, CardHeader, CardTitle, CardContent } from "@tevero/ui";

/**
 * Outstanding payment data structure.
 */
export interface OutstandingPaymentItem {
  invoiceId: string;
  clientName: string;
  amountCents: number;
  currency: string;
  urgency: "overdue" | "due_this_week" | "upcoming";
  daysOverdue: number;
  dueDate: Date | string | null;
}

/**
 * Props for OutstandingPayments component.
 */
export interface OutstandingPaymentsProps {
  payments: OutstandingPaymentItem[];
  onSendReminder?: (invoiceId: string) => void;
  onLogCall?: (invoiceId: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
}

/**
 * Displays outstanding payments grouped by urgency per D-16.
 */
export function OutstandingPayments({
  payments,
  onSendReminder,
  onLogCall,
  onViewInvoice,
}: OutstandingPaymentsProps) {
  // Group by urgency per D-16
  const overdue = payments.filter((p) => p.urgency === "overdue");
  const dueThisWeek = payments.filter((p) => p.urgency === "due_this_week");
  const upcoming = payments.filter((p) => p.urgency === "upcoming");

  const renderPayment = (payment: OutstandingPaymentItem) => (
    <div
      key={payment.invoiceId}
      className={cn(
        "flex items-center justify-between py-2 px-3 rounded",
        payment.urgency === "overdue" && "bg-error/5",
        payment.urgency === "due_this_week" && "bg-warning/5"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-1 truncate">
          {payment.clientName}
        </p>
        <p className="text-xs text-text-3">
          {payment.urgency === "overdue"
            ? `${payment.daysOverdue} days overdue`
            : payment.urgency === "due_this_week"
              ? "Due this week"
              : "Upcoming"}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className="text-sm font-medium whitespace-nowrap">
          {formatCurrency(payment.amountCents, payment.currency)}
        </span>
        <div className="flex gap-1">
          {/* D-16 Actions: Send Reminder */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onSendReminder?.(payment.invoiceId)}
            title="Send Reminder"
          >
            <Mail className="h-4 w-4" />
          </Button>
          {/* D-16 Actions: Log Call */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onLogCall?.(payment.invoiceId)}
            title="Log Call"
          >
            <Phone className="h-4 w-4" />
          </Button>
          {/* D-16 Actions: View Invoice */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onViewInvoice?.(payment.invoiceId)}
            title="View Invoice"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outstanding Payments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* D-16: Overdue (red) */}
        {overdue.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-error mb-2 uppercase tracking-wide">
              Overdue
            </h4>
            <div className="space-y-1">{overdue.map(renderPayment)}</div>
          </div>
        )}

        {/* D-16: Due this week (yellow) */}
        {dueThisWeek.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-warning mb-2 uppercase tracking-wide">
              Due This Week
            </h4>
            <div className="space-y-1">{dueThisWeek.map(renderPayment)}</div>
          </div>
        )}

        {/* D-16: Upcoming (gray) */}
        {upcoming.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-3 mb-2 uppercase tracking-wide">
              Upcoming
            </h4>
            <div className="space-y-1">{upcoming.map(renderPayment)}</div>
          </div>
        )}

        {/* Empty state */}
        {payments.length === 0 && (
          <p className="text-sm text-text-3 text-center py-4">
            No outstanding payments
          </p>
        )}
      </CardContent>
    </Card>
  );
}

OutstandingPayments.displayName = "OutstandingPayments";
