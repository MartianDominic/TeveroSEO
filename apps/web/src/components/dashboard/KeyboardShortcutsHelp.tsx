"use client";

/**
 * Keyboard shortcuts help dialog.
 * Opens with ? key. Shows all available keyboard shortcuts.
 *
 * Phase 24: Power User Features
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@tevero/ui";
import { Keyboard } from "lucide-react";

interface ShortcutCategory {
  name: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    name: "Navigation",
    shortcuts: [
      { keys: "j / ↓", description: "Move down" },
      { keys: "k / ↑", description: "Move up" },
      { keys: "Enter", description: "Open selected item" },
      { keys: "Space", description: "Toggle selection" },
      { keys: "Home", description: "Go to first row" },
      { keys: "End", description: "Go to last row" },
      { keys: "Esc", description: "Clear selection / Close dialog" },
    ],
  },
  {
    name: "Global",
    shortcuts: [
      { keys: "⌘K / Ctrl+K", description: "Open command palette" },
      { keys: "/", description: "Focus search" },
      { keys: "?", description: "Show this help" },
    ],
  },
  {
    name: "Quick Actions (Command Palette)",
    shortcuts: [
      { keys: "G D", description: "Go to Dashboard" },
      { keys: "G C", description: "Go to Clients" },
      { keys: "G R", description: "Go to Reports" },
      { keys: "G A", description: "Go to Alerts" },
      { keys: "G S", description: "Go to Settings" },
    ],
  },
];

interface KeyboardShortcutsHelpProps {
  /** Externally controlled open state */
  isOpen?: boolean;
  /** Callback when dialog should close */
  onClose?: () => void;
}

export function KeyboardShortcutsHelp({ isOpen: externalOpen, onClose }: KeyboardShortcutsHelpProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external state if provided, otherwise internal
  const open = externalOpen !== undefined ? externalOpen : internalOpen;

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (externalOpen !== undefined) {
      if (!newOpen && onClose) {
        onClose();
      }
    } else {
      setInternalOpen(newOpen);
    }
  }, [externalOpen, onClose]);

  // Listen for ? key to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or if command palette is open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Check for ? key (Shift + /)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleOpenChange(true);
      }
    };

    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-medium text-foreground mb-3">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map(({ keys, description }) => (
                  <div
                    key={keys}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-muted-foreground">
                      {description}
                    </span>
                    <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 mt-4">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
