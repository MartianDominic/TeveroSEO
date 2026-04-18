"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, ChevronDown, Plus } from "lucide-react";
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
import { useClientStore } from "@/stores";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

/** Generate a stable HSL color from a string */
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

interface ClientSwitcherProps {
  className?: string;
}

export const ClientSwitcher: React.FC<ClientSwitcherProps> = ({
  className,
}) => {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const {
    clients,
    activeClient,
    activeClientId,
    isLoading,
    fetchClients,
    setActiveClient,
  } = useClientStore();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSignedIn && clients.length === 0) {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  if (!isSignedIn) return null;

  const handleSelect = (clientId: string) => {
    setActiveClient(clientId);
    setOpen(false);
    router.push(
      `/clients/${clientId}` as Parameters<typeof router.push>[0]
    );
    router.refresh();
  };

  const handleAddNew = () => {
    setOpen(false);
    router.push("/clients" as Parameters<typeof router.push>[0]);
  };

  const name = activeClient?.name ?? "";
  const triggerLabel = name || "Select client";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
            "hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {/* Colored initial circle */}
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={
              name
                ? { backgroundColor: seedColor(name) }
                : { backgroundColor: "hsl(var(--muted))" }
            }
          >
            {name ? (
              clientInitial(name)
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
          </span>

          {/* Name */}
          <span className="flex-1 truncate text-left">
            {isLoading ? "Loading..." : triggerLabel}
          </span>

          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Search clients..." className="h-9" />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => handleSelect(client.id)}
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
                onSelect={handleAddNew}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Add new client</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
