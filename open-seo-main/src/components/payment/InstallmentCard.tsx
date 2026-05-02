/**
 * Installment Card Component
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * Displays a single installment within a payment plan or schedule.
 * Shows amount, due date, and payment status with appropriate icons.
 */
import * as React from "react";
import { format } from "date-fns";
import { Check, Circle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { Badge } from "@/client/components/ui/badge";
import { formatCurrency } from "@/lib/format-currency";

/**
 * Installment status enum.
 */
export type InstallmentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "overdue"
  | "failed";

/**
 * Props for the InstallmentCard component.
 */
export interface InstallmentCardProps {
  /** Installment number (1, 2, 3...) */
  number: number;
  /** Amount in cents */
  amount: number;
  /** Currency code (EUR, USD) */
  currency: string;
  /** Due date for this installment */
  dueDate: Date;
  /** Human-readable label (e.g., "Today", "In 30 days") */
  label?: string;
  /** Payment status */
  status?: InstallmentStatus;
  /** Date when payment was made (for paid installments) */
  paidAt?: Date | null;
  /** Whether this is the next installment to be paid */
  isNext?: boolean;
  /** Total number of installments */
  totalInstallments?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Returns the appropriate icon component for the installment status.
 */
function getStatusIcon(status: InstallmentStatus): React.ReactNode {
  switch (status) {
    case "paid":
      return <Check className="h-5 w-5 text-green-600" aria-hidden="true" />;
    case "processing":
      return (
        <Loader2
          className="h-5 w-5 text-yellow-600 animate-spin"
          aria-hidden="true"
        />
      );
    case "overdue":
    case "failed":
      return (
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
      );
    case "pending":
    default:
      return (
        <Circle
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
      );
  }
}

/**
 * Returns the badge configuration for the installment status.
 */
function getStatusBadge(
  status: InstallmentStatus
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } | null {
  switch (status) {
    case "paid":
      return { label: "Paid", variant: "default" };
    case "processing":
      return { label: "Processing", variant: "secondary" };
    case "overdue":
      return { label: "Overdue", variant: "destructive" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "pending":
    default:
      return null;
  }
}

/**
 * InstallmentCard displays a single installment with its status.
 *
 * Visual states:
 * - Paid: Check icon, green "Paid" badge, shows paid date
 * - Processing: Spinner icon, yellow "Processing" badge
 * - Pending: Circle icon, no badge, shows due date
 * - Overdue: Alert icon, red "Overdue" badge
 * - Failed: Alert icon, red "Failed" badge
 *
 * @example
 * <InstallmentCard
 *   number={1}
 *   amount={210000}
 *   currency="EUR"
 *   dueDate={new Date()}
 *   status="pending"
 *   isNext={true}
 *   totalInstallments={2}
 * />
 */
export function InstallmentCard({
  number,
  amount,
  currency,
  dueDate,
  label,
  status = "pending",
  paidAt,
  isNext = false,
  totalInstallments,
  className,
}: InstallmentCardProps): React.ReactElement {
  const statusBadge = getStatusBadge(status);
  const isPaid = status === "paid";
  const dateToShow = isPaid && paidAt ? paidAt : dueDate;
  const dateLabel = isPaid ? "Paid" : "Due";

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border",
        isNext && status === "pending" && "border-primary bg-primary/5",
        status === "overdue" && "border-destructive/50 bg-destructive/5",
        status === "paid" && "border-green-200 bg-green-50/50",
        className
      )}
      role="listitem"
      aria-label={`Payment ${number}${totalInstallments ? ` of ${totalInstallments}` : ""}: ${formatCurrency(amount, currency)}`}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0">{getStatusIcon(status)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            Payment {number}
            {totalInstallments && ` of ${totalInstallments}`}
          </span>
          {statusBadge && (
            <Badge variant={statusBadge.variant} className="text-xs">
              {statusBadge.label}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {dateLabel} {format(dateToShow, "MMM d, yyyy")}
            {label && !isPaid && ` (${label})`}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 text-right">
        <span
          className={cn(
            "font-semibold",
            isPaid && "text-muted-foreground line-through"
          )}
        >
          {formatCurrency(amount, currency)}
        </span>
      </div>
    </div>
  );
}
