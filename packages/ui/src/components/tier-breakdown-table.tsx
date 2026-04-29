"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { SeverityDots } from "./severity-dots";

// ---------------------------------------------------------------------------
// Finding interface
// ---------------------------------------------------------------------------

export interface Finding {
  id: string;
  tier: 1 | 2 | 3 | 4;
  title: string;
  count: number;
  url?: string;
}

// ---------------------------------------------------------------------------
// TierBreakdownTableProps
// ---------------------------------------------------------------------------

export interface TierBreakdownTableProps {
  /** List of findings to display */
  findings: Finding[];
  /** Callback when a tier header is clicked */
  onTierClick?: (tier: number) => void;
  /** Callback when a finding row is clicked */
  onFindingClick?: (finding: Finding) => void;
  /** Whether to show severity dots (default true) */
  showSeverityDots?: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Tier border colors
// ---------------------------------------------------------------------------

const TIER_BORDER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: "border-l-error",
  2: "border-l-warning",
  3: "border-l-info",
  4: "border-l-text-4",
};

const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
};

// ---------------------------------------------------------------------------
// TierBreakdownTable
// ---------------------------------------------------------------------------

/**
 * TierBreakdownTable displays audit findings grouped by severity tier.
 *
 * Features:
 * - Grid layout with tier indicator, title, count, and action
 * - Colored left border by tier (error/warning/info/muted)
 * - SeverityDots for visual tier indication
 * - Hover reveal for action arrow
 * - Hairline row separators
 *
 * @example
 * <TierBreakdownTable
 *   findings={[
 *     { id: '1', tier: 1, title: 'Missing meta descriptions', count: 5 },
 *     { id: '2', tier: 2, title: 'Slow page load', count: 3 },
 *   ]}
 *   onFindingClick={(finding) => console.log(finding)}
 * />
 */
export function TierBreakdownTable({
  findings,
  onTierClick,
  onFindingClick,
  showSeverityDots = true,
  className,
}: TierBreakdownTableProps) {
  // Group findings by tier for headers
  const groupedByTier = findings.reduce((acc, finding) => {
    if (!acc[finding.tier]) {
      acc[finding.tier] = [];
    }
    acc[finding.tier].push(finding);
    return acc;
  }, {} as Record<number, Finding[]>);

  // Sort tiers
  const sortedTiers = Object.keys(groupedByTier)
    .map(Number)
    .sort((a, b) => a - b) as (1 | 2 | 3 | 4)[];

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-surface",
        "shadow-[var(--shadow-card)]",
        "overflow-hidden",
        className
      )}
    >
      {sortedTiers.map((tier, tierIndex) => (
        <div key={tier}>
          {/* Tier header */}
          <button
            onClick={() => onTierClick?.(tier)}
            className={cn(
              "w-full px-4 py-2",
              "flex items-center justify-between",
              "text-[13px] font-medium text-text-2",
              "bg-surface-2",
              "border-l-2",
              TIER_BORDER_COLORS[tier],
              onTierClick && "hover:bg-surface-3 cursor-pointer",
              "transition-colors duration-[160ms]"
            )}
          >
            <span className="flex items-center gap-2">
              {showSeverityDots && (
                <SeverityDots count={groupedByTier[tier].length} tier={tier} size="sm" />
              )}
              <span>{TIER_LABELS[tier]}</span>
            </span>
            <span className="font-mono text-[12px] text-text-3">
              {groupedByTier[tier].length}
            </span>
          </button>

          {/* Findings rows */}
          {groupedByTier[tier].map((finding, findingIndex) => (
            <div
              key={finding.id}
              role={onFindingClick ? "button" : undefined}
              tabIndex={onFindingClick ? 0 : undefined}
              onClick={() => onFindingClick?.(finding)}
              onKeyDown={
                onFindingClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onFindingClick(finding);
                      }
                    }
                  : undefined
              }
              className={cn(
                "group",
                "grid grid-cols-[1fr_auto_auto] items-center gap-3",
                "px-4 py-2.5",
                "border-l-2",
                TIER_BORDER_COLORS[finding.tier],
                // Row separator
                findingIndex < groupedByTier[tier].length - 1 &&
                  "border-b border-b-hairline-2",
                // Hover state
                onFindingClick && [
                  "cursor-pointer",
                  "hover:bg-surface-2",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset",
                ],
                "transition-colors duration-[160ms]"
              )}
            >
              {/* Title */}
              <span className="text-[13px] text-text-1 truncate">
                {finding.title}
              </span>

              {/* Count */}
              <span
                className={cn(
                  "font-mono text-[12px] text-text-3",
                  "[font-variant-numeric:tabular-nums]",
                  "min-w-[24px] text-right"
                )}
              >
                {finding.count}
              </span>

              {/* Action arrow (hover reveal) */}
              {onFindingClick && (
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-text-4",
                    "opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-[240ms]"
                  )}
                />
              )}
            </div>
          ))}

          {/* Tier separator */}
          {tierIndex < sortedTiers.length - 1 && (
            <div className="h-px bg-hairline" />
          )}
        </div>
      ))}

      {/* Empty state */}
      {findings.length === 0 && (
        <div className="px-4 py-8 text-center text-[13px] text-text-3">
          No findings to display
        </div>
      )}
    </div>
  );
}

TierBreakdownTable.displayName = "TierBreakdownTable";
