/**
 * Content Calendar Component System
 *
 * A premium calendar UI for content operations, following the
 * TeveroSEO Design System v6 (Stripe+Linear+Superhuman aesthetic).
 *
 * @example
 * import {
 *   ContentCalendar,
 *   CalendarMonthView,
 *   CalendarWeekView,
 *   CalendarListView,
 *   ArticleCard,
 *   ArticleStatusBadge,
 *   PipelineProgress
 * } from "@tevero/ui/calendar";
 */

// Main orchestrating component
export { ContentCalendar } from "./content-calendar";
export type { ContentCalendarProps } from "./content-calendar";

// Individual view components
export { CalendarMonthView } from "./calendar-month-view";
export type { CalendarMonthViewProps } from "./calendar-month-view";

export { CalendarWeekView } from "./calendar-week-view";
export type { CalendarWeekViewProps } from "./calendar-week-view";

export { CalendarListView } from "./calendar-list-view";
export type { CalendarListViewProps } from "./calendar-list-view";

// Article card variants
export {
  ArticleCard,
  ArticleCardCompact,
  ArticleCardMini,
} from "./article-card";
export type {
  ArticleCardProps,
  ArticleCardCompactProps,
  ArticleCardMiniProps,
} from "./article-card";

// Status and progress components
export { ArticleStatusBadge } from "./article-status-badge";
export type { ArticleStatusBadgeProps } from "./article-status-badge";

export { PipelineProgress, PipelineProgressInline } from "./pipeline-progress";
export type {
  PipelineProgressProps,
  PipelineProgressInlineProps,
} from "./pipeline-progress";

// Utilities
export * from "./calendar-utils";

// Types
export type {
  ArticleStatus,
  ArticlePipelineStage,
  CalendarArticle,
  CalendarDay,
  CalendarWeek,
  CalendarViewMode,
  CalendarFilters,
  DragDropResult,
} from "./types";
