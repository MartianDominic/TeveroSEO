"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Common props for numeral primitives
 */
export interface NumProps {
  value: number | string;
  unit?: string;
  className?: string;
}

/**
 * Base styles shared by all numeral components
 */
const baseNumStyles = cn(
  "font-display",
  "[font-variant-numeric:tabular-nums_lining-nums]",
  "leading-none text-text-1"
);

/**
 * NumMega - Largest display numeral
 * Uses: --num-mega (58-80px), Newsreader, tabular-nums
 */
export function NumMega({ value, unit, className }: NumProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className={cn(
          baseNumStyles,
          "text-[length:var(--num-mega)]",
          "tracking-[-0.034em]"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {unit && (
        <span className="text-[length:var(--type-h2)] text-text-3 font-sans">
          {unit}
        </span>
      )}
    </span>
  );
}

NumMega.displayName = "NumMega";

/**
 * NumHero - Hero numeral for dashboards
 * Uses: --num-hero (38-46px), Newsreader, tabular-nums
 */
export function NumHero({ value, unit, className }: NumProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className={cn(
          baseNumStyles,
          "text-[length:var(--num-hero)]",
          "tracking-[-0.028em]"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {unit && (
        <span className="text-[length:var(--type-h3)] text-text-3 font-sans">
          {unit}
        </span>
      )}
    </span>
  );
}

NumHero.displayName = "NumHero";

/**
 * NumCard - Card-level numeral for KPI displays
 * Uses: --num-card (36-44px), Newsreader, tabular-nums
 */
export function NumCard({ value, unit, className }: NumProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className={cn(
          baseNumStyles,
          "text-[length:var(--num-card)]",
          "tracking-[-0.024em]"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {unit && (
        <span className="text-[length:var(--type-small)] text-text-3 font-sans">
          {unit}
        </span>
      )}
    </span>
  );
}

NumCard.displayName = "NumCard";

/**
 * NumRow - Row-level numeral for tables/lists
 * Uses: --num-row (20-26px), Newsreader, tabular-nums
 */
export function NumRow({ value, unit, className }: NumProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", className)}>
      <span
        className={cn(
          baseNumStyles,
          "text-[length:var(--num-row)]",
          "tracking-[-0.018em]"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {unit && (
        <span className="text-[length:var(--type-tiny)] text-text-3 font-sans">
          {unit}
        </span>
      )}
    </span>
  );
}

NumRow.displayName = "NumRow";

/**
 * NumTiny - Smallest numeral for compact displays
 * Uses: --num-tiny (15-18px), Newsreader, tabular-nums
 */
export function NumTiny({ value, unit, className }: NumProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", className)}>
      <span
        className={cn(
          baseNumStyles,
          "text-[length:var(--num-tiny)]",
          "tracking-[-0.012em]"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {unit && (
        <span className="text-[length:var(--type-tiny)] text-text-3 font-sans">
          {unit}
        </span>
      )}
    </span>
  );
}

NumTiny.displayName = "NumTiny";

/**
 * NumDelta - Delta value with direction indicator
 */
export interface NumDeltaProps extends NumProps {
  direction?: "up" | "down" | "flat";
}

export function NumDelta({
  value,
  unit = "%",
  direction,
  className,
}: NumDeltaProps) {
  // Infer direction from numeric value if not provided
  const inferredDirection =
    direction ??
    (typeof value === "number"
      ? value > 0
        ? "up"
        : value < 0
        ? "down"
        : "flat"
      : "flat");

  const colorClass = {
    up: "text-success",
    down: "text-error",
    flat: "text-text-3",
  }[inferredDirection];

  const prefix = {
    up: "+",
    down: "",
    flat: "",
  }[inferredDirection];

  return (
    <span className={cn("inline-flex items-baseline gap-0.5", colorClass, className)}>
      <span
        className={cn(
          "font-display",
          "[font-variant-numeric:tabular-nums_lining-nums]",
          "text-[length:var(--num-tiny)]",
          "tracking-[-0.012em]"
        )}
      >
        {prefix}
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {unit && (
        <span className="text-[length:var(--type-tiny)]">{unit}</span>
      )}
    </span>
  );
}

NumDelta.displayName = "NumDelta";
