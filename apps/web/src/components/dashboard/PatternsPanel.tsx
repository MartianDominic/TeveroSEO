"use client";

/**
 * PatternsPanel component for displaying detected cross-client patterns.
 * Phase 25: Team & Intelligence
 *
 * Features:
 * - Pattern list with severity indicators
 * - Expandable detail view per pattern
 * - Affected clients list with links
 * - Resolve/dismiss actions
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@tevero/ui";
import {
  TrendingDown,
  TrendingUp,
  Activity,
  ChevronDown,
  Check,
  X,
  Users,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import type { PatternWithClients, PatternType, PatternSeverity } from "@/types/patterns";
import { getPatternSeverity } from "@/types/patterns";
import {
  getPatterns,
  dismissPattern,
  resolvePattern,
  refreshPatterns,
} from "@/actions/analytics/detect-patterns";

interface PatternsPanelProps {
  workspaceId: string;
}

/**
 * Icon mapping for pattern types.
 */
const patternIcons: Record<PatternType, React.ReactNode> = {
  traffic_drop: <TrendingDown className="h-4 w-4 text-red-500" />,
  traffic_surge: <TrendingUp className="h-4 w-4 text-green-500" />,
  ranking_shift: <Activity className="h-4 w-4 text-yellow-500" />,
  industry_trend: <TrendingUp className="h-4 w-4 text-blue-500" />,
  serp_change: <Activity className="h-4 w-4 text-purple-500" />,
  seasonal_trend: <Activity className="h-4 w-4 text-cyan-500" />,
};

/**
 * Badge variant based on severity.
 */
function getSeverityBadgeVariant(
  severity: PatternSeverity
): "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Badge variant based on pattern direction.
 */
function getDirectionBadgeVariant(
  direction: string
): "destructive" | "default" | "secondary" {
  switch (direction) {
    case "down":
      return "destructive";
    case "up":
      return "default";
    default:
      return "secondary";
  }
}

export function PatternsPanel({ workspaceId }: PatternsPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: patterns,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["patterns", workspaceId],
    queryFn: () => getPatterns(workspaceId),
    staleTime: 60_000, // 1 minute
  });

  const dismissMutation = useMutation({
    mutationFn: dismissPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolvePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshPatterns(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
    },
  });

  if (isLoading) {
    return <PatternsPanelSkeleton />;
  }

  if (!patterns?.length) {
    return null; // Don't show if no patterns detected
  }

  const criticalCount = patterns.filter(
    (p) => getPatternSeverity(p) === "critical"
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Detected Patterns</CardTitle>
            <Badge variant="secondary">{patterns.length}</Badge>
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} critical</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCcw
              className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {patterns.map((pattern) => {
          const severity = getPatternSeverity(pattern);
          const isExpanded = expandedId === pattern.id;

          return (
            <div key={pattern.id} className="border rounded-lg p-3">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId(isExpanded ? null : pattern.id)}
              >
                <div className="flex items-center gap-3">
                  {patternIcons[pattern.patternType as PatternType] || (
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{pattern.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {pattern.affectedCount} clients affected |{" "}
                      {pattern.confidence.toFixed(0)}% confidence
                    </p>
                  </div>
                  <Badge variant={getDirectionBadgeVariant(pattern.direction)}>
                    {pattern.direction === "down" ? "-" : "+"}
                    {pattern.magnitude.toFixed(1)}%
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    {pattern.description}
                  </p>

                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Affected clients:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {pattern.affectedClients.slice(0, 5).map((client) => (
                      <Link
                        key={client.id}
                        href={`/clients/${client.id}` as Parameters<typeof router.push>[0]}
                        className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors"
                      >
                        {client.name}
                      </Link>
                    ))}
                    {pattern.affectedClients.length > 5 && (
                      <span className="text-xs text-muted-foreground px-2 py-1">
                        +{pattern.affectedClients.length - 5} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        resolveMutation.mutate(pattern.id);
                      }}
                      disabled={resolveMutation.isPending}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark Resolved
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissMutation.mutate(pattern.id);
                      }}
                      disabled={dismissMutation.isPending}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for PatternsPanel.
 */
function PatternsPanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Detected Patterns</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="border rounded-lg p-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-muted rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
              <div className="h-5 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
