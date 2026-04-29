"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "../lib/utils";
import { CardActionMenu, type CardAction } from "./card-action-menu";
import { Skeleton } from "./skeleton";

/**
 * Delta configuration for MetricCard
 */
export interface MetricDelta {
  value: number;
  direction: "up" | "down" | "flat";
  period?: string;
}

/**
 * Props for MetricCard component
 */
export interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  delta?: MetricDelta;
  trend?: number[];
  icon?: React.ComponentType<{ className?: string }>;
  actions?: CardAction[];
  loading?: boolean;
  className?: string;
}

// Direction icon mapping
const directionIcons = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
} as const;

// Direction color mapping
const directionColors = {
  up: "text-success",
  down: "text-error",
  flat: "text-text-3",
} as const;

/**
 * Simple sparkline component
 */
function Sparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Normalize to 0-100 scale
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full h-8", className)}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
    </svg>
  );
}

/**
 * A KPI display card with optional delta, sparkline, and actions.
 * Uses v6 design tokens with Newsreader numerals.
 */
export function MetricCard({
  label,
  value,
  unit,
  delta,
  trend,
  icon: Icon,
  actions,
  loading = false,
  className,
}: MetricCardProps) {
  const DirectionIcon = delta ? directionIcons[delta.direction] : null;
  const directionColor = delta ? directionColors[delta.direction] : "";

  if (loading) {
    return (
      <div
        className={cn(
          "bg-surface rounded-[var(--radius-card)] shadow-card",
          "p-[var(--space-5)]",
          className
        )}
      >
        <Skeleton className="h-3 w-16 mb-3" />
        <Skeleton className="h-10 w-24 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Base card styles
        "relative bg-surface rounded-[var(--radius-card)] shadow-card",
        "p-[var(--space-5)]",
        // Hover transition
        "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:shadow-lift hover:-translate-y-px",
        // Group for hover reveal
        "group",
        className
      )}
    >
      {/* Actions menu - hidden at rest, shown on hover */}
      {actions && actions.length > 0 && (
        <div
          className={cn(
            "absolute top-[var(--space-3)] right-[var(--space-3)]",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          )}
        >
          <CardActionMenu actions={actions} />
        </div>
      )}

      {/* Icon (optional) */}
      {Icon && (
        <div className="mb-2">
          <Icon className="w-5 h-5 text-text-3" />
        </div>
      )}

      {/* Label */}
      <p
        className={cn(
          "text-[length:var(--type-tiny)] text-text-2",
          "tracking-[0.06em] [font-variant-caps:all-small-caps]"
        )}
      >
        {label}
      </p>

      {/* Value with unit */}
      <div className="flex items-baseline gap-1 mt-1">
        <span
          className={cn(
            "font-display text-[length:var(--num-card)]",
            "font-[tabular-nums] leading-none text-text-1",
            "tracking-[-0.024em]"
          )}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-[length:var(--type-small)] text-text-3">
            {unit}
          </span>
        )}
      </div>

      {/* Delta */}
      {delta && (
        <div className="flex items-center gap-1 mt-2">
          {DirectionIcon && (
            <DirectionIcon className={cn("w-3 h-3", directionColor)} />
          )}
          <span className={cn("text-[length:var(--type-tiny)]", directionColor)}>
            {delta.direction === "up" && "+"}
            {delta.value}%
          </span>
          {delta.period && (
            <span className="text-[length:var(--type-tiny)] text-text-3">
              {delta.period}
            </span>
          )}
        </div>
      )}

      {/* Sparkline - hidden at rest, revealed on hover */}
      {trend && trend.length > 1 && (
        <div
          className={cn(
            "mt-3",
            "opacity-0 translate-x-[-4px]",
            "transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            "group-hover:opacity-100 group-hover:translate-x-0"
          )}
        >
          <Sparkline data={trend} />
        </div>
      )}
    </div>
  );
}

MetricCard.displayName = "MetricCard";
