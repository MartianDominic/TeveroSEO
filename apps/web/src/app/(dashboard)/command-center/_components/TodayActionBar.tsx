"use client";

/**
 * TodayActionBar Component
 * Phase 62-05: Command Center Dashboard Core
 *
 * Shows today's action counts: Overdue, Due Today, Awaiting You, New.
 * Implemented in Task 2.
 */

import { useDashboardMetrics } from "@/hooks/command-center/useDashboardMetrics";
import { Badge } from "@/components/ui/badge";
import { cn } from "@tevero/ui";
import type { DashboardMetricsResponse } from "@/types/dashboard-metrics";

interface TodayActionBarProps {
  initialData: DashboardMetricsResponse;
  workspaceId: string;
}

export function TodayActionBar({
  initialData,
  workspaceId,
}: TodayActionBarProps) {
  const { data } = useDashboardMetrics(workspaceId, { initialData });
  const metrics = data?.metrics?.today;

  const items = [
    {
      label: "Overdue",
      count: metrics?.overdue ?? 0,
      variant: "destructive" as const,
    },
    {
      label: "Due Today",
      count: metrics?.dueToday ?? 0,
      variant: "secondary" as const,
    },
    {
      label: "Awaiting You",
      count: metrics?.awaitingYou ?? 0,
      variant: "default" as const,
    },
    {
      label: "New",
      count: metrics?.new ?? 0,
      variant: "outline" as const,
    },
  ];

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
      <span className="font-medium text-muted-foreground">Today:</span>
      {items.map((item) => (
        <button
          key={item.label}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5",
            "hover:bg-accent transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
          type="button"
        >
          <Badge variant={item.variant} className="min-w-[24px] justify-center">
            {item.count}
          </Badge>
          <span className="text-sm">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
