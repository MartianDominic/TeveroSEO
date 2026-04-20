/**
 * Hook for managing row selection in tables.
 * Supports single select, multi-select with Ctrl/Cmd, and range select with Shift.
 *
 * Phase 24: Power User Features
 */

import { useCallback, useState } from "react";

export interface RowSelectionOptions<T> {
  /** All items in the table */
  items: T[];
  /** Function to get unique ID from an item */
  getItemId: (item: T) => string;
  /** Maximum number of items that can be selected (default: unlimited) */
  maxSelection?: number;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export interface RowSelectionReturn {
  /** Set of currently selected item IDs */
  selectedIds: Set<string>;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Whether some (but not all) items are selected */
  isIndeterminate: boolean;
  /** Number of selected items */
  selectedCount: number;
  /** Check if a specific item is selected */
  isSelected: (id: string) => boolean;
  /** Toggle selection of a single item */
  toggle: (id: string) => void;
  /** Handle click with modifier keys (Shift for range, Ctrl/Cmd for multi) */
  handleClick: (id: string, event: React.MouseEvent) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Select specific items by ID */
  selectItems: (ids: string[]) => void;
  /** Props to spread on checkbox for "select all" */
  selectAllProps: {
    checked: boolean;
    indeterminate: boolean;
    onChange: () => void;
  };
  /** Get props for a row checkbox */
  getRowCheckboxProps: (id: string) => {
    checked: boolean;
    onChange: () => void;
  };
}

export function useRowSelection<T>({
  items,
  getItemId,
  maxSelection,
  onSelectionChange,
}: RowSelectionOptions<T>): RowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const itemIds = items.map(getItemId);
  const selectedCount = selectedIds.size;
  const isAllSelected = selectedCount > 0 && selectedCount === items.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < items.length;

  const updateSelection = useCallback(
    (newSelection: Set<string>) => {
      setSelectedIds(newSelection);
      onSelectionChange?.(newSelection);
    },
    [onSelectionChange]
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback(
    (id: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        if (maxSelection && newSelection.size >= maxSelection) {
          return;
        }
        newSelection.add(id);
      }
      updateSelection(newSelection);
      setLastSelectedId(id);
    },
    [selectedIds, maxSelection, updateSelection]
  );

  const handleClick = useCallback(
    (id: string, event: React.MouseEvent) => {
      if (event.shiftKey && lastSelectedId) {
        const lastIndex = itemIds.indexOf(lastSelectedId);
        const currentIndex = itemIds.indexOf(id);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = itemIds.slice(start, end + 1);

          const newSelection = new Set(selectedIds);
          for (const rangeId of rangeIds) {
            if (maxSelection && newSelection.size >= maxSelection) {
              break;
            }
            newSelection.add(rangeId);
          }
          updateSelection(newSelection);
          return;
        }
      }

      if (event.metaKey || event.ctrlKey) {
        toggle(id);
        return;
      }

      const newSelection = new Set<string>();
      if (!selectedIds.has(id)) {
        newSelection.add(id);
      }
      updateSelection(newSelection);
      setLastSelectedId(id);
    },
    [itemIds, lastSelectedId, selectedIds, maxSelection, toggle, updateSelection]
  );

  const selectAll = useCallback(() => {
    const allIds = maxSelection ? itemIds.slice(0, maxSelection) : itemIds;
    updateSelection(new Set(allIds));
  }, [itemIds, maxSelection, updateSelection]);

  const clearSelection = useCallback(() => {
    updateSelection(new Set());
    setLastSelectedId(null);
  }, [updateSelection]);

  const selectItems = useCallback(
    (ids: string[]) => {
      const validIds = ids.filter((id) => itemIds.includes(id));
      const limitedIds = maxSelection
        ? validIds.slice(0, maxSelection)
        : validIds;
      updateSelection(new Set(limitedIds));
    },
    [itemIds, maxSelection, updateSelection]
  );

  const selectAllProps = {
    checked: isAllSelected,
    indeterminate: isIndeterminate,
    onChange: () => {
      if (isAllSelected || isIndeterminate) {
        clearSelection();
      } else {
        selectAll();
      }
    },
  };

  const getRowCheckboxProps = useCallback(
    (id: string) => ({
      checked: selectedIds.has(id),
      onChange: () => toggle(id),
    }),
    [selectedIds, toggle]
  );

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    selectedCount,
    isSelected,
    toggle,
    handleClick,
    selectAll,
    clearSelection,
    selectItems,
    selectAllProps,
    getRowCheckboxProps,
  };
}
