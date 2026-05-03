"use client";

/**
 * ChangeHistory Component
 * Phase 66-07: DOM Change Approval System
 *
 * Displays the full history of DOM changes with:
 * - Status badges (pending, live, rejected, rolled_back)
 * - Before/after values
 * - Actor and timestamp
 * - Rollback action for live changes
 * - Pagination for long history
 */

import { formatDistanceToNow, format } from "date-fns";
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  Code,
  Type,
  FileCode,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface HistoryChange {
  id: string;
  changeType: "meta_title" | "meta_description" | "canonical" | "schema" | "internal_link" | "content";
  targetSelector?: string | null;
  targetUrl?: string | null;
  oldValue?: string | null;
  newValue: string;
  status: "pending" | "approved" | "rejected" | "live" | "rolled_back";
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  deployedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface ChangeHistoryProps {
  /** List of all changes */
  changes: HistoryChange[];
  /** Loading state */
  isLoading?: boolean;
  /** Pagination info */
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** Called when user clicks a change row */
  onSelectChange?: (change: HistoryChange) => void;
  /** Called when user clicks rollback on a live change */
  onRollback: (changeId: string) => void;
  /** Called when page changes */
  onPageChange: (offset: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHANGE_TYPE_LABELS: Record<HistoryChange["changeType"], string> = {
  meta_title: "Title",
  meta_description: "Description",
  canonical: "Canonical",
  schema: "Schema",
  internal_link: "Internal Link",
  content: "Content",
};

const STATUS_CONFIG: Record<
  HistoryChange["status"],
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: CheckCircle2,
  },
  live: {
    label: "Live",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
    icon: XCircle,
  },
  rolled_back: {
    label: "Rolled Back",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200",
    icon: RotateCcw,
  },
};

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status }: { status: HistoryChange["status"] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={`gap-1 ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function TruncatedValue({ value, maxLength = 50 }: { value: string; maxLength?: number }) {
  const truncated = value.length > maxLength
    ? `${value.substring(0, maxLength)}...`
    : value;

  return (
    <span
      className="font-mono text-xs"
      title={value.length > maxLength ? value : undefined}
    >
      {truncated}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          No change history
        </h3>
        <p className="text-sm text-muted-foreground">
          DOM changes will appear here once they're created.
        </p>
      </CardContent>
    </Card>
  );
}

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: { limit: number; offset: number; hasMore: boolean };
  onPageChange: (offset: number) => void;
}) {
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const hasPrevious = pagination.offset > 0;

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground">
        Page {currentPage}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.offset + pagination.limit)}
          disabled={!pagination.hasMore}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChangeHistory({
  changes,
  isLoading = false,
  pagination,
  onSelectChange,
  onRollback,
  onPageChange,
}: ChangeHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
          <CardDescription>
            All DOM changes for this site
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (changes.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change History</CardTitle>
        <CardDescription>
          All DOM changes for this site
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Old Value</TableHead>
                <TableHead>New Value</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((change) => {
                const createdAt = typeof change.createdAt === "string"
                  ? new Date(change.createdAt)
                  : change.createdAt;

                return (
                  <TableRow
                    key={change.id}
                    className={onSelectChange ? "cursor-pointer hover:bg-accent/50" : ""}
                    onClick={() => onSelectChange?.(change)}
                  >
                    <TableCell className="font-medium">
                      {CHANGE_TYPE_LABELS[change.changeType]}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                        {change.targetUrl || "Global"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {change.oldValue ? (
                        <TruncatedValue value={change.oldValue} />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TruncatedValue value={change.newValue} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={change.status} />
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm text-muted-foreground"
                        title={format(createdAt, "PPpp")}
                      >
                        {formatDistanceToNow(createdAt, { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {change.status === "live" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRollback(change.id);
                          }}
                          title="Rollback this change"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Rollback</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pagination && (
          <PaginationControls
            pagination={pagination}
            onPageChange={onPageChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
