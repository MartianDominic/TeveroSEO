"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarListView } from "./calendar-list-view";
import type {
  CalendarArticle,
  CalendarViewMode,
  ArticleStatus,
} from "./types";

// ---------------------------------------------------------------------------
// ViewModeSelector
// ---------------------------------------------------------------------------

interface ViewModeSelectorProps {
  mode: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}

function ViewModeSelector({ mode, onChange }: ViewModeSelectorProps) {
  const modes: { value: CalendarViewMode; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "list", label: "List" },
  ];

  return (
    <div
      className={cn(
        "inline-flex",
        "p-0.5",
        "rounded-lg",
        "bg-surface-3",
        "border border-hairline-2"
      )}
    >
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={cn(
            "px-3 py-1.5",
            "rounded-md",
            "text-[13px] font-medium",
            "transition-all duration-[160ms]",
            mode === m.value
              ? "bg-surface text-text-1 shadow-[var(--shadow-card)]"
              : "text-text-3 hover:text-text-2"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentCalendar
// ---------------------------------------------------------------------------

export interface ContentCalendarProps {
  /** Articles to display */
  articles: CalendarArticle[];
  /** Initial view mode */
  defaultViewMode?: CalendarViewMode;
  /** Controlled view mode */
  viewMode?: CalendarViewMode;
  /** View mode change handler */
  onViewModeChange?: (mode: CalendarViewMode) => void;
  /** Initial date */
  defaultDate?: Date;
  /** Controlled date */
  date?: Date;
  /** Date change handler */
  onDateChange?: (date: Date) => void;
  /** Article click handler */
  onArticleClick?: (article: CalendarArticle) => void;
  /** Day click handler */
  onDayClick?: (date: Date) => void;
  /** Add article handler */
  onAddClick?: (date: Date) => void;
  /** Article reschedule handler */
  onReschedule?: (articleId: string, newDate: Date) => void;
  /** Status filter */
  statusFilter?: ArticleStatus[];
  /** Status filter change handler */
  onStatusFilterChange?: (statuses: ArticleStatus[]) => void;
  /** Search query */
  searchQuery?: string;
  /** Additional class names */
  className?: string;
}

/**
 * ContentCalendar is the main calendar component that orchestrates
 * the three view modes (Month, Week, List).
 *
 * Features:
 * - View mode switching (Month/Week/List)
 * - Navigation (prev/next, today)
 * - Article filtering by status
 * - Search support
 * - Responsive design
 *
 * @example
 * <ContentCalendar
 *   articles={articles}
 *   defaultViewMode="week"
 *   onArticleClick={(article) => openEditor(article.id)}
 *   onAddClick={(date) => createArticle(date)}
 * />
 */
export function ContentCalendar({
  articles,
  defaultViewMode = "week",
  viewMode: controlledViewMode,
  onViewModeChange,
  defaultDate,
  date: controlledDate,
  onDateChange,
  onArticleClick,
  onDayClick,
  onAddClick,
  onReschedule,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  className,
}: ContentCalendarProps) {
  // View mode state (controlled or uncontrolled)
  const [internalViewMode, setInternalViewMode] =
    React.useState<CalendarViewMode>(defaultViewMode);
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = React.useCallback(
    (mode: CalendarViewMode) => {
      setInternalViewMode(mode);
      onViewModeChange?.(mode);
    },
    [onViewModeChange]
  );

  // Date state (controlled or uncontrolled)
  const [internalDate, setInternalDate] = React.useState<Date>(
    defaultDate ?? new Date()
  );
  const currentDate = controlledDate ?? internalDate;
  const setCurrentDate = React.useCallback(
    (date: Date) => {
      setInternalDate(date);
      onDateChange?.(date);
    },
    [onDateChange]
  );

  // Sort order for list view
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  // Navigation handlers
  const navigateMonth = React.useCallback(
    (delta: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCurrentDate(newDate);
    },
    [currentDate, setCurrentDate]
  );

  const navigateWeek = React.useCallback(
    (delta: number) => {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + delta * 7);
      setCurrentDate(newDate);
    },
    [currentDate, setCurrentDate]
  );

  const goToToday = React.useCallback(() => {
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  // Handle day click in month view
  const handleDayClick = React.useCallback(
    (date: Date) => {
      onDayClick?.(date);
      // Optionally switch to week view for the clicked day
      setCurrentDate(date);
    },
    [onDayClick, setCurrentDate]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* View mode selector */}
        <ViewModeSelector mode={viewMode} onChange={setViewMode} />

        {/* Today button (not shown in list view which has its own nav) */}
        {viewMode !== "list" && (
          <button
            type="button"
            onClick={goToToday}
            className={cn(
              "px-4 py-2",
              "rounded-lg",
              "text-[14px] font-medium",
              "bg-surface",
              "border border-hairline",
              "text-text-2 hover:text-text-1",
              "hover:border-hairline-2",
              "shadow-[var(--shadow-card)]",
              "transition-all duration-[160ms]",
              "hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]",
              "focus:outline-none focus:ring-2 focus:ring-accent"
            )}
          >
            Today
          </button>
        )}
      </div>

      {/* Calendar views */}
      {viewMode === "month" && (
        <CalendarMonthView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          articles={articles}
          onDayClick={handleDayClick}
          onArticleClick={onArticleClick}
          onPrevMonth={() => navigateMonth(-1)}
          onNextMonth={() => navigateMonth(1)}
        />
      )}

      {viewMode === "week" && (
        <CalendarWeekView
          date={currentDate}
          articles={articles}
          onArticleClick={onArticleClick}
          onAddClick={onAddClick}
          onPrevWeek={() => navigateWeek(-1)}
          onNextWeek={() => navigateWeek(1)}
          onToday={goToToday}
        />
      )}

      {viewMode === "list" && (
        <CalendarListView
          articles={articles}
          onArticleClick={onArticleClick}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onFilterChange={onStatusFilterChange}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { CalendarMonthView } from "./calendar-month-view";
export type { CalendarMonthViewProps } from "./calendar-month-view";

export { CalendarWeekView } from "./calendar-week-view";
export type { CalendarWeekViewProps } from "./calendar-week-view";

export { CalendarListView } from "./calendar-list-view";
export type { CalendarListViewProps } from "./calendar-list-view";

export { ArticleCard, ArticleCardCompact, ArticleCardMini } from "./article-card";
export type { ArticleCardProps, ArticleCardCompactProps, ArticleCardMiniProps } from "./article-card";

export { ArticleStatusBadge } from "./article-status-badge";
export type { ArticleStatusBadgeProps } from "./article-status-badge";

export { PipelineProgress, PipelineProgressInline } from "./pipeline-progress";
export type { PipelineProgressProps, PipelineProgressInlineProps } from "./pipeline-progress";

export * from "./types";
