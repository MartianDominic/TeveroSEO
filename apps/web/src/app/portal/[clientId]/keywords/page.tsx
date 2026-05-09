"use client";

/**
 * Portal Keywords Page
 *
 * Full keyword rankings table with filtering, sorting, and pagination.
 * Per D-02: Shows asterisk indicators for estimated volume data.
 */

import * as React from "react";

import { useParams, useSearchParams } from "next/navigation";

import { Download, FileSpreadsheet } from "lucide-react";

import { KeywordTable } from "@/components/portal/KeywordTable";
import { useKeywords } from "@/lib/portal/hooks";
import type { KeywordFilter, KeywordSort, SortOrder } from "@/lib/portal/types";
import { cn } from "@/lib/utils";



export default function PortalKeywordsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;

  // Token from query param or cookie
  const token = searchParams.get("token") || "";

  // Filter and sort state
  const [filter, setFilter] = React.useState<KeywordFilter>("all");
  const [sortBy, setSortBy] = React.useState<KeywordSort>("position");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");
  const [offset, setOffset] = React.useState(0);
  const limit = 25;

  // Fetch keywords with current filters
  const { data, isLoading, error, refetch } = useKeywords(clientId, token, {
    filter,
    sort: sortBy,
    order: sortOrder,
    limit,
    offset,
  });

  // Handle filter change - reset pagination
  const handleFilterChange = (newFilter: KeywordFilter) => {
    setFilter(newFilter);
    setOffset(0);
  };

  // Handle sort change - toggle order if same column
  const handleSortChange = (column: KeywordSort) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setOffset(0);
  };

  // Handle pagination
  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  // Export placeholder handlers (UI only, functionality later)
  const handleExportCSV = () => {
    // TODO: Implement CSV export
    alert("CSV export coming soon");
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    alert("PDF export coming soon");
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[clamp(24px,2vw,32px)] font-medium text-text-1 tracking-[-0.02em]">
            Keywords
          </h1>
          <p className="text-[13px] text-text-3 mt-1">
            Track your keyword rankings and performance
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              "text-[13px] text-text-2 bg-surface rounded-[--radius-button]",
              "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03)]",
              "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_2px_4px_rgba(20,20,26,0.04)]",
              "transition-all duration-150"
            )}
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              "text-[13px] text-text-2 bg-surface rounded-[--radius-button]",
              "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03)]",
              "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_2px_4px_rgba(20,20,26,0.04)]",
              "transition-all duration-150"
            )}
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Error state */}
      {error !== null && error !== undefined && (
        <div className="p-4 bg-error-soft rounded-[--radius-card] border border-error/20">
          <p className="text-[14px] text-error">
            Failed to load keywords. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-[13px] text-error underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Keywords table */}
      <KeywordTable
        keywords={data?.keywords || []}
        summary={data?.summary}
        filter={filter}
        onFilterChange={handleFilterChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        pagination={data?.pagination}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </div>
  );
}
