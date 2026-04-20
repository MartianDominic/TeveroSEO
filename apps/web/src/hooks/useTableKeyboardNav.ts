/**
 * Hook for keyboard navigation in tables.
 * Supports j/k for row navigation, Enter for selection, / for search focus.
 *
 * Phase 24: Power User Features
 */

import { useCallback, useEffect, useState } from "react";

export interface TableKeyboardNavOptions {
  /** Total number of rows */
  rowCount: number;
  /** Callback when Enter is pressed on a row */
  onSelect?: (index: number) => void;
  /** Callback when Space is pressed on a row */
  onToggle?: (index: number) => void;
  /** Ref to search input for / key focus */
  searchInputRef?: React.RefObject<HTMLInputElement>;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

export interface TableKeyboardNavReturn {
  /** Currently focused row index (-1 if none) */
  focusedIndex: number;
  /** Set focused row programmatically */
  setFocusedIndex: (index: number) => void;
  /** Props to spread on the table container */
  tableProps: {
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent) => void;
    "aria-activedescendant": string | undefined;
  };
  /** Get props for a specific row */
  getRowProps: (index: number) => {
    id: string;
    "aria-selected": boolean;
    "data-focused": boolean;
    onClick: () => void;
  };
}

export function useTableKeyboardNav({
  rowCount,
  onSelect,
  onToggle,
  searchInputRef,
  enabled = true,
}: TableKeyboardNavOptions): TableKeyboardNavReturn {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, rowCount - 1));
          break;

        case "k":
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case "Enter":
          if (focusedIndex >= 0) {
            e.preventDefault();
            onSelect?.(focusedIndex);
          }
          break;

        case " ":
          if (focusedIndex >= 0) {
            e.preventDefault();
            onToggle?.(focusedIndex);
          }
          break;

        case "/":
          if (searchInputRef?.current) {
            e.preventDefault();
            searchInputRef.current.focus();
          }
          break;

        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case "End":
          e.preventDefault();
          setFocusedIndex(rowCount - 1);
          break;

        case "Escape":
          setFocusedIndex(-1);
          break;
      }
    },
    [enabled, focusedIndex, rowCount, onSelect, onToggle, searchInputRef]
  );

  // Reset focus when row count changes
  useEffect(() => {
    if (focusedIndex >= rowCount) {
      setFocusedIndex(rowCount - 1);
    }
  }, [focusedIndex, rowCount]);

  const getRowProps = useCallback(
    (index: number) => ({
      id: `table-row-${index}`,
      "aria-selected": focusedIndex === index,
      "data-focused": focusedIndex === index,
      onClick: () => setFocusedIndex(index),
    }),
    [focusedIndex]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    tableProps: {
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      "aria-activedescendant":
        focusedIndex >= 0 ? `table-row-${focusedIndex}` : undefined,
    },
    getRowProps,
  };
}
