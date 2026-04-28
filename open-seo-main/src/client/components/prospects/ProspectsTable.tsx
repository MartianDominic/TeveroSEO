/**
 * Prospects table with row selection for bulk actions.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Uses TanStack Table v8 for headless table with row selection.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Badge } from "@/client/components/ui/badge";
import type { ProspectSelect, PipelineStage } from "@/db/prospect-schema";

interface ProspectsTableProps {
  prospects: ProspectSelect[];
  onSelectionChange: (selectedIds: string[]) => void;
  onProspectClick?: (prospect: ProspectSelect) => void;
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  new: "bg-slate-100 text-slate-700",
  analyzing: "bg-blue-100 text-blue-700",
  scored: "bg-purple-100 text-purple-700",
  qualified: "bg-green-100 text-green-700",
  contacted: "bg-amber-100 text-amber-700",
  negotiating: "bg-orange-100 text-orange-700",
  converted: "bg-emerald-100 text-emerald-700",
  archived: "bg-gray-100 text-gray-500",
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  new: "Naujas",
  analyzing: "Analizuojama",
  scored: "Ivertintas",
  qualified: "Kvalifikuotas",
  contacted: "Susisiekta",
  negotiating: "Derybos",
  converted: "Konvertuotas",
  archived: "Archyvuotas",
};

/**
 * IndeterminateCheckbox - handles the three-state checkbox for header
 * Radix Checkbox doesn't have indeterminate prop, so we use a ref callback.
 */
function IndeterminateCheckbox({
  indeterminate,
  checked,
  onChange,
}: {
  indeterminate: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ref.current) {
      // Cast to HTMLInputElement for indeterminate property
      (ref.current as unknown as HTMLInputElement).indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  return (
    <Checkbox
      ref={ref}
      checked={checked}
      onCheckedChange={onChange}
      aria-label="Select all"
    />
  );
}

export function ProspectsTable({
  prospects,
  onSelectionChange,
  onProspectClick,
}: ProspectsTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  // Notify parent of selection changes
  useEffect(() => {
    const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    onSelectionChange(selectedIds);
  }, [rowSelection, onSelectionChange]);

  const columns = useMemo<ColumnDef<ProspectSelect>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <IndeterminateCheckbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={(value) => table.toggleAllRowsSelected(!!value)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "domain",
        header: "Domain",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.domain}</span>
        ),
      },
      {
        accessorKey: "companyName",
        header: "Company",
        cell: ({ row }) => row.original.companyName || "-",
      },
      {
        accessorKey: "pipelineStage",
        header: "Stage",
        cell: ({ row }) => {
          const stage = row.original.pipelineStage as PipelineStage;
          return (
            <Badge className={STAGE_COLORS[stage]} variant="secondary">
              {STAGE_LABELS[stage] || stage}
            </Badge>
          );
        },
      },
      {
        accessorKey: "priorityScore",
        header: "Score",
        cell: ({ row }) => {
          const score = row.original.priorityScore;
          if (score === null) return "-";
          return (
            <span
              className={`font-medium ${
                score >= 70
                  ? "text-green-600"
                  : score >= 40
                    ? "text-amber-600"
                    : "text-gray-500"
              }`}
            >
              {score.toFixed(0)}
            </span>
          );
        },
      },
      {
        accessorKey: "contactEmail",
        header: "Contact",
        cell: ({ row }) => row.original.contactEmail || "-",
      },
      {
        accessorKey: "createdAt",
        header: "Added",
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return date.toLocaleDateString("lt-LT");
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: prospects,
    columns,
    state: {
      rowSelection,
      sorting,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No prospects found
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="cursor-pointer hover:bg-muted/50"
                onClick={(e) => {
                  // Don't trigger click when clicking checkbox
                  if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                  onProspectClick?.(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
