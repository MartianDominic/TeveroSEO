"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, Skeleton } from "@tevero/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export type CwvRating = "good" | "needs-improvement" | "poor";
export type CwvMetricType = "lcp" | "cls" | "inp";

export interface CwvCardProps {
  metric: CwvMetricType;
  value: number;
  rating: CwvRating;
  previousValue?: number;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const METRIC_CONFIG: Record<
  CwvMetricType,
  {
    name: string;
    fullName: string;
    unit: string;
    thresholds: { good: number; needsImprovement: number };
    formatValue: (v: number) => string;
    description: string;
  }
> = {
  lcp: {
    name: "LCP",
    fullName: "Largest Contentful Paint",
    unit: "s",
    thresholds: { good: 2.5, needsImprovement: 4.0 },
    formatValue: (v) => (v / 1000).toFixed(1),
    description: "Measures loading performance. Good LCP is under 2.5 seconds.",
  },
  cls: {
    name: "CLS",
    fullName: "Cumulative Layout Shift",
    unit: "",
    thresholds: { good: 0.1, needsImprovement: 0.25 },
    formatValue: (v) => v.toFixed(3),
    description: "Measures visual stability. Good CLS is under 0.1.",
  },
  inp: {
    name: "INP",
    fullName: "Interaction to Next Paint",
    unit: "ms",
    thresholds: { good: 200, needsImprovement: 500 },
    formatValue: (v) => Math.round(v).toString(),
    description: "Measures responsiveness. Good INP is under 200ms.",
  },
};

const RATING_STYLES: Record<CwvRating, { bg: string; text: string; badge: string }> = {
  good: {
    bg: "bg-success/10",
    text: "text-success",
    badge: "bg-success text-white",
  },
  "needs-improvement": {
    bg: "bg-warning/10",
    text: "text-warning",
    badge: "bg-warning text-white",
  },
  poor: {
    bg: "bg-error/10",
    text: "text-error",
    badge: "bg-error text-white",
  },
};

const RATING_LABELS: Record<CwvRating, string> = {
  good: "Good",
  "needs-improvement": "Needs Improvement",
  poor: "Poor",
};

// ============================================================================
// Component
// ============================================================================

export function CwvCard({
  metric,
  value,
  rating,
  previousValue,
  loading = false,
  className,
}: CwvCardProps) {
  const config = METRIC_CONFIG[metric];
  const styles = RATING_STYLES[rating];

  // Calculate trend
  const trend = React.useMemo(() => {
    if (previousValue === undefined || previousValue === 0) return null;

    const change = ((value - previousValue) / previousValue) * 100;
    // For CWV, lower is better (except CLS where it's just "lower is better")
    const isImprovement = value < previousValue;

    return {
      value: Math.abs(change),
      direction: isImprovement ? "down" : change > 0 ? "up" : "flat",
      isPositive: isImprovement,
    };
  }, [value, previousValue]);

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-10 w-16 mb-2" />
          <Skeleton className="h-5 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", styles.bg, className)}>
      <CardContent className="p-4">
        {/* Header with metric name and info tooltip */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {config.name}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1 rounded hover:bg-black/5 transition-colors">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-semibold mb-1">{config.fullName}</p>
                <p className="text-sm text-muted-foreground">{config.description}</p>
                <div className="mt-2 text-xs">
                  <p>
                    <span className="text-success font-medium">Good:</span>{" "}
                    {metric === "lcp"
                      ? `< ${config.thresholds.good}s`
                      : metric === "cls"
                        ? `< ${config.thresholds.good}`
                        : `< ${config.thresholds.good}ms`}
                  </p>
                  <p>
                    <span className="text-warning font-medium">Needs work:</span>{" "}
                    {metric === "lcp"
                      ? `${config.thresholds.good}s - ${config.thresholds.needsImprovement}s`
                      : metric === "cls"
                        ? `${config.thresholds.good} - ${config.thresholds.needsImprovement}`
                        : `${config.thresholds.good}ms - ${config.thresholds.needsImprovement}ms`}
                  </p>
                  <p>
                    <span className="text-error font-medium">Poor:</span>{" "}
                    {metric === "lcp"
                      ? `> ${config.thresholds.needsImprovement}s`
                      : metric === "cls"
                        ? `> ${config.thresholds.needsImprovement}`
                        : `> ${config.thresholds.needsImprovement}ms`}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Value display */}
        <div className="flex items-baseline gap-1">
          <span className={cn("text-3xl font-semibold tabular-nums", styles.text)}>
            {config.formatValue(value)}
          </span>
          {config.unit && (
            <span className="text-sm text-muted-foreground">{config.unit}</span>
          )}
        </div>

        {/* Rating badge and trend */}
        <div className="flex items-center justify-between mt-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              styles.badge
            )}
          >
            {RATING_LABELS[rating]}
          </span>

          {trend && trend.value > 0.5 && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs",
                trend.isPositive ? "text-success" : "text-error"
              )}
            >
              {trend.direction === "up" ? (
                <ArrowUp className="h-3 w-3" />
              ) : trend.direction === "down" ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>{trend.value.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

CwvCard.displayName = "CwvCard";
