"use client";

/**
 * StatCard Component
 *
 * Hero metric display with delta indicator and trust source.
 * Follows V6 design system: Newsreader for value, ghost-edge shadows, hover lift.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "./DeltaBadge";
import { TrustIndicator } from "./TrustIndicator";
import type { TrustLevel } from "@/lib/portal/types";

export interface StatCardProps {
  /** Icon to display (optional) */
  icon?: React.ReactNode;
  /** Label text (e.g., "Organic Clicks") */
  label: string;
  /** Primary value to display */
  value: number | string;
  /** Percentage change from previous period */
  delta?: number;
  /** Label for delta (e.g., "vs last month") */
  deltaLabel?: string;
  /** Data source for trust indicator */
  source?: TrustLevel;
  /** Custom formatter for value */
  formatValue?: (v: number) => string;
  /** Additional CSS classes */
  className?: string;
  /** Whether this is a hero/large variant */
  hero?: boolean;
}

/**
 * Default number formatter with locale support
 */
function defaultFormatValue(v: number): string {
  return v.toLocaleString();
}

export function StatCard({
  icon,
  label,
  value,
  delta,
  deltaLabel,
  source,
  formatValue = defaultFormatValue,
  className,
  hero = false,
}: StatCardProps) {
  const displayValue =
    typeof value === "number" ? formatValue(value) : value;

  return (
    <div
      className={cn(
        // Base card styles with V6 ghost-edge shadow
        "bg-surface rounded-[--radius-card] transition-all duration-[280ms]",
        // Ghost-edge shadow system
        "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]",
        // Hover lift effect
        "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_6px_16px_-4px_rgba(20,20,26,0.06),0_16px_40px_-16px_rgba(20,20,26,0.10),inset_0_1px_0_rgba(255,255,255,0.55)]",
        "hover:-translate-y-px",
        // Padding
        hero ? "p-8" : "p-6",
        className
      )}
      style={
        {
          "--ease-smooth": "cubic-bezier(0.16, 1, 0.3, 1)",
        } as React.CSSProperties
      }
    >
      {/* Header row: icon + label + source */}
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <span className="text-text-3 flex-shrink-0">{icon}</span>
        )}
        <span
          className={cn(
            "font-sans font-medium text-text-3 uppercase tracking-[0.1em]",
            "text-[12px] leading-[1.3]" // V6 type-tiny
          )}
        >
          {label}
        </span>
        <span className="flex-1" />
        {source && <TrustIndicator level={source} showLabel={false} />}
      </div>

      {/* Value display: Newsreader serif, large */}
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "font-display font-normal tracking-[-0.026em]",
            "tabular-nums lining-nums",
            "text-text-1",
            hero
              ? "text-[clamp(58px,4.8vw,80px)] leading-[0.95]" // num-mega
              : "text-[clamp(36px,3vw,44px)] leading-[1]" // num-card
          )}
        >
          {displayValue}
        </span>

        {/* Delta badge */}
        {delta !== undefined && (
          <DeltaBadge value={delta} suffix="%" />
        )}
      </div>

      {/* Delta label */}
      {deltaLabel && (
        <p className="mt-2 text-[13px] text-text-3 font-sans">
          {deltaLabel}
        </p>
      )}
    </div>
  );
}
