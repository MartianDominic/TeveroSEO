import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { EmptyTableState } from "./BacklinksPageEmptyTableState";
import { backlinksColumns } from "./BacklinksTableColumns";
import type { BacklinksOverviewData } from "./backlinksPageTypes";
import { groupBacklinksByDomain } from "./backlinksPageUtils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";

export function BacklinksTable({
  rows,
}: {
  rows: BacklinksOverviewData["backlinks"];
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "firstSeen", desc: true },
  ]);

  const groupedData = useMemo(() => groupBacklinksByDomain(rows), [rows]);

  const table = useReactTable({
    data: groupedData,
    columns: backlinksColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.depth === 0,
  });

  if (rows.length === 0) {
    return <EmptyTableState label="No backlinks match this filter." />;
  }

  return (
    <div className="overflow-x-auto">
      <Table style={{ tableLayout: "fixed" }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={
                row.depth === 0
                  ? "cursor-pointer bg-muted/50 transition-colors hover:bg-muted/80"
                  : "bg-background"
              }
              onClick={
                row.depth === 0 ? row.getToggleExpandedHandler() : undefined
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
