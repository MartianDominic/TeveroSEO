"use client";

/**
 * Command palette for power users.
 * Opens with Cmd+K / Ctrl+K. Supports fuzzy search across clients, actions, and navigation.
 *
 * Phase 24: Power User Features
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@tevero/ui";
import {
  Search,
  Users,
  BarChart3,
  Settings,
  FileText,
  Bell,
  Zap,
  ArrowRight,
  Keyboard,
} from "lucide-react";
import type { ClientMetrics } from "@/lib/dashboard/types";

interface CommandPaletteProps {
  /** List of clients for search */
  clients?: ClientMetrics[];
  /** Callback to open keyboard shortcuts dialog */
  onOpenShortcuts?: () => void;
}

interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette({ clients = [], onOpenShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (callback: () => void) => {
      setOpen(false);
      setSearch("");
      callback();
    },
    []
  );

  const navigationActions: CommandAction[] = [
    {
      id: "dashboard",
      label: "Go to Dashboard",
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: "G D",
      action: () => router.push("/dashboard" as Parameters<typeof router.push>[0]),
      keywords: ["home", "overview", "portfolio"],
    },
    {
      id: "clients",
      label: "Go to Clients",
      icon: <Users className="h-4 w-4" />,
      shortcut: "G C",
      action: () => router.push("/clients" as Parameters<typeof router.push>[0]),
      keywords: ["list", "all"],
    },
    {
      id: "reports",
      label: "Go to Reports",
      icon: <FileText className="h-4 w-4" />,
      shortcut: "G R",
      action: () => router.push("/reports" as Parameters<typeof router.push>[0]),
      keywords: ["pdf", "export"],
    },
    {
      id: "alerts",
      label: "Go to Alerts",
      icon: <Bell className="h-4 w-4" />,
      shortcut: "G A",
      action: () => router.push("/alerts" as Parameters<typeof router.push>[0]),
      keywords: ["notifications", "warnings"],
    },
    {
      id: "settings",
      label: "Go to Settings",
      icon: <Settings className="h-4 w-4" />,
      shortcut: "G S",
      action: () => router.push("/settings" as Parameters<typeof router.push>[0]),
      keywords: ["preferences", "config"],
    },
  ];

  const quickActions: CommandAction[] = [
    {
      id: "new-report",
      label: "Generate New Report",
      icon: <Zap className="h-4 w-4" />,
      action: () => router.push("/reports/new" as Parameters<typeof router.push>[0]),
      keywords: ["create", "pdf"],
    },
    {
      id: "run-audit",
      label: "Run Site Audit",
      icon: <Search className="h-4 w-4" />,
      action: () => {
        // Open audit modal or navigate
      },
      keywords: ["crawl", "technical", "seo"],
    },
    {
      id: "keyboard-shortcuts",
      label: "Keyboard Shortcuts",
      icon: <Keyboard className="h-4 w-4" />,
      shortcut: "?",
      action: () => {
        onOpenShortcuts?.();
      },
      keywords: ["help", "keys", "hotkeys"],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search clients, actions, or type a command..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Clients */}
            {clients.length > 0 && (
              <Command.Group heading="Clients">
                {clients.slice(0, 5).map((client) => (
                  <Command.Item
                    key={client.clientId}
                    value={client.clientName}
                    onSelect={() =>
                      handleSelect(() =>
                        router.push(`/clients/${client.clientId}` as Parameters<typeof router.push>[0])
                      )
                    }
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{client.clientName}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Health: {client.healthScore}%
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation">
              {navigationActions.map((action) => (
                <Command.Item
                  key={action.id}
                  value={`${action.label} ${action.keywords?.join(" ") ?? ""}`}
                  onSelect={() => handleSelect(action.action)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {action.icon}
                  <span>{action.label}</span>
                  {action.shortcut && (
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {action.shortcut}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions">
              {quickActions.map((action) => (
                <Command.Item
                  key={action.id}
                  value={`${action.label} ${action.keywords?.join(" ") ?? ""}`}
                  onSelect={() => handleSelect(action.action)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {action.icon}
                  <span>{action.label}</span>
                  {action.shortcut && (
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {action.shortcut}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>
              <span>Close</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
