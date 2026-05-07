/**
 * Content Calendar Utilities
 *
 * Date manipulation and formatting helpers for the calendar.
 */

import type { CalendarDay, CalendarWeek, CalendarArticle } from "./types";

/**
 * Get all days for a month grid (including padding days from adjacent months)
 */
export function getMonthDays(
  year: number,
  month: number,
  articles: CalendarArticle[]
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday (adjust if week starts on Sunday)
  const startPadding = (firstDay.getDay() + 6) % 7; // Monday = 0
  const endPadding = (7 - ((lastDay.getDay() + 6) % 7) - 1) % 7;

  const days: CalendarDay[] = [];

  // Previous month padding
  for (let i = startPadding; i > 0; i--) {
    const date = new Date(year, month, 1 - i);
    days.push(createCalendarDay(date, articles, today, false));
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push(createCalendarDay(date, articles, today, true));
  }

  // Next month padding
  for (let i = 1; i <= endPadding; i++) {
    const date = new Date(year, month + 1, i);
    days.push(createCalendarDay(date, articles, today, false));
  }

  return days;
}

/**
 * Get week data for a specific date
 */
export function getWeekDays(
  date: Date,
  articles: CalendarArticle[]
): CalendarWeek {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find Monday of the week
  const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(
      createCalendarDay(
        d,
        articles,
        today,
        d.getMonth() === date.getMonth()
      )
    );
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekNumber: getISOWeekNumber(monday),
    days,
    startDate: monday,
    endDate: sunday,
  };
}

/**
 * Create a CalendarDay object
 */
function createCalendarDay(
  date: Date,
  articles: CalendarArticle[],
  today: Date,
  isCurrentMonth: boolean
): CalendarDay {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);

  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  return {
    date: new Date(date),
    articles: articles.filter((a) => {
      const scheduled = new Date(a.scheduledAt);
      return scheduled >= dateStart && scheduled <= dateEnd;
    }),
    isCurrentMonth,
    isToday: dateStart.getTime() === today.getTime(),
    isPast: dateStart < today,
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
  };
}

/**
 * Get ISO week number
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Format date as "Monday, May 6"
 */
export function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format date as "May 4-10, 2026"
 */
export function formatWeekRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }

  if (sameYear) {
    return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getDate()} - ${end.toLocaleDateString("en-US", { month: "short" })} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

/**
 * Format time as "09:00"
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Calculate time until publication
 */
export function getCountdown(
  targetDate: Date
): { text: string; urgent: boolean } | null {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) return null;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return { text: `in ${days}d ${hours % 24}h`, urgent: false };
  }

  if (hours > 0) {
    return {
      text: `in ${hours}h ${minutes % 60}m`,
      urgent: hours < 1,
    };
  }

  return {
    text: `in ${minutes} minutes`,
    urgent: true,
  };
}

/**
 * Calculate overdue duration
 */
export function getOverdueDuration(dueDate: Date): string {
  const now = new Date();
  const diff = now.getTime() - dueDate.getTime();

  if (diff <= 0) return "";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "due today";
  if (days === 1) return "1 day overdue";
  return `${days} days overdue`;
}

/**
 * Group articles by date for list view
 */
export function groupArticlesByDate(
  articles: CalendarArticle[]
): Map<string, CalendarArticle[]> {
  const groups = new Map<string, CalendarArticle[]>();

  const sorted = [...articles].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
  );

  for (const article of sorted) {
    const key = article.scheduledAt.toISOString().split("T")[0];
    const existing = groups.get(key) || [];
    existing.push(article);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Get relative day label (Today, Tomorrow, Yesterday, etc.)
 */
export function getRelativeDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diff = Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";

  return formatDayHeader(date);
}
