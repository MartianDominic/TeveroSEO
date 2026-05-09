"use client";

/**
 * ContextSelectionGrid - Grid of context selection checkboxes for AI generation.
 *
 * Extracted from AIGenerationModal for better component organization.
 */

import { type FC } from "react";

import { cn } from "@/lib/utils";

import { Checkbox } from "@tevero/ui";

import {
  type ContextType,
  type ContextConfig,
  getLocalizedLabel,
  getLocalizedDescription,
} from "./ai-generation-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Context item with runtime availability status.
 */
export interface ContextItem extends ContextConfig {
  available: boolean;
  /** Summary info when available (e.g., "Score: 72/100") */
  summary?: string;
}

export interface ContextSelectionGridProps {
  items: ContextItem[];
  selectedContext: ContextType[];
  onToggle: (type: ContextType) => void;
  locale: "en" | "lt";
  notAvailableLabel: string;
}

// ---------------------------------------------------------------------------
// ContextSelectionGrid
// ---------------------------------------------------------------------------

export const ContextSelectionGrid: FC<ContextSelectionGridProps> = ({
  items,
  selectedContext,
  onToggle,
  locale,
  notAvailableLabel,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = selectedContext.includes(item.type);

        return (
          <button
            key={item.type}
            type="button"
            onClick={() => item.available && onToggle(item.type)}
            disabled={!item.available}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left",
              "transition-colors",
              item.available
                ? "hover:border-primary hover:bg-accent cursor-pointer"
                : "opacity-50 cursor-not-allowed",
              isSelected && item.available && "border-primary bg-accent"
            )}
          >
            <Checkbox
              checked={isSelected && item.available}
              disabled={!item.available}
              onCheckedChange={() => onToggle(item.type)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">
                  {getLocalizedLabel(item, locale)}
                </span>
              </div>
              <p className="text-xs-safe text-muted-foreground mt-0.5 line-clamp-1">
                {item.available
                  ? item.summary || getLocalizedDescription(item, locale)
                  : notAvailableLabel}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
