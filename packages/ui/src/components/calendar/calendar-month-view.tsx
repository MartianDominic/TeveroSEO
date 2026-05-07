"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { ArticleCardMini } from "./article-card";
import { ArticleStatusBadge } from "./article-status-badge";
import { getMonthDays } from "./calendar-utils";
import type { CalendarArticle, CalendarDay } from "./types";

// ---------------------------------------------------------------------------
// Day Cell
// ---------------------------------------------------------------------------

interface DayCellProps {
  day: CalendarDay;
  onDayClick?: (date: Date) => void;
  onArticleClick?: (article: CalendarArticle) => void;
  maxVisible?: number;
}

function DayCell({
  day,
  onDayClick,
  onArticleClick,
  maxVisible = 3,
}: DayCellProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const visibleArticles = day.articles.slice(0, maxVisible);
  const hiddenCount = day.articles.length - maxVisible;
  const hasContent = day.articles.length > 0;
  const isContentGap =
    !day.isPast && !day.isToday && !hasContent && day.isCurrentMonth;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDayClick?.(day.date)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDayClick?.(day.date);
        }
      }}
      className={cn(
        // Base cell styling
        "relative min-h-[100px]",
        "p-2",
        "border-b border-r border-hairline-2",
        "transition-colors duration-[160ms]",
        // Current month vs padding days
        day.isCurrentMonth ? "bg-surface" : "bg-canvas-dim",
        // Today highlight
        day.isToday && "bg-accent-soft/30",
        // Weekend styling
        day.isWeekend && day.isCurrentMonth && "bg-surface-2/50",
        // Past days (muted)
        day.isPast && !day.isToday && "opacity-60",
        // Content gap (future empty day)
        isContentGap && [
          "border-2 border-dashed border-hairline",
          "bg-canvas",
        ],
        // Hover state
        "hover:bg-surface-2 cursor-pointer",
        // Focus
        "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
      )}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "font-display tabular-nums",
            day.isToday
              ? "text-[15px] font-semibold text-accent"
              : day.isCurrentMonth
                ? "text-[14px] text-text-1"
                : "text-[14px] text-text-4"
          )}
        >
          {day.date.getDate()}
        </span>

        {/* Article count badge (when collapsed) */}
        {day.articles.length > maxVisible && !isExpanded && (
          <span
            className={cn(
              "text-[11px] font-mono tabular-nums",
              "px-1.5 py-0.5 rounded-full",
              "bg-surface-3 text-text-3"
            )}
          >
            {day.articles.length}
          </span>
        )}
      </div>

      {/* Status dots (compact view) */}
      {!isExpanded && day.articles.length > 0 && day.articles.length <= 5 && (
        <div className="flex gap-1 flex-wrap mb-1">
          {day.articles.map((article) => (
            <ArticleStatusBadge
              key={article.id}
              status={article.status}
              dotOnly
            />
          ))}
        </div>
      )}

      {/* Article list */}
      <div className="space-y-0.5">
        {visibleArticles.map((article) => (
          <ArticleCardMini
            key={article.id}
            article={article}
            onClick={() => onArticleClick?.(article)}
          />
        ))}

        {/* "+N more" indicator */}
        {hiddenCount > 0 && !isExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className={cn(
              "w-full text-left",
              "px-1.5 py-0.5",
              "text-[11px] text-text-3",
              "hover:text-accent",
              "transition-colors duration-[160ms]"
            )}
          >
            +{hiddenCount} more
          </button>
        )}
      </div>

      {/* Content gap indicator */}
      {isContentGap && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-text-4 uppercase tracking-[0.1em]">
            gap
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarMonthView
// ---------------------------------------------------------------------------

export interface CalendarMonthViewProps {
  /** Current year */
  year: number;
  /** Current month (0-indexed) */
  month: number;
  /** Articles to display */
  articles: CalendarArticle[];
  /** Day click handler */
  onDayClick?: (date: Date) => void;
  /** Article click handler */
  onArticleClick?: (article: CalendarArticle) => void;
  /** Navigate to previous month */
  onPrevMonth?: () => void;
  /** Navigate to next month */
  onNextMonth?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * CalendarMonthView displays a Notion-style monthly grid calendar.
 *
 * Features:
 * - 7-column grid (Mon-Sun)
 * - Day cells with article dots/mini cards
 * - Content gap indicators for empty future days
 * - Today highlight
 * - Weekend styling
 * - Hover-to-expand for days with many articles
 *
 * @example
 * <CalendarMonthView
 *   year={2026}
 *   month={4} // May (0-indexed)
 *   articles={articles}
 *   onDayClick={(date) => setSelectedDate(date)}
 *   onArticleClick={(article) => openEditor(article.id)}
 * />
 */
export function CalendarMonthView({
  year,
  month,
  articles,
  onDayClick,
  onArticleClick,
  onPrevMonth,
  onNextMonth,
  className,
}: CalendarMonthViewProps) {
  const days = React.useMemo(
    () => getMonthDays(year, month, articles),
    [year, month, articles]
  );

  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
        {/* Navigation */}
        <button
          type="button"
          onClick={onPrevMonth}
          className={cn(
            "p-2 rounded-lg",
            "text-text-3 hover:text-text-1",
            "hover:bg-surface-2",
            "transition-colors duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-accent"
          )}
          aria-label="Previous month"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 12L6 8L10 4" />
          </svg>
        </button>

        {/* Month/Year */}
        <h2
          className={cn(
            "font-display text-[20px] font-medium",
            "text-text-1",
            "tracking-[-0.02em]"
          )}
        >
          {monthName}
        </h2>

        {/* Navigation */}
        <button
          type="button"
          onClick={onNextMonth}
          className={cn(
            "p-2 rounded-lg",
            "text-text-3 hover:text-text-1",
            "hover:bg-surface-2",
            "transition-colors duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-accent"
          )}
          aria-label="Next month"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6 4L10 8L6 12" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-hairline-2">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "px-2 py-2",
              "text-[12px] font-medium uppercase tracking-[0.1em]",
              "text-text-3",
              "text-center",
              "border-r border-hairline-2 last:border-r-0",
              // Weekend headers
              (index === 5 || index === 6) && "text-text-4"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => (
          <DayCell
            key={`${day.date.toISOString()}-${index}`}
            day={day}
            onDayClick={onDayClick}
            onArticleClick={onArticleClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-3 border-t border-hairline-2 bg-surface-2">
        <div className="flex items-center gap-1.5">
          <ArticleStatusBadge status="published" dotOnly />
          <span className="text-[11px] text-text-3">Published</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArticleStatusBadge status="scheduled" dotOnly />
          <span className="text-[11px] text-text-3">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArticleStatusBadge status="draft" dotOnly />
          <span className="text-[11px] text-text-3">Draft</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArticleStatusBadge status="overdue" dotOnly />
          <span className="text-[11px] text-text-3">Overdue</span>
        </div>
      </div>
    </div>
  );
}
