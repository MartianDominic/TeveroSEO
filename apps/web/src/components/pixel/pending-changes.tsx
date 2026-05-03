"use client";

/**
 * PendingChanges Component
 * Phase 66-07: DOM Change Approval System
 *
 * Displays a list of pending DOM changes awaiting approval.
 * Shows change type, target URL, and quick approve/reject actions.
 */

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  XCircle,
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
  Skeleton,
} from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface PendingChange {
  id: string;
  changeType: "meta_title" | "meta_description" | "canonical" | "schema" | "internal_link" | "content";
  targetSelector?: string | null;
  targetUrl?: string | null;
  oldValue?: string | null;
  newValue: string;
  status: string;
  createdAt: Date | string;
}

export interface PendingChangesProps {
  /** List of pending changes */
  changes: PendingChange[];
  /** Loading state */
  isLoading?: boolean;
  /** Called when user clicks on a change */
  onSelectChange: (change: PendingChange) => void;
  /** Called when user clicks quick approve */
  onQuickApprove: (changeId: string) => void;
  /** Called when user clicks quick reject */
  onQuickReject: (changeId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHANGE_TYPE_CONFIG: Record<
  PendingChange["changeType"],
  { label: string; icon: typeof FileText; color: string }
> = {
  meta_title: {
    label: "Title",
    icon: Type,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  },
  meta_description: {
    label: "Description",
    icon: FileText,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  },
  canonical: {
    label: "Canonical",
    icon: Link2,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  },
  schema: {
    label: "Schema",
    icon: Code,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  },
  internal_link: {
    label: "Internal Link",
    icon: ExternalLink,
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
  },
  content: {
    label: "Content",
    icon: FileCode,
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  },
};

// ============================================================================
// Sub-components
// ============================================================================

function ChangeTypeBadge({ type }: { type: PendingChange["changeType"] }) {
  const config = CHANGE_TYPE_CONFIG[type];
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

function ChangeCard({
  change,
  onSelect,
  onQuickApprove,
  onQuickReject,
}: {
  change: PendingChange;
  onSelect: () => void;
  onQuickApprove: () => void;
  onQuickReject: () => void;
}) {
  const createdAt = typeof change.createdAt === "string"
    ? new Date(change.createdAt)
    : change.createdAt;

  const truncatedValue = change.newValue.length > 80
    ? `${change.newValue.substring(0, 80)}...`
    : change.newValue;

  return (
    <Card
      className="hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <ChangeTypeBadge type={change.changeType} />
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            </div>

            {change.targetUrl && (
              <p className="text-sm text-muted-foreground mb-1 truncate">
                {change.targetUrl}
              </p>
            )}

            <p className="text-sm font-medium text-foreground line-clamp-2">
              {truncatedValue}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
              onClick={(e) => {
                e.stopPropagation();
                onQuickApprove();
              }}
              title="Approve"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="sr-only">Approve</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
              onClick={(e) => {
                e.stopPropagation();
                onQuickReject();
              }}
              title="Reject"
            >
              <XCircle className="h-4 w-4" />
              <span className="sr-only">Reject</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          All caught up!
        </h3>
        <p className="text-sm text-muted-foreground">
          No pending changes to review.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PendingChanges({
  changes,
  isLoading = false,
  onSelectChange,
  onQuickApprove,
  onQuickReject,
}: PendingChangesProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Pending Changes
          </h2>
          <Skeleton className="h-5 w-8" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Pending Changes
        </h2>
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          {changes.length}
        </Badge>
      </div>

      {changes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {changes.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              onSelect={() => onSelectChange(change)}
              onQuickApprove={() => onQuickApprove(change.id)}
              onQuickReject={() => onQuickReject(change.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
