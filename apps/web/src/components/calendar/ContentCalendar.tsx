"use client";

/**
 * ContentCalendar Component
 *
 * Main calendar wrapper with view switching and navigation.
 * Combines MonthView, WeekView, and ListView with unified controls.
 *
 * V6 design: Card container, segmented view switcher, status legend.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@tevero/ui";
import { ChevronLeft, ChevronRight, Calendar, List, LayoutGrid } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import {
  MonthView,
  WeekView,
  ListView,
  type CalendarArticle,
  type ArticleStatus,
} from "./CalendarViews";

export type CalendarViewMode = "month" | "week" | "list";

export interface ContentCalendarProps {
  /** Articles to display */
  articles: CalendarArticle[];
  /** Initial view mode */
  defaultView?: CalendarViewMode;
  /** Initial date */
  defaultDate?: Date;
  /** Article click handler */
  onArticleClick?: (article: CalendarArticle) => void;
  /** Day click handler (for creating new content) */
  onDayClick?: (date: Date) => void;
  /** Additional CSS classes */
  className?: string;
}

const viewModes: {
  id: CalendarViewMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { id: "month", icon: LayoutGrid, label: "Month" },
  { id: "week", icon: Calendar, label: "Week" },
  { id: "list", icon: List, label: "List" },
];

/**
 * ContentCalendar - Main calendar component with view switching
 *
 * Features:
 * - Three view modes: month (Notion), week (Linear), list (Superhuman)
 * - Date navigation with arrow buttons
 * - Status legend
 * - Article click handling for details
 * - Day click handling for scheduling new content
 */
export function ContentCalendar({
  articles,
  defaultView = "month",
  defaultDate,
  onArticleClick,
  onDayClick,
  className,
}: ContentCalendarProps) {
  const [view, setView] = React.useState<CalendarViewMode>(defaultView);
  const [currentDate, setCurrentDate] = React.useState(
    defaultDate || new Date()
  );

  // Navigation handlers
  const navigatePrev = () => {
    setCurrentDate((prev) =>
      view === "month" ? subMonths(prev, 1) : subWeeks(prev, 1)
    );
  };

  const navigateNext = () => {
    setCurrentDate((prev) =>
      view === "month" ? addMonths(prev, 1) : addWeeks(prev, 1)
    );
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Get title based on view
  const getTitle = () => {
    if (view === "month") return format(currentDate, "MMMM yyyy");
    if (view === "week") return `Week of ${format(currentDate, "MMM d, yyyy")}`;
    return "Content Schedule";
  };

  // Count articles by status for legend
  const statusCounts = React.useMemo(() => {
    const counts: Partial<Record<ArticleStatus, number>> = {};
    articles.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [articles]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-center justify-between gap-4">
        {/* Title and navigation */}
        <div className="flex items-center gap-4">
          {/* Navigation arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={navigatePrev}
              className={cn(
                "p-1.5 rounded-[--radius-button]",
                "hover:bg-surface-2 transition-colors duration-[160ms]"
              )}
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5 text-text-2" />
            </button>
            <button
              onClick={navigateNext}
              className={cn(
                "p-1.5 rounded-[--radius-button]",
                "hover:bg-surface-2 transition-colors duration-[160ms]"
              )}
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5 text-text-2" />
            </button>
          </div>

          {/* Title */}
          <CardTitle className="text-[18px]">{getTitle()}</CardTitle>

          {/* Today button */}
          <button
            onClick={navigateToday}
            className={cn(
              "px-3 py-1 rounded-[--radius-button] text-[13px] font-medium",
              "bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text-1",
              "transition-colors duration-[160ms]"
            )}
          >
            Today
          </button>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-[--radius-button]">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setView(mode.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium",
                "transition-all duration-[160ms]",
                view === mode.id
                  ? "bg-surface text-text-1 shadow-[var(--shadow-card)]"
                  : "text-text-3 hover:text-text-2"
              )}
              aria-pressed={view === mode.id}
            >
              <mode.icon className="w-4 h-4" />
              {mode.label}
            </button>
          ))}
        </div>
      </CardHeader>

      {/* Status legend */}
      <div className="px-7 py-2 border-b border-hairline-2 bg-surface-2/50 flex items-center gap-4">
        {[
          {
            status: "published" as const,
            label: "Published",
            dot: "bg-success",
          },
          {
            status: "scheduled" as const,
            label: "Scheduled",
            dot: "border-2 border-info",
          },
          {
            status: "draft" as const,
            label: "Draft",
            dot: "bg-warning/50",
          },
          {
            status: "overdue" as const,
            label: "Overdue",
            dot: "bg-error",
          },
        ].map((item) => (
          <div
            key={item.status}
            className="flex items-center gap-2 text-[12px] text-text-3"
          >
            <span className={cn("w-2 h-2 rounded-full", item.dot)} />
            <span>{item.label}</span>
            {statusCounts[item.status] && (
              <span className="text-text-4">({statusCounts[item.status]})</span>
            )}
          </div>
        ))}
      </div>

      {/* Calendar view */}
      <div className="p-6">
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            articles={articles}
            onArticleClick={onArticleClick}
            onDayClick={onDayClick}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            articles={articles}
            onArticleClick={onArticleClick}
          />
        )}
        {view === "list" && (
          <ListView
            currentDate={currentDate}
            articles={articles}
            onArticleClick={onArticleClick}
          />
        )}
      </div>
    </Card>
  );
}

// Re-export types for convenience
export type { CalendarArticle, ArticleStatus };

ContentCalendar.displayName = "ContentCalendar";
