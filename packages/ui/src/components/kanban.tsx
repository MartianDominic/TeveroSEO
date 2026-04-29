"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { type StatusConfig, getStatusConfig, PROSPECT_STATUS } from "../lib/status-config";

// ---------------------------------------------------------------------------
// KanbanColumnProps
// ---------------------------------------------------------------------------

export interface KanbanColumnProps {
  /** Column title */
  title: string;
  /** Number of items in this column */
  count: number;
  /** Status key for color lookup */
  status: string;
  /** Optional custom status config (overrides status lookup) */
  statusConfig?: StatusConfig;
  /** KanbanCard children */
  children: React.ReactNode;
  /** Drop handler for drag-and-drop */
  onDrop?: (itemId: string) => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// KanbanCardProps
// ---------------------------------------------------------------------------

export interface KanbanCardProps {
  /** Unique identifier for the card */
  id: string;
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional metadata (rendered as ReactNode for flexibility) */
  meta?: React.ReactNode;
  /** Status key for indicator dot */
  status?: string;
  /** Whether the card is draggable */
  draggable?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// KanbanColumn
// ---------------------------------------------------------------------------

/**
 * KanbanColumn displays a column in a kanban board with:
 * - Header with status dot, title, and count badge
 * - Scrollable container for KanbanCard children
 *
 * Uses role="listbox" for accessibility.
 *
 * @example
 * <KanbanColumn title="New" count={5} status="new">
 *   <KanbanCard id="1" title="Prospect A" />
 *   <KanbanCard id="2" title="Prospect B" />
 * </KanbanColumn>
 */
export function KanbanColumn({
  title,
  count,
  status,
  statusConfig,
  children,
  onDrop,
  className,
}: KanbanColumnProps) {
  // Get status config for dot color
  const config = statusConfig ?? getStatusConfig(PROSPECT_STATUS, status);

  // Handle drop events
  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (onDrop) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    },
    [onDrop]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (onDrop) {
        const itemId = e.dataTransfer.getData("text/plain");
        if (itemId) {
          onDrop(itemId);
        }
      }
    },
    [onDrop]
  );

  return (
    <div
      role="listbox"
      aria-label={`${title} column with ${count} items`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        // Base layout
        "flex flex-col",
        "min-w-[280px] max-w-[320px]",
        "bg-surface-2/50 rounded-card",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-hairline-2">
        {/* Status dot */}
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            config.color,
            config.pulse && "animate-pulse"
          )}
        />

        {/* Title */}
        <span className="text-sm font-medium text-text-1 flex-1">{title}</span>

        {/* Count badge */}
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded-pill",
            "bg-surface-3 text-text-3",
            "[font-variant-numeric:tabular-nums]"
          )}
        >
          {count}
        </span>
      </div>

      {/* Cards container */}
      <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanCard
// ---------------------------------------------------------------------------

/**
 * KanbanCard displays a single card within a KanbanColumn.
 * Features shadow-card at rest and shadow-lift on hover.
 *
 * Uses role="option" for accessibility within listbox.
 *
 * @example
 * <KanbanCard
 *   id="prospect-1"
 *   title="acme.com"
 *   subtitle="Acme Corporation"
 *   status="analyzing"
 *   draggable
 *   onClick={() => router.push("/prospects/1")}
 * />
 */
export function KanbanCard({
  id,
  title,
  subtitle,
  meta,
  status,
  draggable = false,
  onClick,
  className,
}: KanbanCardProps) {
  // Get status config for dot color
  const config = status ? getStatusConfig(PROSPECT_STATUS, status) : null;

  // Handle drag start
  const handleDragStart = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    },
    [id]
  );

  return (
    <div
      role="option"
      aria-selected={false}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onClick={onClick}
      className={cn(
        // Base card styling
        "bg-surface rounded-card shadow-card",
        "px-3 py-2.5",
        // Hover effects
        "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:shadow-lift hover:-translate-y-px",
        // Interactive states
        onClick && "cursor-pointer",
        draggable && "cursor-grab active:cursor-grabbing",
        // Group for hover-reveal
        "group",
        className
      )}
    >
      {/* Header with title and status */}
      <div className="flex items-start gap-2">
        {/* Status dot (if provided) */}
        {config && (
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0 mt-1",
              config.color,
              config.pulse && "animate-pulse"
            )}
          />
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-1 truncate">{title}</p>
          {subtitle && (
            <p className="text-xs text-text-3 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Drag handle (visible on hover when draggable) */}
        {draggable && (
          <div
            className={cn(
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-[160ms]",
              "text-text-4"
            )}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Meta content */}
      {meta && <div className="mt-2 text-xs text-text-3">{meta}</div>}
    </div>
  );
}
