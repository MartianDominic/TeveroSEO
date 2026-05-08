"use client";

/**
 * CalendarViews Component
 *
 * Three calendar view components for the Content Calendar:
 * - MonthView: Notion-style 7-column grid
 * - WeekView: Linear roadmap-style timeline
 * - ListView: Superhuman-style grouped list with tree connectors
 *
 * V6 design: Ghost-edge shadows, semantic status dots, hover lift.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";

export type ArticleStatus =
  | "published"
  | "scheduled"
  | "draft"
  | "in_progress"
  | "overdue";

export interface CalendarArticle {
  id: string;
  title: string;
  status: ArticleStatus;
  scheduledAt: Date;
  /** Pipeline progress (0-100) */
  progress?: number;
}

export interface CalendarViewProps {
  /** Currently selected date */
  currentDate: Date;
  /** Articles to display */
  articles: CalendarArticle[];
  /** Click handler for an article */
  onArticleClick?: (article: CalendarArticle) => void;
  /** Click handler for a day */
  onDayClick?: (date: Date) => void;
}

/**
 * Status dot configuration
 * - published: solid green
 * - scheduled: hollow blue (border only)
 * - draft: half yellow (gradient)
 * - in_progress: solid accent with halo
 * - overdue: solid red
 */
const statusConfig: Record<
  ArticleStatus,
  {
    dotStyle: string;
    label: string;
  }
> = {
  published: {
    dotStyle: "bg-success",
    label: "Published",
  },
  scheduled: {
    dotStyle: "border-2 border-info bg-transparent",
    label: "Scheduled",
  },
  draft: {
    dotStyle: "bg-gradient-to-r from-warning from-50% to-transparent to-50%",
    label: "Draft",
  },
  in_progress: {
    dotStyle: "bg-accent shadow-[0_0_0_3px_rgba(15,79,61,0.2)]",
    label: "In Progress",
  },
  overdue: {
    dotStyle: "bg-error",
    label: "Overdue",
  },
};

/**
 * StatusDot - Visual status indicator
 */
function StatusDot({ status }: { status: ArticleStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn("w-2 h-2 rounded-full flex-shrink-0", config.dotStyle)}
      title={config.label}
    />
  );
}

/**
 * MonthView - Notion-style calendar grid
 */
export function MonthView({
  currentDate,
  articles,
  onArticleClick,
  onDayClick,
}: CalendarViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getArticlesForDay = (date: Date) =>
    articles.filter(
      (a) =>
        format(a.scheduledAt, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );

  return (
    <div className="overflow-hidden rounded-[--radius-card] border border-hairline-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-surface-2 border-b border-hairline-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="px-3 py-2 text-center text-[12px] font-medium text-text-3 tracking-[0.08em] uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayArticles = getArticlesForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={idx}
              onClick={() => onDayClick?.(day)}
              className={cn(
                "min-h-[100px] p-2 border-b border-r border-hairline-3",
                "text-left transition-colors duration-[160ms]",
                "hover:bg-surface-2",
                !isCurrentMonth && "opacity-40"
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-full text-[14px] tabular-nums",
                  isCurrentDay
                    ? "bg-accent text-white font-medium"
                    : "text-text-2"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Article dots */}
              {dayArticles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {dayArticles.slice(0, 4).map((article) => (
                    <StatusDot key={article.id} status={article.status} />
                  ))}
                  {dayArticles.length > 4 && (
                    <span className="text-xs-safe text-text-3">
                      +{dayArticles.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * WeekView - Linear roadmap-style timeline
 */
export function WeekView({
  currentDate,
  articles,
  onArticleClick,
}: CalendarViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getArticlesForDay = (date: Date) =>
    articles.filter(
      (a) =>
        format(a.scheduledAt, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );

  return (
    <div className="grid grid-cols-5 gap-4">
      {days.slice(0, 5).map((day, idx) => {
        const dayArticles = getArticlesForDay(day);
        const isCurrentDay = isToday(day);

        return (
          <div key={idx} className="space-y-3">
            {/* Day header */}
            <div
              className={cn(
                "text-center py-2 rounded-lg",
                isCurrentDay ? "bg-accent-soft" : "bg-surface-2"
              )}
            >
              <div className="text-[12px] text-text-3 uppercase tracking-[0.08em]">
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "text-[20px] font-display tabular-nums",
                  isCurrentDay ? "text-accent font-medium" : "text-text-1"
                )}
              >
                {format(day, "d")}
              </div>
            </div>

            {/* Articles for day */}
            <div className="space-y-2">
              {dayArticles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => onArticleClick?.(article)}
                  className={cn(
                    "w-full p-3 rounded-lg bg-surface text-left",
                    "shadow-[var(--shadow-card)]",
                    "hover:shadow-[var(--shadow-lift)] hover:-translate-y-px",
                    "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <StatusDot status={article.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-text-1 font-medium line-clamp-2">
                        {article.title}
                      </p>
                      <p className="mt-1 text-[12px] text-text-3">
                        {format(article.scheduledAt, "h:mm a")}
                      </p>
                    </div>
                  </div>
                  {/* Pipeline progress */}
                  {article.progress !== undefined && (
                    <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${article.progress}%` }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ListView - Superhuman-style grouped list
 */
export function ListView({
  currentDate,
  articles,
  onArticleClick,
}: CalendarViewProps) {
  // Group articles by relative time
  const overdue = articles.filter((a) => a.status === "overdue");
  const today = articles.filter(
    (a) =>
      format(a.scheduledAt, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd") &&
      a.status !== "overdue"
  );
  const upcoming = articles.filter(
    (a) => a.scheduledAt > currentDate && a.status !== "overdue"
  );

  const renderGroup = (
    label: string,
    items: CalendarArticle[],
    accentColor?: boolean
  ) =>
    items.length > 0 && (
      <div className="mb-6">
        <h3
          className={cn(
            "mb-3 text-[12px] font-medium uppercase tracking-[0.1em]",
            accentColor ? "text-error" : "text-text-3"
          )}
        >
          {label}
        </h3>
        <div className="space-y-1">
          {items.map((article, idx) => (
            <button
              key={article.id}
              onClick={() => onArticleClick?.(article)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg",
                "hover:bg-surface-2 transition-colors duration-[160ms]",
                "text-left",
                article.status === "overdue" && "border-l-2 border-error"
              )}
            >
              {/* Tree connector */}
              <span className="font-mono text-text-4 text-[14px]">
                {idx === items.length - 1 ? "└─" : "├─"}
              </span>

              {/* Status dot */}
              <StatusDot status={article.status} />

              {/* Title */}
              <span className="flex-1 text-[14px] text-text-1 truncate">
                {article.title}
              </span>

              {/* Time/status */}
              <span className="text-[13px] text-text-3">
                {article.status === "overdue"
                  ? "Overdue"
                  : article.status === "draft"
                    ? "Draft"
                    : format(article.scheduledAt, "h:mm a")}
              </span>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      {renderGroup("OVERDUE", overdue, true)}
      {renderGroup(`TODAY - ${format(currentDate, "EEEE, MMMM d")}`, today)}
      {renderGroup("UPCOMING", upcoming)}

      {articles.length === 0 && (
        <div className="py-12 text-center text-[14px] text-text-3">
          No content scheduled
        </div>
      )}
    </div>
  );
}
