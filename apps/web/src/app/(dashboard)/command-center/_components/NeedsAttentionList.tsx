/**
 * NeedsAttentionList Component
 * Phase 62-06: Needs Attention List with Quick Actions
 *
 * Displays items requiring attention sorted by priority.
 * Each item has a dropdown menu with quick action options:
 * - Send Reminder
 * - Snooze (with date picker)
 * - Add Note
 * - Mark as Lost
 *
 * Per DESIGN.md Section 5.2:
 * - Priority-sorted display
 * - One-click operations from dropdown
 * - Optimistic updates with revalidation
 */
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
  Skeleton,
} from "@tevero/ui";
import { PriorityBadge } from "@/components/command-center/PriorityBadge";
import { EntityIcon } from "@/components/command-center/EntityIcon";
import { QuickActionDialog } from "./QuickActionDialog";
import { useNeedsAttention } from "@/hooks/command-center/useNeedsAttention";
import { formatCurrency } from "@/lib/currency";
import { MoreHorizontal, Send, X, Clock, StickyNote } from "lucide-react";
import type { AttentionItem, QuickActionType, Priority } from "@/types/command-center";

/**
 * Priority order for sorting (lower number = higher priority).
 */
const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Loading skeleton for the attention list.
 */
function NeedsAttentionSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Needs Attention</CardTitle>
        <Skeleton className="h-4 w-16" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export interface NeedsAttentionListProps {
  workspaceId: string;
}

export function NeedsAttentionList({ workspaceId }: NeedsAttentionListProps) {
  const { data, isLoading } = useNeedsAttention(workspaceId);
  const [selectedItem, setSelectedItem] = useState<AttentionItem | null>(null);
  const [actionType, setActionType] = useState<QuickActionType | null>(null);

  const openAction = (item: AttentionItem, type: QuickActionType) => {
    setSelectedItem(item);
    setActionType(type);
  };

  const closeAction = () => {
    setSelectedItem(null);
    setActionType(null);
  };

  if (isLoading) {
    return <NeedsAttentionSkeleton />;
  }

  const items = data?.items ?? [];

  // Sort by priority: critical > high > medium > low
  const sorted = [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            Needs Attention
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              All caught up!
            </p>
          ) : (
            sorted.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <EntityIcon
                    type={item.entityType}
                    className="h-5 w-5 text-muted-foreground flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.valueInCents != null && item.valueInCents > 0 && (
                    <span className="text-sm font-medium">
                      {formatCurrency(item.valueInCents, item.currency ?? "EUR")}
                    </span>
                  )}
                  <PriorityBadge priority={item.priority} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => openAction(item, "reminder")}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send Reminder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openAction(item, "snooze")}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Snooze
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openAction(item, "note")}
                      >
                        <StickyNote className="h-4 w-4 mr-2" />
                        Add Note
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openAction(item, "lost")}
                        className="text-red-600 focus:text-red-600"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Mark as Lost
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selectedItem && actionType && (
        <QuickActionDialog
          item={selectedItem}
          actionType={actionType}
          onClose={closeAction}
        />
      )}
    </>
  );
}
