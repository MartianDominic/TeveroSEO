/**
 * KeywordGapTable component
 * Phase 28: Keyword Gap Analysis UI
 *
 * Displays keyword gaps in a sortable table with:
 * - Columns: Keyword, Competitor, Position, Volume, CPC, Difficulty, Opportunity Score
 * - Sortable by all columns (default: Opportunity desc)
 * - DifficultyBadge for visual difficulty indicator
 * - Add to targets action (placeholder)
 */
import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { Button } from "@/client/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";
import { DifficultyBadge } from "./DifficultyBadge";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import type { KeywordGap } from "@/db/prospect-schema";

/**
 * Props for SortableHeader component
 */
interface SortableHeaderProps {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  children: React.ReactNode;
}

/**
 * Sortable table header cell component.
 * Extracted to module level to avoid recreation on every render.
 */
function SortableHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
  children,
}: SortableHeaderProps) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column &&
          (sortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </div>
    </TableHead>
  );
}

// Row height for virtualization (in pixels)
const ROW_HEIGHT = 52;
// Number of rows to render outside the visible area
const OVERSCAN = 5;

// Sortable columns
export type SortColumn =
  | "keyword"
  | "competitorDomain"
  | "competitorPosition"
  | "searchVolume"
  | "cpc"
  | "difficulty"
  | "trafficPotential";

export type SortDirection = "asc" | "desc";

/**
 * Summary statistics for keyword gaps
 */
export interface GapSummary {
  totalGaps: number;
  avgOpportunity: number;
  totalVolume: number;
  avgDifficulty: number;
  uniqueCompetitors: number;
}

/**
 * Sorts keyword gaps by specified column and direction.
 * Returns a new array (immutable).
 */
export function sortKeywordGaps(
  gaps: KeywordGap[],
  column: SortColumn,
  direction: SortDirection
): KeywordGap[] {
  if (gaps.length === 0) return [];

  const sorted = [...gaps];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (column) {
      case "keyword":
      case "competitorDomain":
        comparison = a[column].localeCompare(b[column]);
        break;
      case "competitorPosition":
      case "searchVolume":
      case "cpc":
      case "difficulty":
      case "trafficPotential":
        comparison = a[column] - b[column];
        break;
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Calculates summary statistics for keyword gaps
 */
export function calculateGapSummary(gaps: KeywordGap[]): GapSummary {
  if (gaps.length === 0) {
    return {
      totalGaps: 0,
      avgOpportunity: 0,
      totalVolume: 0,
      avgDifficulty: 0,
      uniqueCompetitors: 0,
    };
  }

  const totalOpportunity = gaps.reduce((sum, g) => sum + g.trafficPotential, 0);
  const totalVolume = gaps.reduce((sum, g) => sum + g.searchVolume, 0);
  const totalDifficulty = gaps.reduce((sum, g) => sum + g.difficulty, 0);
  const uniqueCompetitors = new Set(gaps.map((g) => g.competitorDomain)).size;

  return {
    totalGaps: gaps.length,
    avgOpportunity: totalOpportunity / gaps.length,
    totalVolume,
    avgDifficulty: Math.round(totalDifficulty / gaps.length),
    uniqueCompetitors,
  };
}

interface KeywordGapTableProps {
  gaps: KeywordGap[];
  onAddTarget?: (keyword: string) => void;
  /** Pre-filtered gaps from parent (if parent handles filtering) */
  filteredGaps?: KeywordGap[];
}

/**
 * Renders a sortable table of keyword gaps
 */
export function KeywordGapTable({ gaps, onAddTarget, filteredGaps }: KeywordGapTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("trafficPotential");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Use filteredGaps if provided, otherwise use all gaps
  const dataToSort = filteredGaps ?? gaps;

  const sortedGaps = useMemo(
    () => sortKeywordGaps(dataToSort, sortColumn, sortDirection),
    [dataToSort, sortColumn, sortDirection]
  );

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (gaps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No keyword gaps found.
      </div>
    );
  }

  // Show filtered message if filters applied but no results
  if (sortedGaps.length === 0 && gaps.length > 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No keyword gaps match the current filters.
      </div>
    );
  }

  // Ref for the scrollable container
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up virtualizer for large datasets
  const rowVirtualizer = useVirtualizer({
    count: sortedGaps.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="keyword" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Keyword</SortableHeader>
            <SortableHeader column="competitorDomain" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Competitor</SortableHeader>
            <SortableHeader column="competitorPosition" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Position</SortableHeader>
            <SortableHeader column="searchVolume" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Volume</SortableHeader>
            <SortableHeader column="cpc" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>CPC</SortableHeader>
            <SortableHeader column="difficulty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Difficulty</SortableHeader>
            <SortableHeader column="trafficPotential" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
              Opportunity
            </SortableHeader>
            <TableHead className="w-[60px]">Action</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      {/* Virtualized scrollable container */}
      <div
        ref={parentRef}
        className="max-h-[600px] overflow-auto"
        style={{ contain: "strict" }}
      >
        <Table>
          <TableBody>
            {/* Spacer for total virtual height */}
            <tr style={{ height: totalSize }}>
              <td style={{ padding: 0, border: 0 }} />
            </tr>
          </TableBody>
        </Table>
        {/* Positioned rows */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
          }}
        >
          <Table>
            <TableBody>
              {virtualRows.map((virtualRow) => {
                const gap = sortedGaps[virtualRow.index];
                return (
                  <TableRow
                    key={`${gap.keyword}-${gap.competitorDomain}-${virtualRow.index}`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TableCell className="font-medium">{gap.keyword}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {gap.competitorDomain}
                    </TableCell>
                    <TableCell>{gap.competitorPosition}</TableCell>
                    <TableCell>{gap.searchVolume.toLocaleString()}</TableCell>
                    <TableCell>${gap.cpc.toFixed(2)}</TableCell>
                    <TableCell>
                      <DifficultyBadge difficulty={gap.difficulty} />
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {gap.trafficPotential.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            onClick={() => onAddTarget?.(gap.keyword)}
                            aria-label="Add to targets"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Coming soon</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}
