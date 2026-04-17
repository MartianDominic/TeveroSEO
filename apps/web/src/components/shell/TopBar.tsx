"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  className?: string;
  onOpen?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ className, onOpen }) => {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-border bg-background px-6",
        className
      )}
    >
      {/* Left: spacer (logo lives in sidebar) */}
      <div className="w-[60px]" />

      {/* Center: ⌘K search trigger */}
      <button
        className={cn(
          "flex items-center gap-2 rounded-md border border-border",
          "px-3 py-1.5 text-xs text-muted-foreground bg-muted/50",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Open command palette"
        data-command-palette-trigger
        onClick={() => onOpen?.()}
      >
        <span>Search...</span>
        <kbd className="pointer-events-none hidden select-none rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {/* Right: empty — UserButton moved to sidebar bottom */}
      <div className="w-[60px]" />
    </header>
  );
};
