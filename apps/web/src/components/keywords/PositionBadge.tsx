"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@tevero/ui";

interface PositionBadgeProps {
  position: number | null;
  change: number | null;
  className?: string;
}

/**
 * Position badge with change indicator arrow.
 * Positive change = improved (green up arrow)
 * Negative change = declined (red down arrow)
 * Zero/null change = stable (gray dash)
 */
export function PositionBadge({
  position,
  change,
  className,
}: PositionBadgeProps) {
  if (position === null || position === 0) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Not ranking
      </Badge>
    );
  }

  const improved = change !== null && change > 0;
  const declined = change !== null && change < 0;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono",
        improved && "text-success border-accent-line bg-success-soft",
        declined && "text-error border-error-soft bg-error-soft",
        className,
      )}
    >
      <span className="mr-1">{position}</span>
      {improved && (
        <>
          <ArrowUp className="h-3 w-3 inline" />
          <span className="text-[12px] ml-0.5">+{change}</span>
        </>
      )}
      {declined && (
        <>
          <ArrowDown className="h-3 w-3 inline" />
          <span className="text-[12px] ml-0.5">{change}</span>
        </>
      )}
      {!improved && !declined && change !== null && (
        <Minus className="h-3 w-3 inline text-muted-foreground" />
      )}
    </Badge>
  );
}
