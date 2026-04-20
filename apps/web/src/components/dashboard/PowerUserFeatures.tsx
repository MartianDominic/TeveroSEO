"use client";

/**
 * Power user features wrapper component.
 * Combines CommandPalette and KeyboardShortcutsDialog with coordinated state.
 *
 * Phase 24: Power User Features
 */

import { useState, useCallback } from "react";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import type { ClientMetrics } from "@/lib/dashboard/types";

interface PowerUserFeaturesProps {
  /** List of clients for command palette search */
  clients?: ClientMetrics[];
}

export function PowerUserFeatures({ clients = [] }: PowerUserFeaturesProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleOpenShortcuts = useCallback(() => {
    setShortcutsOpen(true);
  }, []);

  return (
    <>
      <CommandPalette clients={clients} onOpenShortcuts={handleOpenShortcuts} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </>
  );
}
