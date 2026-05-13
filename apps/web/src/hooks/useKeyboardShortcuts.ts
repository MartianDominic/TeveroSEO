'use client';

/**
 * useKeyboardShortcuts Hook
 * Phase 98-10: Claude Code-style keyboard shortcuts
 *
 * Provides:
 * - Mod+Enter: Submit message
 * - Escape: Stop generation
 * - Mod+K: Focus input
 * - Mod+Shift+C: Clear conversation
 * - Mod+L: Copy proposal link
 * - /: Start command (when not in input)
 */

import { useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutConfig {
  /** Action identifier */
  action: string;
  /** Human-readable description */
  description: string;
}

export type ShortcutHandlers = Partial<{
  submit: () => void;
  stop: () => void;
  focusInput: () => void;
  clear: () => void;
  copyLink: () => void;
  startCommand: () => void;
}>;

// ---------------------------------------------------------------------------
// Shortcut Definitions
// ---------------------------------------------------------------------------

export const SHORTCUTS: Record<string, ShortcutConfig> = {
  'mod+enter': { action: 'submit', description: 'Send message' },
  'escape': { action: 'stop', description: 'Stop generation' },
  'mod+k': { action: 'focusInput', description: 'Focus input' },
  'mod+shift+c': { action: 'clear', description: 'Clear conversation' },
  'mod+l': { action: 'copyLink', description: 'Copy proposal link' },
  '/': { action: 'startCommand', description: 'Start command' },
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Keyboard shortcuts hook for SEO Chat.
 *
 * @param handlers - Map of action names to handler functions
 * @param enabled - Whether shortcuts are active (default true)
 */
export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  enabled: boolean = true
): void {
  // Store handlers in ref to avoid recreating event listener
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const h = handlersRef.current;
    const mod = e.metaKey || e.ctrlKey;
    const shift = e.shiftKey;
    const target = e.target as HTMLElement;
    const isInInput =
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.isContentEditable;

    // Mod+Enter: Submit
    if (e.key === 'Enter' && mod && !shift && h.submit) {
      // Let the textarea handle this natively via form.requestSubmit()
      // Only trigger if not in an input (for global submit)
      if (!isInInput) {
        e.preventDefault();
        h.submit();
      }
      return;
    }

    // Escape: Stop generation
    if (e.key === 'Escape' && h.stop) {
      // Don't prevent default - let other handlers (command dropdown) handle first
      h.stop();
      return;
    }

    // Mod+K: Focus input
    if (e.key === 'k' && mod && !shift && h.focusInput) {
      e.preventDefault();
      h.focusInput();
      return;
    }

    // Mod+Shift+C: Clear conversation
    if (e.key === 'c' && mod && shift && h.clear) {
      e.preventDefault();
      h.clear();
      return;
    }

    // Mod+L: Copy proposal link
    if (e.key === 'l' && mod && !shift && h.copyLink) {
      e.preventDefault();
      h.copyLink();
      return;
    }

    // /: Start command mode (when not in input)
    if (e.key === '/' && !mod && !shift && !isInInput && h.startCommand) {
      e.preventDefault();
      h.startCommand();
      return;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

// ---------------------------------------------------------------------------
// Platform Detection
// ---------------------------------------------------------------------------

/**
 * Get modifier key symbol for current platform.
 */
export function getModifierSymbol(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
}

/**
 * Format shortcut for display.
 */
export function formatShortcut(shortcut: string): string {
  const mod = getModifierSymbol();
  return shortcut
    .replace('mod', mod)
    .replace('+', '')
    .replace('shift', '⇧')
    .replace('enter', '↵')
    .replace('escape', 'Esc');
}

/**
 * Get all shortcuts with formatted display keys.
 */
export function getFormattedShortcuts(): Array<{
  key: string;
  display: string;
  description: string;
}> {
  return Object.entries(SHORTCUTS).map(([key, config]) => ({
    key,
    display: formatShortcut(key),
    description: config.description,
  }));
}
