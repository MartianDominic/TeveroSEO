"use client";

/**
 * KeywordTable Component
 *
 * Sortable, filterable keyword rankings table with pagination.
 * V6 design: CSS Grid layout, sliding underline tabs, Newsreader serif volume,
 * semantic difficulty badges, hover-reveal queue button.
 */

import * as React from "react";

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
import { cn } from "@/lib/utils";

import { DeltaBadge } from "./DeltaBadge";
import { TrustIndicator, EstimatedDataFootnote } from "./TrustIndicator";

/**
 * Get difficulty configuration based on KD value
 * Uses semantic colors from v6 design system
 */
function getDifficultyConfig(kd: number) {
  if (kd <= 30) return { bg: "bg-success-soft", text: "text-success", label: "Easy" };
  if (kd <= 50) return { bg: "bg-surface-2", text: "text-text-2", label: "Medium" };
  if (kd <= 70) return { bg: "bg-warning-soft", text: "text-warning", label: "Hard" };
  return { bg: "bg-error-soft", text: "text-error", label: "Very Hard" };
}

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
  /** Queue button click handler */
  onQueueClick?: (keyword: KeywordData) => void;
  /** Additional CSS classes */
  className?: string;
}

const filters: { value: KeywordFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "top10", label: "Top 10" },
  { value: "improving", label: "Improving" },
  { value: "declining", label: "Declining" },
];

const columns: { key: KeywordSort | "keyword" | "volume" | "difficulty" | "queue"; label: string; sortable: boolean }[] = [
  { key: "keyword", label: "Keyword", sortable: false },
  { key: "position", label: "Position", sortable: true },
  { key: "volume", label: "Volume", sortable: false },
  { key: "difficulty", label: "KD", sortable: false },
  { key: "change", label: "Change", sortable: true },
  { key: "clicks", label: "Clicks", sortable: true },
  { key: "impressions", label: "Impr.", sortable: true },
  { key: "queue", label: "", sortable: false },
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
  onQueueClick,
  className,
}: KeywordTableProps) {
  const hasEstimatedData = keywords.some((kw) => kw.isEstimated);

  // Calculate max volume for relative bar scaling
  const maxVolume = React.useMemo(() => {
    return Math.max(...keywords.map(kw => kw.volume ?? 0), 1);
  }, [keywords]);

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
      {/* Header with title */}
      <div className="px-5 py-4 border-b border-hairline-2">
        <h3 className="font-sans font-medium text-[15px] text-text-1">
          Keyword Rankings
        </h3>
      </div>

      {/* Tab navigation with sliding underline */}
      <div className="relative flex items-center border-b border-hairline-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={cn(
              "relative px-4 py-3 text-[14px] font-medium",
              "transition-colors duration-[160ms]",
              filter === f.value
                ? "text-text-1"
                : "text-text-3 hover:text-text-2"
            )}
          >
            {f.label}
            {summary && f.value !== "all" && (
              <span
                className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-[--radius-pill] text-[12px]",
                  filter === f.value
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-2 text-text-3"
                )}
              >
                {f.value === "top10" && summary.top10}
                {f.value === "improving" && summary.improving}
                {f.value === "declining" && summary.declining}
              </span>
            )}
            {/* Sliding underline indicator */}
            {filter === f.value && (
              <span
                className="absolute left-4 right-4 bottom-[-1px] h-[2px] bg-accent rounded-t-sm"
                style={{
                  transition: "all 280ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div
        className="grid gap-4 px-5 py-3 text-[12px] font-medium text-text-3 uppercase tracking-[0.08em] border-b border-hairline-3"
        style={{
          gridTemplateColumns: "minmax(260px, 2.4fr) 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.6fr 0.6fr",
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
                gridTemplateColumns: "minmax(260px, 2.4fr) 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.6fr 0.6fr",
              }}
            >
              <div className="h-5 bg-surface-3 rounded skeleton" />
              <div className="h-5 bg-surface-3 rounded skeleton" />
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
          keywords.map((kw) => {
            const difficultyConfig = kw.difficulty !== undefined
              ? getDifficultyConfig(kw.difficulty)
              : null;

            return (
              <div
                key={kw.keyword}
                className={cn(
                  "relative grid gap-4 px-5 py-3.5 group",
                  "hover:bg-surface-2 cursor-pointer",
                  "transition-colors duration-[160ms]",
                  // Priority indicator: 2px accent left border
                  kw.isPriority && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-accent"
                )}
                style={{
                  gridTemplateColumns: "minmax(260px, 2.4fr) 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.6fr 0.6fr",
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

                {/* Volume with Newsreader serif + relative bar */}
                <div className="flex flex-col gap-1">
                  {kw.volume !== null ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="font-display text-[18px] text-text-1 tabular-nums">
                          {kw.volume.toLocaleString()}
                        </span>
                        {kw.isEstimated && (
                          <TrustIndicator level="estimated" showLabel={false} />
                        )}
                      </div>
                      {maxVolume > 0 && (
                        <div className="h-[3px] bg-surface-3 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-tint rounded-full"
                            style={{ width: `${(kw.volume / maxVolume) * 100}%` }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[13px] text-text-4">-</span>
                  )}
                </div>

                {/* Difficulty with semantic colors */}
                <div className="flex items-center">
                  {difficultyConfig ? (
                    <span
                      className={cn(
                        "px-2 py-1 rounded-md text-[14px] font-medium tabular-nums",
                        difficultyConfig.bg,
                        difficultyConfig.text
                      )}
                    >
                      {kw.difficulty}
                    </span>
                  ) : (
                    <span className="text-[13px] text-text-4">-</span>
                  )}
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

                {/* Queue button - hover-reveal pattern */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQueueClick?.(kw);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-[--radius-button] text-[13px] font-medium",
                      "transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                      kw.isQueued
                        ? "bg-accent text-white opacity-100"
                        : "bg-surface-2 text-text-2 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
                    )}
                  >
                    {kw.isQueued ? "Queued" : "Queue"}
                  </button>
                </div>
              </div>
            );
          })
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
