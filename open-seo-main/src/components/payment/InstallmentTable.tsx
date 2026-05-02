/**
 * Installment Table Component
 * Phase 60-03: Agency Installment Tracking Dashboard
 *
 * Displays installments in a table with:
 * - Client, Invoice, Amount, Due Date, Status columns
 * - Status badges: pending, upcoming, paid, overdue
 * - Loading skeleton state
 * - Empty state when no installments
 * - Optional row click handler for navigation
 *
 * Design reference: D-11 from 60-CONTEXT.md
 */
import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { Badge } from "@/client/components/ui/badge";
import { Skeleton } from "@/client/components/ui/skeleton";
import { cn } from "@/client/lib/utils";
import { formatCurrency } from "@/lib/format-currency";
import type { InstallmentStatus } from "@/db/payment-schedule-schema";

/**
 * Installment data shape from the API
 */
export interface InstallmentRow {
  id: string;
  invoiceNumber: string;
  invoiceId: string;
  clientName: string;
  clientId: string;
  amountCents: number;
  currency: string;
  dueAt: string;
  status: InstallmentStatus;
  paidAt: string | null;
  installmentNumber: number;
  totalInstallments: number;
}

/**
 * Props for the InstallmentTable component
 */
export interface InstallmentTableProps {
  /** List of installments to display */
  installments: InstallmentRow[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional click handler for row navigation */
  onRowClick?: (installment: InstallmentRow) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Determines if an installment is "upcoming" (pending + due within 7 days)
 */
function isUpcoming(installment: InstallmentRow): boolean {
  if (installment.status !== "pending") return false;
  const dueDate = new Date(installment.dueAt);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return dueDate >= now && dueDate <= sevenDaysFromNow;
}

/**
 * Get badge variant and text based on installment status
 */
function getStatusBadge(installment: InstallmentRow): {
  variant: "default" | "secondary" | "destructive" | "outline";
  text: string;
  className?: string;
} {
  // Check for "upcoming" before other statuses
  if (isUpcoming(installment)) {
    return {
      variant: "secondary",
      text: "Upcoming",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  switch (installment.status) {
    case "paid":
      return {
        variant: "secondary",
        text: "Paid",
        className: "bg-green-100 text-green-800 border-green-200",
      };
    case "overdue":
      return {
        variant: "destructive",
        text: "Overdue",
      };
    case "pending":
      return {
        variant: "outline",
        text: "Pending",
      };
    case "processing":
      return {
        variant: "secondary",
        text: "Processing",
        className: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case "failed":
      return {
        variant: "destructive",
        text: "Failed",
      };
    default:
      return {
        variant: "outline",
        text: installment.status,
      };
  }
}

/**
 * Format date for display (e.g., "Jan 15, 2024")
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Loading skeleton row
 */
function SkeletonRow(): React.ReactElement {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
    </TableRow>
  );
}

/**
 * Empty state when no installments
 */
function EmptyState(): React.ReactElement {
  return (
    <TableRow>
      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
        No installments found
      </TableCell>
    </TableRow>
  );
}

/**
 * InstallmentTable displays a list of payment installments with status badges.
 *
 * Features:
 * - Responsive table with Client, Invoice, Amount, Due Date, Status columns
 * - Status badges with appropriate colors
 * - "Upcoming" badge for pending installments due within 7 days
 * - Overdue badge highlighted in red
 * - Loading skeleton state
 * - Empty state when no data
 *
 * @example
 * <InstallmentTable
 *   installments={data}
 *   isLoading={false}
 *   onRowClick={(row) => navigate(`/invoices/${row.invoiceId}`)}
 * />
 */
export function InstallmentTable({
  installments,
  isLoading = false,
  onRowClick,
  className,
}: InstallmentTableProps): React.ReactElement {
  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Loading skeleton
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : installments.length === 0 ? (
            // Empty state
            <EmptyState />
          ) : (
            // Data rows
            installments.map((installment) => {
              const badge = getStatusBadge(installment);
              return (
                <TableRow
                  key={installment.id}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted"
                  )}
                  onClick={() => onRowClick?.(installment)}
                >
                  <TableCell className="font-medium">
                    {installment.clientName}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{installment.invoiceNumber}</span>
                      {installment.totalInstallments > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {installment.installmentNumber} of{" "}
                          {installment.totalInstallments}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(installment.amountCents, installment.currency)}
                  </TableCell>
                  <TableCell>{formatDate(installment.dueAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={badge.variant}
                      className={badge.className}
                    >
                      {badge.text}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
