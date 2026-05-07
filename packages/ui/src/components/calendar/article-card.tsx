"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { ArticleStatusBadge } from "./article-status-badge";
import { PipelineProgress, PipelineProgressInline } from "./pipeline-progress";
import { getCountdown, getOverdueDuration, formatTime } from "./calendar-utils";
import type { CalendarArticle } from "./types";

// ---------------------------------------------------------------------------
// ArticleCard (Expanded)
// ---------------------------------------------------------------------------

export interface ArticleCardProps {
  /** Article data */
  article: CalendarArticle;
  /** Click handler */
  onClick?: () => void;
  /** Is this card being dragged? */
  isDragging?: boolean;
  /** Is this a drop preview? */
  isDropPreview?: boolean;
  /** Show detailed view with pipeline progress */
  showDetails?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * ArticleCard displays an article in the calendar with full details.
 *
 * Features:
 * - Ghost-edge shadow card (v6 design system)
 * - Lifts on hover
 * - Status badge with countdown
 * - Pipeline progress indicator
 * - Quality score display
 * - Drag handle on hover
 *
 * @example
 * <ArticleCard
 *   article={article}
 *   onClick={() => openEditor(article.id)}
 *   showDetails
 * />
 */
export function ArticleCard({
  article,
  onClick,
  isDragging = false,
  isDropPreview = false,
  showDetails = false,
  className,
}: ArticleCardProps) {
  const countdown = React.useMemo(() => {
    if (article.status !== "scheduled") return null;
    return getCountdown(article.scheduledAt);
  }, [article.status, article.scheduledAt]);

  const overdueDuration = React.useMemo(() => {
    if (article.status !== "overdue") return null;
    return getOverdueDuration(article.scheduledAt);
  }, [article.status, article.scheduledAt]);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        // Base card styling (v6 ghost-edge shadows)
        "relative",
        "bg-surface",
        "rounded-[var(--radius-card)]",
        "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]",
        // Padding
        "p-4",
        // Interactive states
        onClick && [
          "cursor-pointer",
          "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_6px_16px_-4px_rgba(20,20,26,0.06),0_16px_40px_-16px_rgba(20,20,26,0.10),inset_0_1px_0_rgba(255,255,255,0.55)]",
          "hover:-translate-y-px",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
        ],
        // Dragging state
        isDragging && "opacity-50 scale-[0.98]",
        // Drop preview state
        isDropPreview && [
          "border-2 border-dashed border-accent",
          "bg-accent-soft",
        ],
        // Overdue styling
        article.status === "overdue" && "border-l-2 border-l-error",
        className
      )}
    >
      {/* Drag handle (appears on hover) */}
      {onClick && (
        <div
          className={cn(
            "absolute left-1 top-1/2 -translate-y-1/2",
            "w-4 h-8",
            "flex flex-col items-center justify-center gap-0.5",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-[240ms]",
            "cursor-grab active:cursor-grabbing"
          )}
        >
          <span className="w-1 h-1 rounded-full bg-text-4" />
          <span className="w-1 h-1 rounded-full bg-text-4" />
          <span className="w-1 h-1 rounded-full bg-text-4" />
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {/* Title */}
        <h4
          className={cn(
            "text-[14px] leading-snug font-medium",
            "text-text-1",
            "line-clamp-2"
          )}
        >
          {article.title}
        </h4>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <ArticleStatusBadge
            status={article.status}
            countdown={countdown?.text}
            isUrgent={countdown?.urgent}
          />

          {/* Quality score */}
          {article.score !== undefined && (
            <span
              className={cn(
                "text-[13px] font-mono tabular-nums",
                article.score >= 80 ? "text-success" : "text-warning"
              )}
            >
              Score {article.score}/100
            </span>
          )}

          {/* View count (for published) */}
          {article.status === "published" && article.views !== undefined && (
            <span className="text-[13px] text-text-3 font-mono tabular-nums">
              {article.views.toLocaleString()} views
            </span>
          )}

          {/* Overdue indicator */}
          {overdueDuration && (
            <span className="text-[12px] text-error">{overdueDuration}</span>
          )}
        </div>

        {/* Pipeline progress (if showing details and not published) */}
        {showDetails &&
          article.pipelineStage &&
          article.status !== "published" && (
            <div className="pt-2 border-t border-hairline-2">
              <PipelineProgress
                currentStage={article.pipelineStage}
                progress={article.pipelineProgress}
                showLabels
              />
            </div>
          )}

        {/* Keyword tag */}
        {article.keyword && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-text-4 uppercase tracking-[0.1em]">
              Keyword:
            </span>
            <span className="text-[12px] text-text-2 font-mono">
              {article.keyword}
            </span>
          </div>
        )}
      </div>

      {/* Hover arrow (Linear-style) */}
      {onClick && (
        <span
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2",
            "text-text-4",
            "opacity-0 -translate-x-1",
            "transition-all duration-[240ms]",
            "group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-accent"
          )}
        >
          -&gt;
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleCardCompact (for timeline time slots)
// ---------------------------------------------------------------------------

export interface ArticleCardCompactProps {
  /** Article data */
  article: CalendarArticle;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * ArticleCardCompact is a smaller card for timeline view time slots.
 *
 * Shows: title, status badge, score (if available)
 */
export function ArticleCardCompact({
  article,
  onClick,
  className,
}: ArticleCardCompactProps) {
  const countdown = React.useMemo(() => {
    if (article.status !== "scheduled") return null;
    return getCountdown(article.scheduledAt);
  }, [article.status, article.scheduledAt]);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group",
        "bg-surface",
        "rounded-lg",
        "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03)]",
        "px-3 py-2.5",
        onClick && [
          "cursor-pointer",
          "transition-all duration-[280ms]",
          "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_4px_12px_-4px_rgba(20,20,26,0.08)]",
          "hover:-translate-y-0.5",
        ],
        article.status === "overdue" && "border-l-2 border-l-error",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-text-1 font-medium truncate">
            {article.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <ArticleStatusBadge
              status={article.status}
              countdown={countdown?.text}
              isUrgent={countdown?.urgent}
            />
            {article.score !== undefined && (
              <span className="text-[12px] font-mono tabular-nums text-text-3">
                {article.score}/100
              </span>
            )}
          </div>
        </div>

        {/* Pipeline indicator (compact) */}
        {article.pipelineStage && article.status !== "published" && (
          <div className="w-16 shrink-0">
            <PipelineProgress
              currentStage={article.pipelineStage}
              progress={article.pipelineProgress}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleCardMini (for month grid cells)
// ---------------------------------------------------------------------------

export interface ArticleCardMiniProps {
  /** Article data */
  article: CalendarArticle;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * ArticleCardMini is the smallest card for month view cells.
 *
 * Shows: status dot + truncated title
 */
export function ArticleCardMini({
  article,
  onClick,
  className,
}: ArticleCardMiniProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-1.5",
        "px-1.5 py-0.5",
        "rounded",
        "text-[11px] text-text-2",
        "truncate",
        onClick && [
          "cursor-pointer",
          "hover:bg-surface-2",
          "transition-colors duration-[160ms]",
        ],
        className
      )}
    >
      <ArticleStatusBadge status={article.status} dotOnly />
      <span className="truncate">{article.title}</span>
    </div>
  );
}
