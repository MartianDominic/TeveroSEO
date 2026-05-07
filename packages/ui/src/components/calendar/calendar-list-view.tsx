"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { ArticleCard } from "./article-card";
import {
  groupArticlesByDate,
  getRelativeDayLabel,
  formatTime,
} from "./calendar-utils";
import type { CalendarArticle, ArticleStatus } from "./types";

// ---------------------------------------------------------------------------
// DayGroup
// ---------------------------------------------------------------------------

interface DayGroupProps {
  dateKey: string;
  articles: CalendarArticle[];
  onArticleClick?: (article: CalendarArticle) => void;
}

function DayGroup({ dateKey, articles, onArticleClick }: DayGroupProps) {
  const date = new Date(dateKey);
  const label = getRelativeDayLabel(date);
  const isToday = label === "Today";
  const isOverdue = dateKey === "overdue";

  // Sort articles by time
  const sortedArticles = React.useMemo(
    () =>
      [...articles].sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
      ),
    [articles]
  );

  return (
    <div className="py-4">
      {/* Day divider */}
      <div
        className={cn(
          "flex items-center gap-3 mb-4",
          isOverdue && "text-error"
        )}
      >
        <span
          className={cn(
            "text-[12px] font-medium uppercase tracking-[0.1em]",
            "[font-variant-caps:all-small-caps]",
            isToday ? "text-accent" : isOverdue ? "text-error" : "text-text-3"
          )}
        >
          {isOverdue ? "Overdue" : label}
        </span>

        {/* Divider line */}
        <div
          className={cn("flex-1 h-px", isOverdue ? "bg-error/30" : "bg-hairline-2")}
        />

        {/* Count */}
        <span
          className={cn(
            "text-[12px] font-mono tabular-nums",
            isOverdue ? "text-error" : "text-text-3"
          )}
        >
          {articles.length}
        </span>
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {sortedArticles.map((article) => (
          <div
            key={article.id}
            className="flex gap-3 group"
          >
            {/* Time column */}
            <span
              className={cn(
                "w-[44px] shrink-0 pt-4",
                "font-mono text-[12px] tabular-nums",
                "text-text-3"
              )}
            >
              {formatTime(article.scheduledAt)}
            </span>

            {/* Article card */}
            <div className="flex-1 min-w-0">
              <ArticleCard
                article={article}
                onClick={() => onArticleClick?.(article)}
                showDetails
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarListView
// ---------------------------------------------------------------------------

export interface CalendarListViewProps {
  /** Articles to display */
  articles: CalendarArticle[];
  /** Article click handler */
  onArticleClick?: (article: CalendarArticle) => void;
  /** Filter by status */
  statusFilter?: ArticleStatus[];
  /** Search query */
  searchQuery?: string;
  /** Sort order */
  sortOrder?: "asc" | "desc";
  /** On sort change */
  onSortChange?: (order: "asc" | "desc") => void;
  /** On filter change */
  onFilterChange?: (statuses: ArticleStatus[]) => void;
  /** Additional class names */
  className?: string;
}

/**
 * CalendarListView displays a Superhuman-style list with day groupings.
 *
 * Features:
 * - Articles grouped by date (Today, Tomorrow, etc.)
 * - Overdue section at top
 * - Time column (mono, 44px fixed width)
 * - Full article cards with pipeline progress
 * - Filters and search
 *
 * @example
 * <CalendarListView
 *   articles={articles}
 *   onArticleClick={(article) => openEditor(article.id)}
 *   statusFilter={["draft", "scheduled"]}
 * />
 */
export function CalendarListView({
  articles,
  onArticleClick,
  statusFilter,
  searchQuery,
  sortOrder = "asc",
  onSortChange,
  onFilterChange,
  className,
}: CalendarListViewProps) {
  // Filter articles
  const filteredArticles = React.useMemo(() => {
    let result = [...articles];

    // Status filter
    if (statusFilter && statusFilter.length > 0) {
      result = result.filter((a) => statusFilter.includes(a.status));
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.keyword?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [articles, statusFilter, searchQuery]);

  // Separate overdue articles
  const { overdueArticles, normalArticles } = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const overdue = filteredArticles.filter(
      (a) =>
        a.status === "overdue" ||
        (a.status === "draft" && new Date(a.scheduledAt) < now)
    );

    const normal = filteredArticles.filter(
      (a) =>
        a.status !== "overdue" &&
        !(a.status === "draft" && new Date(a.scheduledAt) < now)
    );

    return { overdueArticles: overdue, normalArticles: normal };
  }, [filteredArticles]);

  // Group normal articles by date
  const groupedArticles = React.useMemo(
    () => groupArticlesByDate(normalArticles),
    [normalArticles]
  );

  // Sort groups
  const sortedGroups = React.useMemo(() => {
    const entries = Array.from(groupedArticles.entries());
    return sortOrder === "asc"
      ? entries.sort(([a], [b]) => a.localeCompare(b))
      : entries.sort(([a], [b]) => b.localeCompare(a));
  }, [groupedArticles, sortOrder]);

  const statusOptions: { value: ArticleStatus; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "scheduled", label: "Scheduled" },
    { value: "published", label: "Published" },
    { value: "in_progress", label: "In Progress" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <div
      className={cn(
        "bg-surface",
        "rounded-[var(--radius-card)]",
        "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-hairline-2">
        <h2
          className={cn(
            "font-display text-[18px] font-medium",
            "text-text-1",
            "tracking-[-0.02em]"
          )}
        >
          Content Pipeline
        </h2>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {/* Status filter dropdown */}
          <div className="relative">
            <select
              className={cn(
                "appearance-none",
                "px-3 py-1.5 pr-8",
                "rounded-lg",
                "text-[13px]",
                "bg-surface-2",
                "border border-hairline",
                "text-text-2",
                "cursor-pointer",
                "hover:border-hairline-2",
                "focus:outline-none focus:ring-2 focus:ring-accent"
              )}
              value={statusFilter?.join(",") || ""}
              onChange={(e) => {
                const values = e.target.value
                  ? (e.target.value.split(",") as ArticleStatus[])
                  : [];
                onFilterChange?.(values);
              }}
            >
              <option value="">All Status</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-3"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </div>

          {/* Sort */}
          <button
            type="button"
            onClick={() => onSortChange?.(sortOrder === "asc" ? "desc" : "asc")}
            className={cn(
              "flex items-center gap-1.5",
              "px-3 py-1.5",
              "rounded-lg",
              "text-[13px]",
              "bg-surface-2",
              "border border-hairline",
              "text-text-2",
              "hover:border-hairline-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-accent"
            )}
          >
            Sort: Date
            <svg
              className={cn(
                "transition-transform duration-200",
                sortOrder === "desc" && "rotate-180"
              )}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-hairline-2 px-6">
        {/* Overdue section (always first) */}
        {overdueArticles.length > 0 && (
          <DayGroup
            dateKey="overdue"
            articles={overdueArticles}
            onArticleClick={onArticleClick}
          />
        )}

        {/* Regular day groups */}
        {sortedGroups.map(([dateKey, dayArticles]) => (
          <DayGroup
            key={dateKey}
            dateKey={dateKey}
            articles={dayArticles}
            onArticleClick={onArticleClick}
          />
        ))}

        {/* Empty state */}
        {filteredArticles.length === 0 && (
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-3 text-text-4"
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="6" y="10" width="36" height="32" rx="4" />
              <path d="M6 18H42" />
              <path d="M14 6V14M34 6V14" />
              <path d="M18 28L22 32L30 24" />
            </svg>
            <p className="text-[14px] text-text-2">No articles found</p>
            <p className="text-[13px] text-text-3 mt-1">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Schedule your first article to get started"}
            </p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      {filteredArticles.length > 0 && (
        <div className="flex items-center gap-4 px-6 py-3 border-t border-hairline-2 bg-surface-2">
          <span className="text-[12px] text-text-3">
            <span className="font-mono tabular-nums text-text-2">
              {filteredArticles.length}
            </span>{" "}
            articles total
          </span>
          <span className="text-text-4">|</span>
          <span className="text-[12px] text-text-3">
            <span className="font-mono tabular-nums text-success">
              {filteredArticles.filter((a) => a.status === "published").length}
            </span>{" "}
            published
          </span>
          <span className="text-text-4">|</span>
          <span className="text-[12px] text-text-3">
            <span className="font-mono tabular-nums text-info">
              {filteredArticles.filter((a) => a.status === "scheduled").length}
            </span>{" "}
            scheduled
          </span>
          {overdueArticles.length > 0 && (
            <>
              <span className="text-text-4">|</span>
              <span className="text-[12px] text-error">
                <span className="font-mono tabular-nums">
                  {overdueArticles.length}
                </span>{" "}
                overdue
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
