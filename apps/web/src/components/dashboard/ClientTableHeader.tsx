"use client";

import React from "react";
import { TableHead, TableHeader, TableRow, Checkbox } from "@tevero/ui";
import { ArrowUpDown } from "lucide-react";
import type { ClientSortKey } from "@/lib/dashboard/types";

// ---------------------------------------------------------------------------
// SortButton
// ---------------------------------------------------------------------------

interface SortButtonProps {
  column: ClientSortKey;
  sortKey: ClientSortKey;
  onSort: (column: ClientSortKey) => void;
  children: React.ReactNode;
}

export const SortButton: React.FC<SortButtonProps> = ({
  column,
  sortKey,
  onSort,
  children,
}) => (
  <button
    onClick={() => onSort(column)}
    className="flex items-center gap-1 hover:text-foreground transition-colors"
  >
    {children}
    <ArrowUpDown
      className={`h-3 w-3 ${sortKey === column ? "text-foreground" : "text-muted-foreground"}`}
    />
  </button>
);

// ---------------------------------------------------------------------------
// ClientTableHeader
// ---------------------------------------------------------------------------

export interface ClientTableHeaderProps {
  sortKey: ClientSortKey;
  onSort: (column: ClientSortKey) => void;
  enableSelection?: boolean;
  selectAllProps?: {
    checked: boolean;
    indeterminate: boolean;
    onChange: (checked: boolean) => void;
  };
}

export const ClientTableHeader: React.FC<ClientTableHeaderProps> = ({
  sortKey,
  onSort,
  enableSelection = false,
  selectAllProps,
}) => {
  return (
    <TableHeader>
      <TableRow>
        {enableSelection && selectAllProps && (
          <TableHead className="w-[50px]">
            <Checkbox
              checked={
                selectAllProps.indeterminate
                  ? "indeterminate"
                  : selectAllProps.checked
              }
              onCheckedChange={selectAllProps.onChange}
              aria-label="Select all"
            />
          </TableHead>
        )}
        <TableHead className="w-[200px]">
          <SortButton column="clientName" sortKey={sortKey} onSort={onSort}>
            Client
          </SortButton>
        </TableHead>
        <TableHead className="w-[100px]">
          <SortButton column="healthScore" sortKey={sortKey} onSort={onSort}>
            Health
          </SortButton>
        </TableHead>
        <TableHead className="text-right">
          <SortButton column="trafficCurrent" sortKey={sortKey} onSort={onSort}>
            Traffic (30d)
          </SortButton>
        </TableHead>
        <TableHead className="text-right">
          <SortButton column="trafficTrendPct" sortKey={sortKey} onSort={onSort}>
            Trend
          </SortButton>
        </TableHead>
        <TableHead className="text-right">
          <SortButton column="keywordsTotal" sortKey={sortKey} onSort={onSort}>
            Keywords
          </SortButton>
        </TableHead>
        <TableHead className="w-[150px]">Positions</TableHead>
        <TableHead className="text-right">
          <SortButton column="alertsOpen" sortKey={sortKey} onSort={onSort}>
            Alerts
          </SortButton>
        </TableHead>
        <TableHead className="w-[50px]"></TableHead>
      </TableRow>
    </TableHeader>
  );
};
