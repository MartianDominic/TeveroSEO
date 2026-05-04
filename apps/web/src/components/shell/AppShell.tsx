"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LayoutGrid,
  Calendar,
  Brain,
  Settings,
  BarChart3,
  Globe,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientStore } from "@/stores";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcutsHelp } from "@/components/dashboard/KeyboardShortcutsHelp";
import { useTheme } from "@/contexts/ThemeContext";
import { AppShellSidebar } from "./AppShellSidebar";
import { usePlatformHealth } from "./hooks/usePlatformHealth";
import type { NavItem } from "./AppShellNavItem";

const COLLAPSED_KEY = "appshell_collapsed";

// ---------------------------------------------------------------------------
// Navigation Configuration
// ---------------------------------------------------------------------------

// Agency Dashboard nav item (global, not client-scoped)
const DASHBOARD_NAV: NavItem = {
  label: "Dashboard",
  icon: LayoutGrid,
  href: () => "/dashboard",
  clientScoped: false,
};

const CLIENT_NAV: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: (id) => `/clients/${id}`,
    clientScoped: true,
  },
  {
    label: "Calendar",
    icon: Calendar,
    href: (id) => `/clients/${id}/calendar`,
    clientScoped: true,
  },
  {
    label: "Articles",
    icon: LayoutDashboard,
    href: (id) => `/clients/${id}/articles`,
    clientScoped: true,
  },
  {
    label: "Intelligence",
    icon: Brain,
    href: (id) => `/clients/${id}/intelligence`,
    clientScoped: true,
  },
  {
    label: "Settings",
    icon: Settings,
    href: (id) => `/clients/${id}/settings`,
    clientScoped: true,
  },
  {
    label: "Analytics",
    icon: BarChart3,
    href: (id) => `/clients/${id}/analytics`,
    clientScoped: true,
  },
  {
    label: "SEO Audit",
    icon: Search,
    href: (id) => `/clients/${id}/seo`,
    clientScoped: true,
  },
];

const GLOBAL_NAV: NavItem[] = [
  {
    label: "Global Settings",
    icon: Globe,
    href: () => "/settings",
    clientScoped: false,
  },
];

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const { activeClientId } = useClientStore();
  const { theme, toggleTheme } = useTheme();
  const platformHealth = usePlatformHealth();

  // HYDRATION FIX: Initialize to consistent default, sync with localStorage after mount
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Sync collapsed state from localStorage after component mounts (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === "true") {
        setCollapsed(true);
      }
    } catch (error) {
      // localStorage unavailable (private browsing, etc.) - use default state
      console.debug('[AppShell] localStorage unavailable:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch (error) {
      // localStorage unavailable - state won't persist across sessions
      console.debug('[AppShell] Failed to persist collapsed state:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [collapsed]);

  // Command palette keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cursor glow effect tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--cursor-x", e.clientX + "px");
      document.documentElement.style.setProperty("--cursor-y", e.clientY + "px");
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  const isActive = useCallback(
    (href: string): boolean => {
      if (activeClientId && href === `/clients/${activeClientId}`) {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname, activeClientId]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AppShellSidebar
        collapsed={collapsed}
        onToggleCollapse={toggle}
        activeClientId={activeClientId}
        isActive={isActive}
        theme={theme}
        onToggleTheme={toggleTheme}
        platformHealth={platformHealth}
        dashboardNav={DASHBOARD_NAV}
        clientNav={CLIENT_NAV}
        globalNav={GLOBAL_NAV}
      />

      {/* Content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onOpen={() => setIsCommandPaletteOpen(true)} />
        <main
          className={cn(
            "flex-1 overflow-y-auto relative",
            theme === "light" && "dot-grid cursor-glow"
          )}
        >
          {children}
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <KeyboardShortcutsHelp />
    </div>
  );
};
