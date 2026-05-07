"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { ArticleCardCompact } from "./article-card";
import {
  getWeekDays,
  formatDayHeader,
  formatWeekRange,
  formatTime,
} from "./calendar-utils";
import type { CalendarArticle, CalendarWeek, CalendarDay } from "./types";

// ---------------------------------------------------------------------------
// TimeSlot
// ---------------------------------------------------------------------------

interface TimeSlotProps {
  time: string;
  article?: CalendarArticle;
  onArticleClick?: (article: CalendarArticle) => void;
  isDropTarget?: boolean;
}

function TimeSlot({
  time,
  article,
  onArticleClick,
  isDropTarget = false,
}: TimeSlotProps) {
  return (
    <div
      className={cn(
        "flex gap-3 py-2",
        isDropTarget && "bg-accent-soft/30 rounded-lg"
      )}
    >
      {/* Time column (fixed width, mono) */}
      <span
        className={cn(
          "w-[44px] shrink-0",
          "font-mono text-[12px] tabular-nums",
          "text-text-3"
        )}
      >
        {time}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {article ? (
          <ArticleCardCompact
            article={article}
            onClick={() => onArticleClick?.(article)}
          />
        ) : (
          <div
            className={cn(
              "h-[48px]",
              "border border-dashed border-hairline",
              "rounded-lg",
              "flex items-center justify-center",
              "text-[12px] text-text-4"
            )}
          >
            {/* Empty slot */}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DaySection
// ---------------------------------------------------------------------------

interface DaySectionProps {
  day: CalendarDay;
  onArticleClick?: (article: CalendarArticle) => void;
  onAddClick?: (date: Date) => void;
}

function DaySection({ day, onArticleClick, onAddClick }: DaySectionProps) {
  // Group articles by time
  const articlesByTime = React.useMemo(() => {
    const map = new Map<string, CalendarArticle>();
    for (const article of day.articles) {
      const time = formatTime(article.scheduledAt);
      map.set(time, article);
    }
    return map;
  }, [day.articles]);

  // Get unique times, sorted
  const times = React.useMemo(() => {
    const uniqueTimes = Array.from(articlesByTime.keys());
    return uniqueTimes.sort();
  }, [articlesByTime]);

  const hasContent = day.articles.length > 0;
  const isContentGap =
    !day.isPast && !day.isToday && !hasContent && !day.isWeekend;

  return (
    <div className="py-4">
      {/* Day header */}
      <div
        className={cn(
          "flex items-center justify-between",
          "pb-3 mb-3",
          // Today gets special emphasis
          day.isToday
            ? "border-b-2 border-accent"
            : "border-b border-hairline-2"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Day label */}
          <span
            className={cn(
              "text-[12px] font-medium uppercase tracking-[0.1em]",
              day.isToday ? "text-accent" : "text-text-3"
            )}
          >
            {formatDayHeader(day.date)}
          </span>

          {/* Today badge */}
          {day.isToday && (
            <span
              className={cn(
                "px-2 py-0.5",
                "text-[10px] font-medium uppercase tracking-[0.1em]",
                "bg-accent text-white",
                "rounded-full"
              )}
            >
              Today
            </span>
          )}
        </div>

        {/* Article count */}
        {hasContent && (
          <span className="text-[12px] text-text-3 font-mono tabular-nums">
            {day.articles.length} article{day.articles.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {hasContent ? (
        <div className="space-y-1">
          {times.map((time) => (
            <TimeSlot
              key={time}
              time={time}
              article={articlesByTime.get(time)}
              onArticleClick={onArticleClick}
            />
          ))}
        </div>
      ) : (
        // Empty day / content gap
        <button
          type="button"
          onClick={() => onAddClick?.(day.date)}
          className={cn(
            "w-full py-6",
            "border border-dashed rounded-lg",
            isContentGap ? "border-warning/50 bg-warning-soft/30" : "border-hairline",
            "flex flex-col items-center justify-center gap-1",
            "text-text-4 hover:text-text-2",
            "hover:border-accent hover:bg-accent-soft/20",
            "transition-all duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-accent"
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 4V16M4 10H16" />
          </svg>
          <span className="text-[12px]">
            {isContentGap ? "Content gap - Add article" : "No content scheduled"}
          </span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarWeekView
// ---------------------------------------------------------------------------

export interface CalendarWeekViewProps {
  /** Reference date for the week */
  date: Date;
  /** Articles to display */
  articles: CalendarArticle[];
  /** Article click handler */
  onArticleClick?: (article: CalendarArticle) => void;
  /** Add article handler */
  onAddClick?: (date: Date) => void;
  /** Navigate to previous week */
  onPrevWeek?: () => void;
  /** Navigate to next week */
  onNextWeek?: () => void;
  /** Navigate to today */
  onToday?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * CalendarWeekView displays a Linear Roadmap-style weekly timeline.
 *
 * Features:
 * - Vertical day sections with time-based article slots
 * - Today highlighted with accent border
 * - Content gap warnings for empty future days
 * - Time column (mono, 44px fixed width)
 * - Drag-to-reschedule support (via parent)
 *
 * @example
 * <CalendarWeekView
 *   date={new Date()}
 *   articles={articles}
 *   onArticleClick={(article) => openEditor(article.id)}
 *   onAddClick={(date) => createArticle(date)}
 * />
 */
export function CalendarWeekView({
  date,
  articles,
  onArticleClick,
  onAddClick,
  onPrevWeek,
  onNextWeek,
  onToday,
  className,
}: CalendarWeekViewProps) {
  const week = React.useMemo(
    () => getWeekDays(date, articles),
    [date, articles]
  );

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevWeek}
            className={cn(
              "p-2 rounded-lg",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-accent"
            )}
            aria-label="Previous week"
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

          <button
            type="button"
            onClick={onToday}
            className={cn(
              "px-3 py-1.5 rounded-lg",
              "text-[13px] font-medium",
              "text-text-2 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-accent"
            )}
          >
            This Week
          </button>

          <button
            type="button"
            onClick={onNextWeek}
            className={cn(
              "p-2 rounded-lg",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-accent"
            )}
            aria-label="Next week"
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

        {/* Week range */}
        <h2
          className={cn(
            "font-display text-[18px] font-medium",
            "text-text-1",
            "tracking-[-0.02em]"
          )}
        >
          Week of {formatWeekRange(week.startDate, week.endDate)}
        </h2>

        {/* Schedule button */}
        <button
          type="button"
          onClick={() => onAddClick?.(new Date())}
          className={cn(
            "flex items-center gap-2",
            "px-4 py-2 rounded-lg",
            "text-[14px] font-medium",
            "bg-gradient-to-b from-[#1A6E55] to-[#0F4F3D]",
            "text-white",
            "shadow-[inset_0_0_0_1px_rgba(15,79,61,0.6),inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(15,79,61,0.18),0_4px_12px_-2px_rgba(15,79,61,0.20)]",
            "hover:shadow-[inset_0_0_0_1px_rgba(15,79,61,0.8),inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(15,79,61,0.25),0_8px_18px_-4px_rgba(15,79,61,0.28)]",
            "transition-all duration-[280ms]",
            "hover:-translate-y-px",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M8 3V13M3 8H13" />
          </svg>
          Schedule
        </button>
      </div>

      {/* Day sections */}
      <div className="divide-y divide-hairline-2 px-6">
        {week.days.map((day) => (
          <DaySection
            key={day.date.toISOString()}
            day={day}
            onArticleClick={onArticleClick}
            onAddClick={onAddClick}
          />
        ))}
      </div>
    </div>
  );
}
