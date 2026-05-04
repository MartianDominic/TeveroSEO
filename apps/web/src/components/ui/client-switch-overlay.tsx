"use client";

/**
 * Client Switch Loading Overlay
 *
 * HIGH-UX-01: Shows a full-screen loading overlay when switching between clients.
 * Prevents user interaction during the transition and provides visual feedback.
 *
 * Features:
 * - Full-screen backdrop with blur effect
 * - Centered spinner with "Switching client..." message
 * - High z-index to cover all content
 * - Smooth fade transition via CSS
 */

import { Loader2 } from "lucide-react";
import { useClientStore } from "@/stores/clientStore";

export function ClientSwitchOverlay() {
  const isSwitching = useClientStore((state) => state.isSwitching);

  if (!isSwitching) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Switching client"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">
          Switching client...
        </span>
      </div>
    </div>
  );
}
