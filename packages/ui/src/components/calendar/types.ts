/**
 * Content Calendar Types
 *
 * Shared types for the Content Calendar component system.
 */

export type ArticleStatus =
  | "draft"
  | "in_progress"
  | "scheduled"
  | "publishing"
  | "published"
  | "overdue";

export type ArticlePipelineStage =
  | "research"
  | "writing"
  | "images"
  | "links"
  | "review"
  | "complete";

export interface CalendarArticle {
  /** Unique article ID */
  id: string;
  /** Article title */
  title: string;
  /** Current status */
  status: ArticleStatus;
  /** Scheduled or published date/time */
  scheduledAt: Date;
  /** Publication time (for countdown display) */
  publishTime?: string;
  /** Quality score (0-100) */
  score?: number;
  /** Current pipeline stage */
  pipelineStage?: ArticlePipelineStage;
  /** Pipeline progress (0-100) */
  pipelineProgress?: number;
  /** View count (for published articles) */
  views?: number;
  /** Target keyword */
  keyword?: string;
  /** Author name */
  author?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Was this originally scheduled for an earlier date? */
  originalScheduledAt?: Date;
}

export interface CalendarDay {
  /** Date for this day */
  date: Date;
  /** Articles scheduled for this day */
  articles: CalendarArticle[];
  /** Is this day in the current month? */
  isCurrentMonth: boolean;
  /** Is this today? */
  isToday: boolean;
  /** Is this in the past? */
  isPast: boolean;
  /** Is this a weekend? */
  isWeekend: boolean;
}

export interface CalendarWeek {
  /** Week number (ISO) */
  weekNumber: number;
  /** Days in this week */
  days: CalendarDay[];
  /** Start date of the week */
  startDate: Date;
  /** End date of the week */
  endDate: Date;
}

export type CalendarViewMode = "month" | "week" | "list";

export interface CalendarFilters {
  /** Filter by status */
  status?: ArticleStatus[];
  /** Filter by author */
  author?: string;
  /** Search query */
  search?: string;
  /** Show only overdue */
  showOverdue?: boolean;
}

export interface DragDropResult {
  /** Article being moved */
  articleId: string;
  /** New scheduled date */
  newDate: Date;
  /** New scheduled time (optional) */
  newTime?: string;
}
