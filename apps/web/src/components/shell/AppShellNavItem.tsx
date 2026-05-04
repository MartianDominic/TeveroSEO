"use client";

/**
 * AppShellNavItem - Navigation item with tooltip support
 *
 * Phase 65: UX Fix - HIGH-44 (added tooltips explaining disabled state)
 */

import React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PlatformHealth } from "./hooks/usePlatformHealth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (clientId: string) => string;
  clientScoped: boolean;
}

export interface AppShellNavItemProps {
  item: NavItem;
  collapsed: boolean;
  activeClientId: string | null;
  isActive: (href: string) => boolean;
  /** Platform health indicator - only shown on Global Settings */
  platformHealth?: PlatformHealth;
}

// ---------------------------------------------------------------------------
// AppShellNavItem
// ---------------------------------------------------------------------------

export const AppShellNavItem: React.FC<AppShellNavItemProps> = ({
  item,
  collapsed,
  activeClientId,
  isActive,
  platformHealth,
}) => {
  const router = useRouter();
  const Icon = item.icon;
  const disabled = item.clientScoped && !activeClientId;
  const href = activeClientId ? item.href(activeClientId) : "#";
  const active = activeClientId ? isActive(item.href(activeClientId)) : false;
  const isGlobalSettings = item.label === "Global Settings";

  // Determine tooltip content based on state
  const getTooltipContent = () => {
    if (disabled) {
      return "Select a client first to access this feature";
    }
    if (collapsed) {
      return item.label;
    }
    return null;
  };

  const tooltipContent = getTooltipContent();

  const button = (
    <button
      disabled={disabled}
      onClick={() => {
        if (!disabled && href !== "#") {
          router.push(href as Parameters<typeof router.push>[0]);
        }
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        collapsed ? "justify-center" : "justify-start",
        active
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {/* Platform health dot - only on the Global Settings nav item */}
      {isGlobalSettings && !collapsed && platformHealth && (
        <span
          className={cn(
            "ml-auto h-2 w-2 rounded-full shrink-0",
            platformHealth === "ok" && "bg-emerald-500",
            platformHealth === "partial" && "bg-amber-400",
            platformHealth === "none" && "bg-red-500 animate-pulse"
          )}
        />
      )}
    </button>
  );

  // Wrap with tooltip if we have content to show
  if (tooltipContent) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap in span to allow tooltip on disabled button */}
          <span className="w-full">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
};
