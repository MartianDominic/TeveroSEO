"use client";

/**
 * Predictive Alerts Panel - displays upcoming predicted issues across clients.
 * Phase 25: Team & Intelligence - Predictive Alerts + Goal Projection
 */

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
} from "@tevero/ui";
import {
  AlertTriangle,
  TrendingDown,
  Target,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { getWorkspacePredictions } from "@/actions/analytics/get-predictions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import type { PredictiveAlert, PredictionType, PredictionSeverity } from "@/types/predictions";

interface PredictiveAlertsPanelProps {
  workspaceId: string;
  className?: string;
  maxItems?: number;
}

/**
 * Icon mapping for prediction types.
 */
const predictionIcons: Record<PredictionType, React.ReactNode> = {
  traffic_decline: <TrendingDown className="h-4 w-4" />,
  goal_at_risk: <Target className="h-4 w-4" />,
  goal_achievable: <Target className="h-4 w-4" />,
  ranking_drop: <Activity className="h-4 w-4" />,
  ctr_decline: <Activity className="h-4 w-4" />,
};

/**
 * Severity color configuration.
 */
const severityConfig: Record<
  PredictionSeverity,
  { bg: string; text: string; icon: string; border: string }
> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    icon: "text-red-600",
    border: "border-red-200 dark:border-red-800",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-400",
    icon: "text-yellow-600",
    border: "border-yellow-200 dark:border-yellow-800",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: "text-blue-600",
    border: "border-blue-200 dark:border-blue-800",
  },
};

/**
 * Get action suggestion based on prediction type.
 */
function getActionSuggestion(alert: PredictiveAlert): string {
  switch (alert.type) {
    case "traffic_decline":
      return "Review content strategy and recent changes";
    case "goal_at_risk":
      return "Adjust targets or increase effort";
    case "goal_achievable":
      return "Maintain current momentum";
    case "ranking_drop":
      return "Analyze competitor activity and backlinks";
    case "ctr_decline":
      return "Review meta titles and descriptions";
    default:
      return "Investigate and take action";
  }
}

/**
 * Single alert row component.
 */
function AlertRow({ alert }: { alert: PredictiveAlert }) {
  const config = severityConfig[alert.severity];

  return (
    <Link
      href={`/clients/${alert.clientId}` as never}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors hover:opacity-80",
        config.bg,
        config.border
      )}
    >
      <span className={cn("mt-0.5 shrink-0", config.icon)}>
        {predictionIcons[alert.type]}
      </span>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium text-sm truncate", config.text)}>
            {alert.title}
          </span>
        </div>

        {alert.clientName && (
          <p className="text-xs text-muted-foreground truncate">
            {alert.clientName}
          </p>
        )}

        <p className="text-xs text-muted-foreground line-clamp-2">
          {alert.description}
        </p>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Timeframe: <span className="font-medium">{alert.timeframe}</span>
          </span>
          <span className="text-muted-foreground">
            Probability:{" "}
            <span className="font-medium">{alert.probability.toFixed(0)}%</span>
          </span>
        </div>

        <p className="text-xs text-muted-foreground italic">
          Suggestion: {getActionSuggestion(alert)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <Badge
          variant={alert.severity === "critical" ? "destructive" : "secondary"}
          className="text-xs"
        >
          {alert.severity}
        </Badge>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </div>
    </Link>
  );
}

/**
 * Loading skeleton for alerts panel.
 */
function AlertsPanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Empty state when no predictions.
 */
function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No predictive alerts</p>
        <p className="text-xs text-muted-foreground mt-1">
          All clients are performing as expected
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Predictive Alerts Panel component.
 * Displays predicted issues across all clients in the workspace.
 */
export function PredictiveAlertsPanel({
  workspaceId,
  className,
  maxItems = 5,
}: PredictiveAlertsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const { data: predictions, isLoading, error } = useQuery({
    queryKey: ["predictions", workspaceId],
    queryFn: () => getWorkspacePredictions(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <AlertsPanelSkeleton />;
  }

  // Filter to show only critical and warning alerts
  const alertsToShow =
    predictions?.filter((p) => p.severity === "critical" || p.severity === "warning") ?? [];

  if (error || alertsToShow.length === 0) {
    return <EmptyState />;
  }

  const criticalCount = alertsToShow.filter((p) => p.severity === "critical").length;
  const warningCount = alertsToShow.filter((p) => p.severity === "warning").length;
  const displayedAlerts = alertsToShow.slice(0, expanded ? maxItems : 3);
  const hasMore = alertsToShow.length > maxItems;

  return (
    <Card className={cn("border-yellow-200 dark:border-yellow-800", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Predictive Alerts
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {warningCount} warning
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 p-0"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2">
          {displayedAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}

          {hasMore && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              +{alertsToShow.length - maxItems} more alerts
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
