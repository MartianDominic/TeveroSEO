"use client";

import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// KeyboardShortcutHintProps
// ---------------------------------------------------------------------------

export interface KeyboardShortcutHintProps {
  /** Array of keys to display (e.g., ['Cmd', 'K']) */
  keys: string[];
  /** Visual variant */
  variant?: "default" | "inverted";
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Key symbol mapping
// ---------------------------------------------------------------------------

const KEY_SYMBOLS: Record<string, string> = {
  cmd: "⌘",
  command: "⌘",
  ctrl: "⌃",
  control: "⌃",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
  enter: "↵",
  return: "↵",
  backspace: "⌫",
  delete: "⌦",
  escape: "⎋",
  esc: "⎋",
  tab: "⇥",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  space: "␣",
};

/**
 * Convert a key name to its display symbol or formatted string.
 */
function formatKey(key: string): string {
  const lowerKey = key.toLowerCase();
  return KEY_SYMBOLS[lowerKey] ?? key.toUpperCase();
}

// ---------------------------------------------------------------------------
// KeyboardShortcutHint
// ---------------------------------------------------------------------------

/**
 * KeyboardShortcutHint displays keyboard shortcuts with styled kbd elements.
 *
 * Features:
 * - Maps common key names to symbols (Cmd -> ⌘)
 * - Default variant with bg-surface-2 and hairline border
 * - Inverted variant for dark backgrounds
 * - Two sizes: sm (12px) and md (13px)
 *
 * @example
 * <KeyboardShortcutHint keys={['Cmd', 'K']} />
 * <KeyboardShortcutHint keys={['Ctrl', 'Shift', 'P']} variant="inverted" />
 */
export function KeyboardShortcutHint({
  keys,
  variant = "default",
  size = "md",
  className,
}: KeyboardShortcutHintProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className={cn(
            // Base styles
            "inline-flex items-center justify-center",
            "font-mono",
            "[font-variant-numeric:tabular-nums]",
            "rounded",
            // Size variants
            size === "sm" && "px-1 py-0.5 text-[11px] min-w-[18px]",
            size === "md" && "px-1.5 py-0.5 text-[12px] min-w-[20px]",
            // Variant styles
            variant === "default" && [
              "bg-surface-2",
              "text-text-2",
              "shadow-[inset_0_-1px_0_0_var(--hairline),0_0_0_1px_var(--hairline)]",
            ],
            variant === "inverted" && [
              "bg-[rgba(255,255,255,0.14)]",
              "text-[rgba(255,255,255,0.85)]",
              "shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.1)]",
            ]
          )}
        >
          {formatKey(key)}
        </kbd>
      ))}
    </span>
  );
}

KeyboardShortcutHint.displayName = "KeyboardShortcutHint";
