"use client";

/**
 * KeywordTable Component
 *
 * Sortable, filterable keyword rankings table with pagination.
 * V6 design: CSS Grid layout, hover states, Geist Mono for positions.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "./DeltaBadge";
import { TrustIndicator, EstimatedDataFootnote } from "./TrustIndicator";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  KeywordData,
  KeywordFilter,
  KeywordSort,
  SortOrder,
  KeywordsSummary,
} from "@/lib/portal/types";

export interface KeywordTableProps {
  /** Keywords data to display */
  keywords: KeywordData[];
  /** Summary counts for filter badges */
  summary?: KeywordsSummary;
  /** Current filter */
  filter: KeywordFilter;
  /** Filter change handler */
  onFilterChange: (filter: KeywordFilter) => void;
  /** Current sort column */
  sortBy: KeywordSort;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Sort change handler */
  onSortChange: (column: KeywordSort) => void;
  /** Pagination */
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** Page change handler */
  onPageChange?: (offset: number) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const filters: { value: KeywordFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "top10", label: "Top 10" },
  { value: "improving", label: "Improving" },
  { value: "declining", label: "Declining" },
];

const columns: { key: KeywordSort | "keyword" | "volume"; label: string; sortable: boolean }[] = [
  { key: "keyword", label: "Keyword", sortable: false },
  { key: "position", label: "Position", sortable: true },
  { key: "change", label: "Change", sortable: true },
  { key: "clicks", label: "Clicks", sortable: true },
  { key: "impressions", label: "Impr.", sortable: true },
  { key: "volume", label: "Volume", sortable: false },
];

export function KeywordTable({
  keywords,
  summary,
  filter,
  onFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  pagination,
  onPageChange,
  isLoading,
  className,
}: KeywordTableProps) {
  const hasEstimatedData = keywords.some((kw) => kw.isEstimated);

  const handleSort = (column: string) => {
    if (column === "keyword" || column === "volume") return;
    onSortChange(column as KeywordSort);
  };

  const getSortIcon = (column: string) => {
    if (column === "keyword" || column === "volume") return null;
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-text-4" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-accent" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-accent" />
    );
  };

  return (
    <div
      className={cn(
        "bg-surface rounded-[--radius-card]",
        "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]",
        className
      )}
    >
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-4 p-5 border-b border-hairline-2">
        <h3 className="font-sans font-medium text-[15px] text-text-1">
          Keyword Rankings
        </h3>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-[--radius-button] text-[13px] font-medium",
                "transition-colors duration-150",
                filter === f.value
                  ? "bg-accent-soft text-accent-ink"
                  : "bg-transparent text-text-2 hover:bg-surface-2"
              )}
            >
              {f.label}
              {summary && f.value !== "all" && (
                <span
                  className={cn(
                    "ml-1.5 px-1.5 py-0.5 rounded-[--radius-pill] text-[11px]",
                    filter === f.value
                      ? "bg-accent/10 text-accent"
                      : "bg-surface-2 text-text-3"
                  )}
                >
                  {f.value === "top10" && summary.top10}
                  {f.value === "improving" && summary.improving}
                  {f.value === "declining" && summary.declining}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div
        className="grid gap-4 px-5 py-3 text-[12px] font-medium text-text-3 uppercase tracking-[0.08em] border-b border-hairline-3"
        style={{
          gridTemplateColumns: "2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr",
        }}
      >
        {columns.map((col) => (
          <button
            key={col.key}
            className={cn(
              "flex items-center gap-1.5 text-left",
              col.sortable && "hover:text-text-2 cursor-pointer",
              !col.sortable && "cursor-default"
            )}
            onClick={() => handleSort(col.key)}
            disabled={!col.sortable}
          >
            <span>{col.label}</span>
            {col.sortable && getSortIcon(col.key)}
          </button>
        ))}
      </div>

      {/* Table rows */}
      <div className="divide-y divide-hairline-3">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-4 px-5 py-4"
              style={{
                gridTemplateColumns: "2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr",
              }}
            >
              <div className="h-5 bg-surface-3 rounded skeleton" />
              <div className="h-5 bg-surface-3 rounded skeleton" />
              <div className="h-5 bg-surface-3 rounded skeleton" />
              <div className="h-5 bg-surface-3 rounded skeleton" />
              <div className="h-5 bg-surface-3 rounded skeleton" />
              <div className="h-5 bg-surface-3 rounded skeleton" />
            </div>
          ))
        ) : keywords.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-3 text-[14px]">
            No keywords found
          </div>
        ) : (
          keywords.map((kw, idx) => (
            <div
              key={kw.keyword}
              className={cn(
                "grid gap-4 px-5 py-3.5 transition-colors duration-150",
                "hover:bg-surface-2 cursor-pointer group"
              )}
              style={{
                gridTemplateColumns: "2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr",
              }}
            >
              {/* Keyword */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[14px] text-text-1 font-medium truncate">
                  {kw.keyword}
                </span>
              </div>

              {/* Position */}
              <div className="flex items-center">
                <span className="font-mono text-[14px] text-text-1 tabular-nums">
                  {kw.position}
                </span>
              </div>

              {/* Change */}
              <div className="flex items-center">
                {kw.change !== 0 ? (
                  <DeltaBadge value={-kw.change} inverted size="sm" />
                ) : (
                  <span className="text-[13px] text-text-3">-</span>
                )}
              </div>

              {/* Clicks */}
              <div className="flex items-center">
                <span className="font-mono text-[14px] text-text-2 tabular-nums">
                  {kw.clicks.toLocaleString()}
                </span>
              </div>

              {/* Impressions */}
              <div className="flex items-center">
                <span className="font-mono text-[14px] text-text-2 tabular-nums">
                  {kw.impressions.toLocaleString()}
                </span>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-1">
                {kw.volume !== null ? (
                  <>
                    <span className="font-mono text-[14px] text-text-2 tabular-nums">
                      {kw.volume.toLocaleString()}
                    </span>
                    {kw.isEstimated && (
                      <TrustIndicator level="estimated" showLabel={false} />
                    )}
                  </>
                ) : (
                  <span className="text-[13px] text-text-4">-</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && onPageChange && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-hairline-2">
          <span className="text-[13px] text-text-3">
            Showing {pagination.offset + 1}-
            {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0}
              className={cn(
                "p-1.5 rounded-[--radius-button]",
                "hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <ChevronLeft className="h-4 w-4 text-text-2" />
            </button>
            <button
              onClick={() => onPageChange(pagination.offset + pagination.limit)}
              disabled={!pagination.hasMore}
              className={cn(
                "p-1.5 rounded-[--radius-button]",
                "hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <ChevronRight className="h-4 w-4 text-text-2" />
            </button>
          </div>
        </div>
      )}

      {/* Estimated data footnote */}
      {hasEstimatedData && (
        <div className="px-5 py-3 border-t border-hairline-3 bg-surface-2/50">
          <EstimatedDataFootnote />
        </div>
      )}
    </div>
  );
}
