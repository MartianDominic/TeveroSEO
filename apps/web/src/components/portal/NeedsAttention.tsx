"use client";

/**
 * NeedsAttention Component
 *
 * Shows keywords with significant position drops.
 * V6 design: warning-soft background, position badge showing drop amount.
 */

import * as React from "react";

import { AlertTriangle, ArrowDown } from "lucide-react";

import type { NeedsAttentionItem } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

export interface NeedsAttentionCardProps {
  /** Attention item data */
  item: NeedsAttentionItem;
  /** Click handler for detail navigation */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function NeedsAttentionCard({
  item,
  onClick,
  className,
}: NeedsAttentionCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 rounded-[--radius-card] bg-warning-soft/50",
        "border border-warning/10",
        "transition-all duration-200 hover:bg-warning-soft",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Alert icon */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-text-1 font-medium truncate">
            {item.keyword}
          </p>

          <div className="mt-1 flex items-center gap-2">
            {/* Current position badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1",
                "px-2 py-0.5 rounded-[--radius-pill]",
                "bg-warning text-white text-[12px] font-medium"
              )}
            >
              #{item.position}
            </span>

            {/* Drop indicator */}
            <span className="text-[12px] text-text-3 flex items-center gap-1">
              <ArrowDown className="h-3 w-3 text-error" />
              <span className="tabular-nums">from #{item.previousPosition}</span>
              <span className="text-error font-medium">
                (-{item.dropAmount})
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * NeedsAttentionList - Container for attention items
 */
export interface NeedsAttentionListProps {
  /** List of attention items */
  items: NeedsAttentionItem[];
  /** Maximum items to show */
  maxItems?: number;
  /** Title */
  title?: string;
  /** Click handler for item */
  onItemClick?: (item: NeedsAttentionItem) => void;
  /** Additional CSS classes */
  className?: string;
}

export function NeedsAttentionList({
  items,
  maxItems = 5,
  title = "Needs Attention",
  onItemClick,
  className,
}: NeedsAttentionListProps) {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h4 className="text-[12px] font-medium text-text-3 uppercase tracking-[0.08em] mb-3 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        {title}
        <span className="ml-1 px-1.5 py-0.5 rounded-[--radius-pill] bg-warning-soft text-warning text-xs-safe-safe">
          {items.length}
        </span>
      </h4>
      <div className="space-y-2">
        {displayItems.map((item, idx) => (
          <NeedsAttentionCard
            key={`${item.keyword}-${idx}`}
            item={item}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
