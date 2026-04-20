"use client";

import { useRef, type ReactNode } from "react";
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
}: VirtualizedTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);

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
      className="overflow-auto relative rounded-lg border border-border"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse">
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

            return (
              <tr
                key={rowKey}
                data-index={virtualRow.index}
                onClick={onRowClick ? () => onRowClick(row, virtualRow.index) : undefined}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  isSelected && "bg-muted",
                  onRowClick && "cursor-pointer"
                )}
                style={{ height: `${rowHeight}px` }}
              >
                {columns.map((col) => (
                  <td key={col.id} className={cn("px-4 py-2", col.className)}>
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
