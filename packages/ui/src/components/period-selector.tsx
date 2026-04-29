"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// PeriodSelectorProps
// ---------------------------------------------------------------------------

export type PeriodValue = "7d" | "30d" | "90d" | "1y" | "custom";

export interface PeriodSelectorProps {
  /** Currently selected period */
  value: PeriodValue;
  /** Callback when period changes */
  onChange: (period: PeriodValue) => void;
  /** Custom date range (when value is 'custom') */
  customRange?: { start: Date; end: Date };
  /** Callback when custom button is clicked */
  onCustomClick?: () => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Period options
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS: { value: PeriodValue; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
];

// ---------------------------------------------------------------------------
// PeriodSelector
// ---------------------------------------------------------------------------

/**
 * PeriodSelector displays pill buttons for time period selection.
 *
 * Features:
 * - Horizontal pill container with shadow-card
 * - Active state with bg-accent-soft, text-accent-ink
 * - Inactive hover with bg-surface-2
 * - Optional custom date range picker trigger
 *
 * @example
 * <PeriodSelector
 *   value="30d"
 *   onChange={(period) => console.log(period)}
 *   onCustomClick={() => openDatePicker()}
 * />
 */
export function PeriodSelector({
  value,
  onChange,
  customRange,
  onCustomClick,
  disabled = false,
  className,
}: PeriodSelectorProps) {
  const formatCustomRange = () => {
    if (!customRange) return "Custom";
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const start = customRange.start.toLocaleDateString(undefined, options);
    const end = customRange.end.toLocaleDateString(undefined, options);
    return `${start} - ${end}`;
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5",
        "p-0.5",
        "rounded-[var(--radius-button)]",
        "bg-surface",
        "shadow-[var(--shadow-card)]",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            "px-3 py-1.5",
            "rounded-[var(--radius-input)]",
            "text-[13px] font-medium",
            "transition-colors duration-[160ms]",
            value === option.value
              ? "bg-accent-soft text-accent-ink"
              : "text-text-2 hover:bg-surface-2 hover:text-text-1"
          )}
        >
          {option.label}
        </button>
      ))}

      {/* Custom option */}
      {onCustomClick && (
        <button
          type="button"
          onClick={() => {
            onCustomClick();
            onChange("custom");
          }}
          disabled={disabled}
          className={cn(
            "px-3 py-1.5",
            "rounded-[var(--radius-input)]",
            "text-[13px] font-medium",
            "flex items-center gap-1.5",
            "transition-colors duration-[160ms]",
            value === "custom"
              ? "bg-accent-soft text-accent-ink"
              : "text-text-2 hover:bg-surface-2 hover:text-text-1"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="max-w-[100px] truncate">{formatCustomRange()}</span>
        </button>
      )}
    </div>
  );
}

PeriodSelector.displayName = "PeriodSelector";
