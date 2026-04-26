"use client";

/**
 * TierFilter Component
 * Phase 43-04: Prioritization Engine + UI
 *
 * Filter keywords by tier with badge counts.
 */

import { Button } from "@tevero/ui";

interface TierFilterProps {
  selected: string | null;
  onSelect: (tier: string | null) => void;
  counts?: Record<string, number>;
}

const TIERS = [
  { id: "must_do", label: "Must-Do", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { id: "should_do", label: "Should-Do", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { id: "nice_to_have", label: "Nice-to-Have", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { id: "ignore", label: "Ignore", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
] as const;

export function TierFilter({ selected, onSelect, counts }: TierFilterProps) {
  const totalCount = counts
    ? Object.values(counts).reduce((sum, c) => sum + c, 0)
    : 0;

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant={selected === null ? "default" : "outline"}
        size="sm"
        onClick={() => onSelect(null)}
      >
        All {counts && <span className="ml-1 text-xs">({totalCount})</span>}
      </Button>
      {TIERS.map((tier) => (
        <Button
          key={tier.id}
          variant={selected === tier.id ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(tier.id)}
          className="gap-1"
        >
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${tier.color}`}
          >
            {tier.label}
          </span>
          {counts && (
            <span className="text-xs text-muted-foreground">
              ({counts[tier.id] || 0})
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}

/**
 * Get tier badge styling by tier ID.
 */
export function getTierBadge(tier: string | null) {
  const found = TIERS.find((t) => t.id === tier);
  if (!found) return null;

  return {
    label: found.label,
    className: found.color,
  };
}
