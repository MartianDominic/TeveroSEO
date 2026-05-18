"use client";

/**
 * BlockTypeBadge - Semantic-colored pill for persuasion block types.
 * Phase 102-02: Block Palette and Canvas
 *
 * Renders a badge with color-coded background/text per UI-SPEC:
 * - pain_amplifier: error-soft / error
 * - villain_story: warning-soft / warning
 * - credibility: accent-soft / accent-ink
 * - etc.
 *
 * Typography per Design System v6:
 * - 12px (--type-tiny)
 * - font-weight: 500
 * - letter-spacing: 0.06em
 * - font-variant-caps: all-small-caps
 */

import { type FC, memo } from "react";

import { cn } from "@/lib/utils";
import {
  getBlockMetadata,
  type BlockTypeDefinition,
} from "@/lib/document-builder/persuasion-blocks";
import type { PersuasionBlockType } from "@/lib/document-builder/types";

/**
 * Props for BlockTypeBadge component.
 */
export interface BlockTypeBadgeProps {
  /** Persuasion block type */
  type: PersuasionBlockType;
  /** Optional override label */
  label?: string;
  /** Additional class names */
  className?: string;
  /** Whether to show in compact mode (icon only on small screens) */
  compact?: boolean;
}

/**
 * Map block color tokens to Tailwind classes.
 * Matches UI-SPEC semantic color table.
 */
const colorMap: Record<string, { bg: string; text: string }> = {
  // Error colors
  'error-soft': { bg: 'bg-error-soft', text: 'text-error' },
  // Warning colors
  'warning-soft': { bg: 'bg-warning-soft', text: 'text-warning' },
  // Accent colors
  'accent-soft': { bg: 'bg-accent-soft', text: 'text-accent-ink' },
  // Info colors
  'info-soft': { bg: 'bg-info-soft', text: 'text-info' },
  // Success colors
  'success-soft': { bg: 'bg-success-soft', text: 'text-success' },
  // Surface colors (neutral)
  'surface-2': { bg: 'bg-surface-2', text: 'text-text-2' },
  'surface-3': { bg: 'bg-surface-3', text: 'text-text-3' },
};

/**
 * Get Tailwind classes for a block type's color scheme.
 */
function getColorClasses(metadata: BlockTypeDefinition | undefined): string {
  if (!metadata) {
    return 'bg-surface-2 text-text-2';
  }

  const bgKey = metadata.color.bg;
  const mapped = colorMap[bgKey];

  if (mapped) {
    return cn(mapped.bg, mapped.text);
  }

  // Fallback for unmapped colors
  return 'bg-surface-2 text-text-2';
}

/**
 * BlockTypeBadge component.
 *
 * A semantic-colored pill badge that displays the persuasion block type.
 * Colors are designed to provide visual hierarchy and meaning:
 * - Red (error) for pain/urgency blocks
 * - Yellow (warning) for villain/urgency blocks
 * - Green (success) for risk reversal
 * - Blue (info) for social proof
 * - Green (accent) for offers and CTAs
 */
const BlockTypeBadgeComponent: FC<BlockTypeBadgeProps> = ({
  type,
  label,
  className,
  compact = false,
}) => {
  const metadata = getBlockMetadata(type);
  const displayLabel = label ?? metadata?.label ?? type;
  const colorClasses = getColorClasses(metadata);

  return (
    <span
      className={cn(
        // Base styles
        "inline-flex items-center gap-1.5",
        "rounded-[var(--radius-pill,9999px)]",
        "px-[11px] py-[5px]",
        // Typography per UI-SPEC
        "text-[12px] font-medium",
        "tracking-[0.06em]",
        "[font-variant-caps:all-small-caps]",
        // Transition
        "transition-colors duration-[160ms]",
        // Colors
        colorClasses,
        // Compact mode
        compact && "sm:px-[11px] px-[8px]",
        className
      )}
      title={metadata?.description}
    >
      {compact ? (
        <>
          <span className="hidden sm:inline">{displayLabel}</span>
          <span className="sm:hidden">{displayLabel.slice(0, 3)}</span>
        </>
      ) : (
        displayLabel
      )}
    </span>
  );
};

/**
 * Memoized BlockTypeBadge - only re-renders when type or label changes.
 */
export const BlockTypeBadge = memo(BlockTypeBadgeComponent, (prev, next) => {
  return (
    prev.type === next.type &&
    prev.label === next.label &&
    prev.compact === next.compact &&
    prev.className === next.className
  );
});

BlockTypeBadge.displayName = "BlockTypeBadge";

export default BlockTypeBadge;
