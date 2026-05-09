"use client";

/**
 * SmartAlerts Component
 * Phase 62-07: Smart Alert Detection
 *
 * Displays proactive alerts for at-risk deals and pipeline issues:
 * - High-value stuck deals (> 5000 EUR, no activity 7+ days)
 * - Win rate declining (dropped > 5%)
 * - Contracts expiring soon (within 14 days)
 * - Unassigned prospects (3+ without owner)
 * - Collection velocity drop (avg +5 days)
 *
 * Features:
 * - Severity-based color coding
 * - Dismiss functionality with optimistic updates
 * - Suggested actions with links
 */

import Link from "next/link";

import { AlertTriangle, X, ArrowRight, Bell, CheckCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSmartAlerts,
  type SmartAlert,
} from "@/hooks/command-center/useSmartAlerts";
import { cn } from "@/lib/utils";

/**
 * Severity-based styles for alert cards.
 */
const SEVERITY_STYLES: Record<SmartAlert["severity"], string> = {
  critical: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900",
  high: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900",
  medium: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900",
  low: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900",
};

/**
 * Severity-based badge variants.
 */
const SEVERITY_BADGE: Record<SmartAlert["severity"], string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

/**
 * Severity-based icon colors.
 */
const SEVERITY_ICON_COLOR: Record<SmartAlert["severity"], string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
};

interface SmartAlertsProps {
  workspaceId: string;
}

/**
 * Single alert card.
 */
function AlertCard({
  alert,
  onDismiss,
  isDismissing,
}: {
  alert: SmartAlert;
  onDismiss: (id: string) => void;
  isDismissing: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-all",
        SEVERITY_STYLES[alert.severity],
        isDismissing && "opacity-50"
      )}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle
              className={cn("h-4 w-4 flex-shrink-0", SEVERITY_ICON_COLOR[alert.severity])}
            />
            <span className="font-medium text-sm truncate">{alert.title}</span>
            <Badge
              variant="outline"
              className={cn("text-xs-safe uppercase", SEVERITY_BADGE[alert.severity])}
            >
              {alert.severity}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground ml-6">{alert.description}</p>

          {alert.suggestedAction && (
            <div className="mt-2 ml-6">
              {alert.actionUrl ? (
                <Link
                  href={alert.actionUrl as any}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {alert.suggestedAction}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  {alert.suggestedAction}
                </span>
              )}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDismiss(alert.id)}
          disabled={isDismissing}
          className="flex-shrink-0 h-8 w-8"
          title="Dismiss alert"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for alerts.
 */
function AlertsSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-6 ml-auto" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * Empty state when no alerts.
 */
function NoAlerts() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          All clear! No alerts at this time.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * SmartAlerts component displays proactive alerts for the workspace.
 *
 * @param workspaceId - The workspace to display alerts for
 */
export function SmartAlerts({ workspaceId }: SmartAlertsProps) {
  const { activeAlerts, isLoading, dismiss } = useSmartAlerts(workspaceId);

  // Loading state
  if (isLoading) {
    return <AlertsSkeleton />;
  }

  // No alerts - show success state
  if (activeAlerts.length === 0) {
    return <NoAlerts />;
  }

  // Sort by severity (critical first, then high, medium, low)
  const severityOrder: Record<SmartAlert["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const sortedAlerts = [...activeAlerts].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Bell className="h-5 w-5 text-orange-500" />
        <CardTitle className="text-base">Smart Alerts</CardTitle>
        <Badge variant="secondary" className="ml-auto">
          {activeAlerts.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedAlerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onDismiss={(id) => dismiss.mutate(id)}
            isDismissing={dismiss.isPending && dismiss.variables === alert.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}
