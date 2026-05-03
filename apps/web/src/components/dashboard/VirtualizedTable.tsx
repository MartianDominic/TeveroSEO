"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

/**
 * Column definition for VirtualizedTable.
 * Supports both simple accessors and custom render functions.
 */
export interface VirtualizedColumnDef<TData> {
  id: string;
  header: ReactNode;
  width?: number | string;
  cell: (row: TData, index: number) => ReactNode;
  className?: string;
}

interface VirtualizedTableProps<TData> {
  /** Row data array */
  data: TData[];
  /** Column definitions */
  columns: VirtualizedColumnDef<TData>[];
  /** Height of each row in pixels */
  rowHeight?: number;
  /** Number of rows to render outside visible area */
  overscan?: number;
  /** Maximum height of the table container */
  maxHeight?: string;
  /** Unique key extractor for each row */
  getRowKey: (row: TData, index: number) => string;
  /** Optional click handler for rows */
  onRowClick?: (row: TData, index: number) => void;
  /** Optional selected row key */
  selectedRowKey?: string;
  /** Empty state content */
  emptyContent?: ReactNode;
  /** Currently focused row index for keyboard navigation */
  focusedIndex?: number;
  /** Callback when focused index changes via keyboard */
  onFocusedIndexChange?: (index: number) => void;
  /** Props to spread on the table container for keyboard navigation */
  tableProps?: {
    tabIndex?: number;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    "aria-activedescendant"?: string;
  };
  /** Accessible label for the table */
  ariaLabel?: string;
}

export function VirtualizedTable<TData>({
  data,
  columns,
  rowHeight = 64,
  overscan = 10,
  maxHeight = "calc(100vh - 300px)",
  getRowKey,
  onRowClick,
  selectedRowKey,
  emptyContent,
  focusedIndex = -1,
  onFocusedIndexChange,
  tableProps,
  ariaLabel,
}: VirtualizedTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Call any passed-in handler first
      tableProps?.onKeyDown?.(e);

      if (!onFocusedIndexChange || data.length === 0) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          newIndex = focusedIndex < data.length - 1 ? focusedIndex + 1 : focusedIndex;
          break;
        case "ArrowUp":
          e.preventDefault();
          newIndex = focusedIndex > 0 ? focusedIndex - 1 : 0;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = data.length - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < data.length && onRowClick) {
            onRowClick(data[focusedIndex]!, focusedIndex);
          }
          return;
        default:
          return;
      }

      if (newIndex !== focusedIndex) {
        onFocusedIndexChange(newIndex);
      }
    },
    [data, focusedIndex, onFocusedIndexChange, onRowClick, tableProps]
  );

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  // Empty state
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead className="bg-background border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                {emptyContent ?? "No data"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={data.length}
      aria-activedescendant={focusedIndex >= 0 ? `table-row-${focusedIndex}` : undefined}
      tabIndex={tableProps?.tabIndex ?? 0}
      onKeyDown={handleKeyDown}
      className="overflow-auto relative rounded-lg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse" role="presentation">
        <thead className="sticky top-0 z-10 bg-background border-b">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = data[virtualRow.index]!;
            const rowKey = getRowKey(row, virtualRow.index);
            const isSelected = selectedRowKey === rowKey;
            const isFocused = virtualRow.index === focusedIndex;

            return (
              <tr
                key={rowKey}
                id={`table-row-${virtualRow.index}`}
                role="row"
                aria-rowindex={virtualRow.index + 1}
                data-index={virtualRow.index}
                data-focused={isFocused}
                onClick={onRowClick ? () => onRowClick(row, virtualRow.index) : undefined}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  isSelected && "bg-muted",
                  isFocused && "ring-2 ring-primary ring-inset bg-primary/5",
                  onRowClick && "cursor-pointer"
                )}
                style={{ height: `${rowHeight}px` }}
                tabIndex={isFocused ? 0 : -1}
                aria-selected={isSelected}
              >
                {columns.map((col) => (
                  <td key={col.id} role="gridcell" className={cn("px-4 py-2", col.className)}>
                    {col.cell(row, virtualRow.index)}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
