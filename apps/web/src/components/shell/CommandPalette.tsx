"use client";

/**
 * CommandPalette - Quick navigation and actions
 *
 * Phase 65: UX Fix - HIGH-43 (added context indicator showing current scope)
 */

import React, { useEffect, useMemo } from "react";

import { useRouter } from "next/navigation";

import {
  Building2,
  Check,
  LayoutDashboard,
  Calendar,
  Brain,
  Settings,
  BarChart3,
  Plus,
  Globe,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useClientStore } from "@/stores";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
} from "@tevero/ui";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavLink {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (clientId: string) => string;
}

const NAV_LINKS: NavLink[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: (id) => `/clients/${id}`,
  },
  {
    label: "Calendar",
    icon: Calendar,
    href: (id) => `/clients/${id}/calendar`,
  },
  {
    label: "Intelligence",
    icon: Brain,
    href: (id) => `/clients/${id}/intelligence`,
  },
  {
    label: "Settings",
    icon: Settings,
    href: (id) => `/clients/${id}/settings`,
  },
  {
    label: "Analytics",
    icon: BarChart3,
    href: (id) => `/clients/${id}/analytics`,
  },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { clients, activeClientId, setActiveClient } = useClientStore();

  // Get active client name for context indicator
  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId),
    [clients, activeClientId]
  );

  // Belt-and-suspenders Escape guard (Radix Dialog already handles this)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleClientSelect = (clientId: string) => {
    setActiveClient(clientId);
    router.push(
      `/clients/${clientId}` as Parameters<typeof router.push>[0]
    );
    router.refresh();
    onClose();
  };

  const handleNavSelect = (href: string) => {
    router.push(href as Parameters<typeof router.push>[0]);
    onClose();
  };

  const handleAddClient = () => {
    router.push("/clients" as Parameters<typeof router.push>[0]);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-lg w-full rounded-xl border border-border bg-popover p-0 shadow-xl"
        )}
      >
        <Command className="rounded-xl">
          {/* Context indicator - shows current scope (HIGH-43 fix) */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
            {activeClient ? (
              <>
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {activeClient.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  - Client scope
                </span>
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  No client selected - Global scope
                </span>
              </>
            )}
          </div>
          <CommandInput placeholder="Search commands..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>

            {/* Clients group */}
            <CommandGroup heading="Clients">
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => handleClientSelect(client.id)}
                >
                  <Building2 className="mr-2 h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{client.name}</span>
                  {activeClientId === client.id && (
                    <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Navigation group - with disabled state explanation (HIGH-44 fix) */}
            <CommandGroup heading={activeClientId ? "Navigation" : "Navigation (select a client first)"}>
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const disabled = !activeClientId;
                const href = activeClientId ? link.href(activeClientId) : "#";
                return (
                  <CommandItem
                    key={link.label}
                    value={link.label}
                    disabled={disabled}
                    aria-disabled={disabled ? "true" : undefined}
                    className={cn(
                      disabled && "opacity-40 cursor-not-allowed"
                    )}
                    onSelect={() => {
                      if (!disabled) handleNavSelect(href);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="flex-1">{link.label}</span>
                    {disabled && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Select client
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* Actions group */}
            <CommandGroup heading="Actions">
              <CommandItem
                value="Add new client"
                onSelect={handleAddClient}
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                <span>Add new client</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
