"use client";

/**
 * VariantTabs - Tab bar for switching between A/B test variants.
 * Phase 102-05: A/B testing UI and version diff
 *
 * Features:
 * - Tab for each variant: [Control] [Variant A] [Variant B] [+ Variant]
 * - Visual states per UI-SPEC:
 *   - Inactive: --surface-2 background, --text-3
 *   - Active: --accent-soft background, --accent-ink text
 *   - Winner badge: --success-soft pill with checkmark
 *   - Loser badge: --error-soft pill with x
 *   - Needs data: --surface-3 pill, --text-4
 * - Shows impressions/conversions inline
 * - Click tab to preview that variant in editor
 *
 * Renders in PersuasionBlock footer when variants exist.
 */

import { type FC, useMemo } from "react";
import { Check, X, Plus, Activity, BarChart3 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BlockVariant, BlockVariantStatus } from "@/lib/document-builder/types";
import {
  calculateSignificance,
  type ABTestResult,
} from "@/lib/document-builder/ab-testing-service";

/**
 * Props for VariantTabs component.
 */
export interface VariantTabsProps {
  /** Array of variants for this block */
  variants: BlockVariant[];
  /** Currently active variant ID */
  activeVariantId: string;
  /** Callback when a variant tab is clicked */
  onSelectVariant: (variantId: string) => void;
  /** Callback when "Add Variant" is clicked */
  onAddVariant?: () => void;
  /** Additional class names */
  className?: string;
  /** Whether to show analytics badges */
  showAnalytics?: boolean;
}

/**
 * Format large numbers with K/M suffix.
 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Get badge styling based on variant status and test result.
 */
function getStatusBadge(
  status: BlockVariantStatus,
  result?: ABTestResult
): { icon: typeof Check | typeof X | typeof Activity | null; className: string; label: string } | null {
  // Winner status
  if (status === "winner") {
    return {
      icon: Check,
      className: "bg-success-soft text-success",
      label: "Winner",
    };
  }

  // Loser status
  if (status === "loser") {
    return {
      icon: X,
      className: "bg-error-soft text-error",
      label: "Stopped",
    };
  }

  // Paused
  if (status === "paused") {
    return {
      icon: null,
      className: "bg-surface-3 text-text-4",
      label: "Paused",
    };
  }

  // Active with result
  if (result) {
    if (result.recommendation === "winner") {
      return {
        icon: Check,
        className: "bg-success-soft text-success",
        label: `${Math.round(result.confidenceLevel)}% confident`,
      };
    }
    if (result.recommendation === "loser") {
      return {
        icon: X,
        className: "bg-error-soft text-error",
        label: "Underperforming",
      };
    }
    if (result.recommendation === "needs_more_data") {
      return {
        icon: Activity,
        className: "bg-surface-3 text-text-4",
        label: "Collecting data",
      };
    }
  }

  return null;
}

/**
 * Single variant tab component.
 */
interface VariantTabProps {
  variant: BlockVariant;
  isActive: boolean;
  onClick: () => void;
  result?: ABTestResult;
  showAnalytics: boolean;
}

const VariantTab: FC<VariantTabProps> = ({
  variant,
  isActive,
  onClick,
  result,
  showAnalytics,
}) => {
  const badge = getStatusBadge(variant.status, result);
  const conversionRate = result
    ? `${(result.conversionRate * 100).toFixed(1)}%`
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2",
        "px-3 py-2",
        "rounded-md",
        "text-sm font-medium",
        "transition-all duration-[160ms]",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        isActive
          ? "bg-accent-soft text-accent-ink"
          : "bg-surface-2 text-text-3 hover:bg-surface-3 hover:text-text-2"
      )}
      aria-selected={isActive}
      role="tab"
    >
      {/* Variant name */}
      <span>{variant.variantName}</span>

      {/* Analytics inline */}
      {showAnalytics && variant.impressions > 0 && (
        <span
          className={cn(
            "flex items-center gap-1",
            "text-xs",
            isActive ? "text-accent-ink/70" : "text-text-4"
          )}
        >
          <BarChart3 className="h-3 w-3" />
          {formatNumber(variant.impressions)}
          {conversionRate && (
            <>
              <span className="mx-0.5">|</span>
              {conversionRate}
            </>
          )}
        </span>
      )}

      {/* Status badge */}
      {badge && (
        <span
          className={cn(
            "flex items-center gap-1",
            "px-1.5 py-0.5",
            "rounded-full",
            "text-xs font-medium",
            badge.className
          )}
          title={badge.label}
        >
          {badge.icon && <badge.icon className="h-3 w-3" />}
          {badge.label.length <= 10 && <span>{badge.label}</span>}
        </span>
      )}
    </button>
  );
};

/**
 * VariantTabs component.
 *
 * Displays tabs for switching between A/B test variants in a block.
 * Includes statistical significance badges and inline analytics.
 */
export const VariantTabs: FC<VariantTabsProps> = ({
  variants,
  activeVariantId,
  onSelectVariant,
  onAddVariant,
  className,
  showAnalytics = true,
}) => {
  // Calculate significance for all variants
  const results = useMemo(() => {
    if (!showAnalytics || variants.length < 2) return new Map<string, ABTestResult>();

    const significanceResults = calculateSignificance(variants);
    return new Map(significanceResults.map((r) => [r.variantId, r]));
  }, [variants, showAnalytics]);

  // Don't render if no variants
  if (variants.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        "px-4 py-2",
        "border-t border-hairline",
        "bg-surface",
        className
      )}
      role="tablist"
      aria-label="Variant tabs"
    >
      {/* Variant tabs */}
      {variants.map((variant) => (
        <VariantTab
          key={variant.id}
          variant={variant}
          isActive={variant.id === activeVariantId}
          onClick={() => onSelectVariant(variant.id)}
          result={results.get(variant.id)}
          showAnalytics={showAnalytics}
        />
      ))}

      {/* Add variant button */}
      {onAddVariant && (
        <button
          type="button"
          onClick={onAddVariant}
          className={cn(
            "flex items-center gap-1",
            "px-2 py-2",
            "rounded-md",
            "text-sm text-text-3",
            "bg-transparent",
            "border border-dashed border-hairline",
            "hover:bg-surface-2 hover:text-text-2 hover:border-text-4",
            "transition-all duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          )}
          aria-label="Add variant"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Variant</span>
        </button>
      )}
    </div>
  );
};

export default VariantTabs;
