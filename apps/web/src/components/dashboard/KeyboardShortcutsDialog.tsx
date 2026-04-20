"use client";

/**
 * Keyboard shortcuts help dialog.
 * Opens with "?" key. Shows available keyboard shortcuts for power users.
 *
 * Phase 24: Power User Features
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@tevero/ui";
import { Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { key: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "j / Down", description: "Move to next row" },
      { key: "k / Up", description: "Move to previous row" },
      { key: "Home", description: "Go to first row" },
      { key: "End", description: "Go to last row" },
      { key: "Enter", description: "Open selected client" },
      { key: "Space", description: "Toggle row selection" },
      { key: "Esc", description: "Clear selection" },
    ],
  },
  {
    title: "Quick Actions",
    shortcuts: [
      { key: "Cmd+K / Ctrl+K", description: "Open command palette" },
      { key: "/", description: "Focus search input" },
      { key: "?", description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Command Palette",
    shortcuts: [
      { key: "G D", description: "Go to Dashboard" },
      { key: "G C", description: "Go to Clients" },
      { key: "G R", description: "Go to Reports" },
      { key: "G A", description: "Go to Alerts" },
      { key: "G S", description: "Go to Settings" },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open: controlledOpen,
  onOpenChange,
}: KeyboardShortcutsDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        if (isControlled) {
          onOpenChange?.(!open);
        } else {
          setInternalOpen((prev) => !prev);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isControlled, onOpenChange, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t text-center text-xs text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">?</kbd> anytime to toggle this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
}
