import * as React from "react";

/**
 * Keyboard Navigation Patterns
 *
 * Defines consistent keyboard navigation patterns for interactive components
 * following WAI-ARIA best practices.
 *
 * Usage per component type:
 * | Component       | Pattern |
 * |-----------------|---------|
 * | CommandPalette  | LISTBOX |
 * | CardActionMenu  | MENU    |
 * | Tabs            | TABS    |
 * | Modal/Dialog    | DIALOG  |
 */

/**
 * Keyboard action types that handlers can respond to
 */
export type KeyboardAction =
  | "next"
  | "previous"
  | "select"
  | "close"
  | "first"
  | "last"
  | "expand"
  | "collapse"
  | "cycle";

/**
 * Keyboard patterns for different component types
 * Maps key names to semantic actions
 */
export const KeyboardPatterns = {
  /**
   * LISTBOX pattern - for autocomplete, command palette, select menus
   * Arrow keys navigate, Enter/Space select, Escape closes
   */
  LISTBOX: {
    ArrowDown: "next",
    ArrowUp: "previous",
    Enter: "select",
    " ": "select", // Space key
    Escape: "close",
    Home: "first",
    End: "last",
  },

  /**
   * MENU pattern - for dropdown menus with submenus
   * Arrow keys navigate, left/right expand/collapse, Enter selects
   */
  MENU: {
    ArrowDown: "next",
    ArrowUp: "previous",
    ArrowRight: "expand",
    ArrowLeft: "collapse",
    Enter: "select",
    Escape: "close",
  },

  /**
   * TABS pattern - for tab navigation
   * Left/Right (or Up/Down for vertical) navigate between tabs
   */
  TABS: {
    ArrowLeft: "previous",
    ArrowRight: "next",
    Home: "first",
    End: "last",
  },

  /**
   * DIALOG pattern - for modals and dialogs
   * Escape closes, Tab cycles within the dialog
   */
  DIALOG: {
    Escape: "close",
    Tab: "cycle",
  },
} as const;

/**
 * Type for the pattern names
 */
export type KeyboardPatternName = keyof typeof KeyboardPatterns;

/**
 * Hook for keyboard navigation
 *
 * Returns a keyboard event handler that maps key presses to actions
 * based on the specified pattern.
 *
 * @param pattern - The keyboard pattern to use (LISTBOX, MENU, TABS, DIALOG)
 * @param handlers - Object mapping actions to handler functions
 * @returns A keyboard event handler to attach to your component
 *
 * @example
 * ```tsx
 * const handleKeyDown = useKeyboardNavigation('LISTBOX', {
 *   next: () => setSelectedIndex(i => i + 1),
 *   previous: () => setSelectedIndex(i => i - 1),
 *   select: () => onSelect(items[selectedIndex]),
 *   close: () => setOpen(false),
 * });
 *
 * return <div onKeyDown={handleKeyDown}>...</div>;
 * ```
 */
export function useKeyboardNavigation<T extends KeyboardPatternName>(
  pattern: T,
  handlers: Partial<Record<KeyboardAction, () => void>>
): React.KeyboardEventHandler {
  return React.useCallback(
    (event: React.KeyboardEvent) => {
      const patternMap = KeyboardPatterns[pattern];
      const action = patternMap[event.key as keyof typeof patternMap] as
        | KeyboardAction
        | undefined;

      if (action && handlers[action]) {
        event.preventDefault();
        event.stopPropagation();
        handlers[action]!();
      }
    },
    [pattern, handlers]
  );
}

/**
 * Get the action for a key press in a given pattern
 *
 * Useful for one-off key handling without the hook
 *
 * @param pattern - The keyboard pattern to use
 * @param key - The key that was pressed
 * @returns The action name or undefined if not mapped
 */
export function getKeyboardAction<T extends KeyboardPatternName>(
  pattern: T,
  key: string
): KeyboardAction | undefined {
  const patternMap = KeyboardPatterns[pattern];
  return patternMap[key as keyof typeof patternMap] as KeyboardAction | undefined;
}
