"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Globe, ChevronDown, Check, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
// HIGH-12-02 FIX: Migrate from Zustand to TanStack Query hooks for improved caching
import { useClients, useActiveClient, useSetActiveClient } from "@/hooks/use-clients";
import { useClientStore } from "@/stores";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tevero/ui";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a stable HSL color from a string (client name -> avatar circle) */
function seedColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function clientInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// ClientSwitcherPopoverContent
// ---------------------------------------------------------------------------

interface PopoverBodyProps {
  clients: Array<{ id: string; name: string }>;
  activeClientId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}

const ClientSwitcherPopoverContent: React.FC<PopoverBodyProps> = ({
  clients,
  activeClientId,
  onSelect,
  onAddNew,
}) => (
  <Command>
    <CommandInput placeholder="Search clients..." className="h-9" />
    <CommandList>
      <CommandEmpty>No clients found.</CommandEmpty>
      <CommandGroup>
        {clients.map((client) => (
          <CommandItem
            key={client.id}
            value={client.name}
            onSelect={() => onSelect(client.id)}
            className="flex items-center gap-2"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: seedColor(client.name) }}
            >
              {clientInitial(client.name)}
            </span>
            <span className="flex-1 truncate">{client.name}</span>
            {client.id === activeClientId && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup>
        <CommandItem
          onSelect={onAddNew}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add new client</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);

// ---------------------------------------------------------------------------
// ClientSwitcherButton
// ---------------------------------------------------------------------------

export interface ClientSwitcherButtonProps {
  collapsed: boolean;
}

export const ClientSwitcherButton: React.FC<ClientSwitcherButtonProps> = ({
  collapsed,
}) => {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  // HIGH-12-02 FIX: Use TanStack Query hooks for improved caching and automatic refetching
  const { data: clients = [], isLoading } = useClients();
  const activeClient = useActiveClient();
  const setActiveClient = useSetActiveClient();
  const activeClientId = useClientStore((state) => state.activeClientId);

  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // No useEffect needed - TanStack Query handles data fetching automatically

  if (!isSignedIn) return null;

  const handleSelect = async (clientId: string) => {
    // Validate client exists before navigation
    const clientExists = clients.some((c) => c.id === clientId);
    if (!clientExists) {
      // Client may have been deleted - TanStack Query will refetch automatically
      return;
    }
    setIsSwitching(true);
    setOpen(false);
    // HIGH-12-02 FIX: Use TanStack Query mutation which handles cache invalidation
    await setActiveClient(clientId);
    router.push(`/clients/${clientId}` as Parameters<typeof router.push>[0]);
    router.refresh();
    // Clear loading state after navigation starts (short delay for UX)
    setTimeout(() => setIsSwitching(false), 500);
  };

  const handleAddNew = () => {
    setOpen(false);
    router.push("/clients" as Parameters<typeof router.push>[0]);
  };

  const name = activeClient?.name ?? "";
  const triggerLabel = name || "Select client";

  // Collapsed: just the colored initial circle
  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            title={triggerLabel}
            disabled={isSwitching}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white",
              "transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSwitching && "opacity-70"
            )}
            style={name ? { backgroundColor: seedColor(name) } : undefined}
          >
            {isSwitching ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : name ? (
              clientInitial(name)
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          side="right"
          sideOffset={8}
        >
          <ClientSwitcherPopoverContent
            clients={clients}
            activeClientId={activeClientId}
            isLoading={isLoading}
            onSelect={handleSelect}
            onAddNew={handleAddNew}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded: full-width button with circle + name + chevron
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isSwitching}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
            "hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isSwitching && "opacity-70"
          )}
        >
          {/* Colored initial circle or loading spinner */}
          {isSwitching ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </span>
          ) : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
              style={
                name
                  ? { backgroundColor: seedColor(name) }
                  : { backgroundColor: "hsl(var(--muted))" }
              }
            >
              {name ? clientInitial(name) : "?"}
            </span>
          )}

          {/* Name */}
          <span className="flex-1 truncate text-left">
            {isSwitching ? "Switching..." : isLoading ? "Loading..." : triggerLabel}
          </span>

          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="right"
        sideOffset={8}
      >
        <ClientSwitcherPopoverContent
          clients={clients}
          activeClientId={activeClientId}
          isLoading={isLoading}
          onSelect={handleSelect}
          onAddNew={handleAddNew}
        />
      </PopoverContent>
    </Popover>
  );
};

export { seedColor, clientInitial };
