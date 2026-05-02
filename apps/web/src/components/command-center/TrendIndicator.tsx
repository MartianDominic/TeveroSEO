/**
 * TrendIndicator Component
 * Phase 62-05: Command Center Dashboard Core
 *
 * Shows percentage change between current and previous values
 * with up/down/stable arrow indicators.
 */

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@tevero/ui";

interface TrendIndicatorProps {
  /** Current value */
  current: number;
  /** Previous value for comparison */
  previous: number;
  /** Suffix to display (default: %) */
  suffix?: string;
  /** Whether higher is better (default: true) */
  positiveIsGood?: boolean;
}

/**
 * TrendIndicator displays a percentage change with directional arrow.
 *
 * @example
 * ```tsx
 * <TrendIndicator current={1500} previous={1200} />
 * // Shows: +25% with green up arrow
 *
 * <TrendIndicator current={800} previous={1000} positiveIsGood={false} />
 * // Shows: -20% with green down arrow (lower is better)
 * ```
 */
export function TrendIndicator({
  current,
  previous,
  suffix = "%",
  positiveIsGood = true,
}: TrendIndicatorProps) {
  const diff = current - previous;

  // Handle no change
  if (diff === 0 || previous === 0) {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>No change</span>
      </span>
    );
  }

  const pctChange = ((diff / previous) * 100).toFixed(1);
  const isPositive = diff > 0;

  // Determine color based on direction and whether positive is good
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const colorClass = isGood ? "text-green-600" : "text-red-600";

  return (
    <span className={cn("flex items-center gap-1 text-sm", colorClass)}>
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>
        {isPositive ? "+" : ""}
        {pctChange}
        {suffix}
      </span>
    </span>
  );
}
