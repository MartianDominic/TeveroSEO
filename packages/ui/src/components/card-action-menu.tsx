"use client";

import * as React from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { Button } from "./button";
import { cn } from "../lib/utils";

/**
 * Action item for CardActionMenu
 */
export interface CardAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

/**
 * Props for CardActionMenu component
 */
export interface CardActionMenuProps {
  actions: CardAction[];
  align?: "start" | "end";
  triggerClassName?: string;
}

/**
 * A popover-based action menu for cards.
 * Uses v6 design tokens for consistent styling.
 */
export function CardActionMenu({
  actions,
  align = "end",
  triggerClassName,
}: CardActionMenuProps) {
  const [open, setOpen] = React.useState(false);

  const handleAction = (action: CardAction) => {
    if (!action.disabled) {
      action.onClick();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-text-3 hover:text-text-1 hover:bg-surface-2",
            "transition-colors duration-[var(--motion-fast)]",
            triggerClassName
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-48 p-1 bg-surface shadow-pop rounded-[var(--radius-button)]"
        role="menu"
        aria-label="Card actions"
      >
        <div className="flex flex-col gap-0.5">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                role="menuitem"
                disabled={action.disabled}
                onClick={() => handleAction(action)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-[var(--radius-input)]",
                  "transition-colors duration-[var(--motion-fast)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  action.variant === "destructive"
                    ? "text-error hover:bg-error-soft"
                    : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {action.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

CardActionMenu.displayName = "CardActionMenu";
