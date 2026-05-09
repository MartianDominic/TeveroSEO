"use client";

/**
 * AppShellSidebar - Main navigation sidebar
 *
 * Phase 65: UX Fix - HIGH-44 (added TooltipProvider for disabled nav tooltips)
 */

import React from "react";

import { UserButton } from "@clerk/nextjs";
import { Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";

import { TeveroMark } from "@/components/brand/TeveroLogo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { AppShellNavItem, type NavItem } from "./AppShellNavItem";
import { ClientSwitcherButton } from "./ClientSwitcherButton";

import type { PlatformHealth } from "./hooks/usePlatformHealth";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppShellSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeClientId: string | null;
  isActive: (href: string) => boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  platformHealth: PlatformHealth;
  dashboardNav: NavItem;
  clientNav: NavItem[];
  globalNav: NavItem[];
}

// ---------------------------------------------------------------------------
// AppShellSidebar
// ---------------------------------------------------------------------------

export const AppShellSidebar: React.FC<AppShellSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeClientId,
  isActive,
  theme,
  onToggleTheme,
  platformHealth,
  dashboardNav,
  clientNav,
  globalNav,
}) => {
  const renderNavItem = (item: NavItem) => (
    <AppShellNavItem
      key={item.href("__key__")}
      item={item}
      collapsed={collapsed}
      activeClientId={activeClientId}
      isActive={isActive}
      platformHealth={item.label === "Global Settings" ? platformHealth : undefined}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-card",
          "transition-[width] duration-200 ease-in-out",
          collapsed ? "w-12" : "w-[220px]"
        )}
      >
        {/* Logo row */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-4",
          collapsed ? "justify-center" : "gap-2"
        )}
      >
        <TeveroMark size={22} className="shrink-0" />
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            TeveroSEO
          </span>
        )}
      </div>

      {/* Client switcher - TOP, most prominent element */}
      <div
        className={cn(
          "shrink-0 border-b border-border",
          collapsed ? "flex justify-center p-3" : "p-3"
        )}
      >
        <ClientSwitcherButton collapsed={collapsed} />
      </div>

      {/* Client nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        {/* Agency Dashboard - global, not client-scoped */}
        <div className="mb-2">{renderNavItem(dashboardNav)}</div>

        {!collapsed && (
          <p className="text-xs-safe-safe font-medium uppercase tracking-widest text-muted-foreground px-3 mb-1.5 mt-3">
            Client
          </p>
        )}
        <div className="space-y-0.5">
          {clientNav.map((item) => renderNavItem(item))}
        </div>

        {!collapsed && (
          <p className="text-xs-safe-safe font-medium uppercase tracking-widest text-muted-foreground px-3 mb-1.5 mt-5">
            Workspace
          </p>
        )}
        {collapsed && <div className="mt-2" />}
        <div className="space-y-0.5">
          {globalNav.map((item) => renderNavItem(item))}
        </div>
      </nav>

      {/* Bottom section: UserButton + theme toggle + collapse toggle */}
      <div className="shrink-0 border-t border-border p-3 space-y-0.5">
        {/* Clerk UserButton */}
        <div
          className={cn(
            "flex items-center rounded-md px-2 py-2",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          <UserButton />
          {!collapsed && (
            <span className="text-xs-safe text-muted-foreground truncate">
              Account
            </span>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className={cn(
            "flex w-full items-center rounded-md px-2 py-2 text-xs-safe text-muted-foreground",
            "transition-colors hover:bg-accent/50 hover:text-foreground",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && (
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center rounded-md px-2 py-2 text-xs-safe text-muted-foreground",
            "transition-colors hover:bg-accent/50 hover:text-foreground",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
      </aside>
    </TooltipProvider>
  );
};
