"use client";

/**
 * Goal Projection Card - displays goal progress with projected completion date.
 * Phase 25: Team & Intelligence - Predictive Alerts + Goal Projection
 */

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
} from "@tevero/ui";
import { Target, TrendingUp, TrendingDown, Minus, Calendar, AlertCircle } from "lucide-react";
import { getGoalProjections } from "@/actions/analytics/get-predictions";
import { cn } from "@/lib/utils";
import type { GoalProjection, TrendDirection } from "@/types/predictions";

interface GoalProjectionCardProps {
  clientId: string;
  className?: string;
}

/**
 * Progress bar component for goal attainment.
 */
function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn(
          "h-full transition-all duration-300",
          clamped >= 100
            ? "bg-emerald-500"
            : clamped >= 80
              ? "bg-yellow-500"
              : "bg-blue-500"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/**
 * Trend indicator with icon and direction.
 */
function TrendIndicator({ trend, velocity }: { trend: TrendDirection; velocity: number }) {
  const config = {
    accelerating: {
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      label: "Accelerating",
      color: "text-emerald-600",
    },
    steady: {
      icon: <Minus className="h-4 w-4 text-yellow-500" />,
      label: "Steady",
      color: "text-yellow-600",
    },
    decelerating: {
      icon: <TrendingDown className="h-4 w-4 text-orange-500" />,
      label: "Slowing",
      color: "text-orange-600",
    },
    declining: {
      icon: <TrendingDown className="h-4 w-4 text-red-500" />,
      label: "Declining",
      color: "text-red-600",
    },
  };

  const { icon, label, color } = config[trend];

  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className={cn("text-xs", color)}>
        {label}
        {velocity !== 0 && (
          <span className="text-muted-foreground ml-1">
            ({velocity > 0 ? "+" : ""}{velocity.toFixed(1)}/wk)
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Confidence badge with color coding.
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const variant = confidence >= 70 ? "default" : confidence >= 40 ? "secondary" : "outline";
  const label = confidence >= 70 ? "High" : confidence >= 40 ? "Medium" : "Low";

  return (
    <Badge variant={variant} className="text-xs">
      {label} ({confidence.toFixed(0)}%)
    </Badge>
  );
}

/**
 * Format projected date for display.
 */
function formatProjectedDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Single goal projection row.
 */
function GoalProjectionRow({ projection }: { projection: GoalProjection }) {
  const isAtRisk = projection.trend === "declining" || (projection.daysToTarget && projection.daysToTarget > 90);
  const isAchieved = projection.attainmentPct >= 100;

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{projection.goalName}</span>
        </div>
        <ConfidenceBadge confidence={projection.confidence} />
      </div>

      <ProgressBar value={projection.attainmentPct} />

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {projection.currentValue.toLocaleString()} /{" "}
          {projection.targetValue.toLocaleString()}
        </span>
        <span
          className={cn(
            "font-medium",
            isAchieved
              ? "text-emerald-600"
              : projection.attainmentPct >= 80
                ? "text-yellow-600"
                : "text-muted-foreground"
          )}
        >
          {projection.attainmentPct.toFixed(0)}%
        </span>
      </div>

      <div className="flex items-center justify-between">
        <TrendIndicator trend={projection.trend} velocity={projection.weeklyVelocity} />

        {isAchieved ? (
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <Target className="h-3 w-3" />
            Goal achieved
          </span>
        ) : projection.projectedDate ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Est. {formatProjectedDate(projection.projectedDate)}
          </span>
        ) : isAtRisk ? (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            At risk
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Insufficient data
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for goal projections.
 */
function GoalProjectionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Goal Projection Card component.
 * Displays goal progress with projected completion dates and confidence indicators.
 */
export function GoalProjectionCard({ clientId, className }: GoalProjectionCardProps) {
  const { data: projections, isLoading, error } = useQuery({
    queryKey: ["goal-projections", clientId],
    queryFn: () => getGoalProjections(clientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <GoalProjectionSkeleton />;
  }

  if (error || !projections?.length) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Goal Projections
          <Badge variant="secondary" className="ml-auto text-xs">
            {projections.length} {projections.length === 1 ? "goal" : "goals"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {projections.slice(0, 5).map((projection) => (
          <GoalProjectionRow key={projection.goalId} projection={projection} />
        ))}
        {projections.length > 5 && (
          <p className="text-xs text-center text-muted-foreground">
            +{projections.length - 5} more goals
          </p>
        )}
      </CardContent>
    </Card>
  );
}
