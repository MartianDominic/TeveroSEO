"use client";

/**
 * GlobalCommandPalette - Phase 101-03
 *
 * Global command palette (Cmd+K) with context-aware command groups.
 * Per D-03: Shows different commands based on current view.
 */
import * as React from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  Dialog,
  DialogContent,
  cn,
} from "@tevero/ui";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import {
  getCommandGroups,
  type CommandItem as CommandItemType,
} from "./command-groups";

interface GlobalCommandPaletteProps {
  /** Callback when quick capture is triggered */
  onQuickCapture?: () => void;
  /** Callback when new deal (full form) is triggered */
  onNewDeal?: () => void;
  /** Callback when record payment is triggered */
  onRecordPayment?: () => void;
}

/**
 * Global command palette component.
 *
 * Renders a Cmd+K accessible command palette with context-aware groups.
 * Must be mounted at the root layout level.
 */
export function GlobalCommandPalette({
  onQuickCapture,
  onNewDeal,
  onRecordPayment,
}: GlobalCommandPaletteProps) {
  const { isOpen, close, view, selectedDealStage } = useCommandPalette();
  const [search, setSearch] = React.useState("");

  const commandGroups = React.useMemo(
    () => getCommandGroups(view, selectedDealStage),
    [view, selectedDealStage]
  );

  // Handle keyboard shortcuts globally
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // But still allow Cmd+K in inputs
        if (!((e.metaKey || e.ctrlKey) && e.key === "k")) {
          return;
        }
      }

      // Cmd+K to open/close
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useCommandPalette.getState().toggle();
      }

      // Cmd+N for new deal (when palette is closed)
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && !isOpen) {
        e.preventDefault();
        onNewDeal?.();
      }

      // Cmd+Shift+N for quick capture
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        onQuickCapture?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onNewDeal, onQuickCapture]);

  const handleSelect = (action: string) => {
    close();
    setSearch("");

    // Handle navigation actions
    // Per STATE.md 66-09: window.location for navigation (avoids Next.js typed routes)
    if (action.startsWith("navigate:")) {
      const path = action.replace("navigate:", "");
      window.location.href = path;
      return;
    }

    // Handle specific actions
    switch (action) {
      case "new-deal":
        onNewDeal?.();
        break;
      case "quick-capture":
        onQuickCapture?.();
        break;
      case "record-payment":
        onRecordPayment?.();
        break;
      case "search":
        // Could open a dedicated search modal
        break;
      default:
        // Log unhandled actions for debugging
        if (process.env.NODE_ENV === "development") {
          console.log("Unhandled command action:", action);
        }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0 shadow-lg",
          "top-[20%] translate-y-0", // Position at top 20% per UI-SPEC
          "max-w-[540px] rounded-lg border bg-popover"
        )}
      >
        <Command
          className={cn(
            "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium",
            "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs",
            "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide"
          )}
        >
          <CommandInput
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
            className="h-12"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No results found.</CommandEmpty>
            {commandGroups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                    onSelect={() => handleSelect(item.action)}
                    className="flex items-center gap-2 px-2 py-1.5"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <CommandShortcut className="ml-auto">
                        {formatShortcut(item.shortcut)}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Format keyboard shortcut for display.
 * Shows platform-appropriate symbols (Cmd on Mac, Ctrl elsewhere).
 */
function formatShortcut(shortcut: string): string {
  // Detect Mac platform
  const isMac =
    typeof window !== "undefined" && navigator.platform.includes("Mac");

  return shortcut
    .replace("Shift+", isMac ? "⇧" : "Shift+")
    .replace(/([A-Z])$/, (match) => match);
}
