"use client";

import * as React from "react";
import { ArrowDown, Search, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { NumRow } from "./numerals";

// ---------------------------------------------------------------------------
// DropCause interface
// ---------------------------------------------------------------------------

export type DropCauseType =
  | "technical"
  | "content"
  | "backlink"
  | "serp_change"
  | "competitor";

export interface DropCause {
  id: string;
  type: DropCauseType;
  title: string;
  /** Confidence percentage (0-100) */
  confidence: number;
  evidence?: string;
  actionLabel?: string;
  actionUrl?: string;
}

// ---------------------------------------------------------------------------
// DropCausesPanelProps
// ---------------------------------------------------------------------------

export interface DropCausesPanelProps {
  /** Target keyword */
  keyword: string;
  /** Current ranking position */
  currentPosition: number;
  /** Previous ranking position */
  previousPosition: number;
  /** When the drop occurred */
  dropDate: Date | string;
  /** List of potential causes */
  causes: DropCause[];
  /** Callback when a cause is clicked */
  onCauseClick?: (cause: DropCause) => void;
  /** Callback for audit CTA */
  onAuditClick?: () => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Cause type icons
// ---------------------------------------------------------------------------

const CAUSE_TYPE_LABELS: Record<DropCauseType, string> = {
  technical: "Technical",
  content: "Content",
  backlink: "Backlink",
  serp_change: "SERP Change",
  competitor: "Competitor",
};

// ---------------------------------------------------------------------------
// DropCausesPanel
// ---------------------------------------------------------------------------

/**
 * DropCausesPanel displays potential causes for a keyword ranking drop.
 *
 * Features:
 * - Header with keyword and position change
 * - Confidence bars for each cause
 * - Action buttons for remediation
 * - Audit CTA at bottom
 *
 * @example
 * <DropCausesPanel
 *   keyword="best seo tools"
 *   currentPosition={15}
 *   previousPosition={5}
 *   dropDate={new Date()}
 *   causes={[
 *     { id: '1', type: 'technical', title: 'Page speed decreased', confidence: 85 },
 *   ]}
 *   onAuditClick={() => {}}
 * />
 */
export function DropCausesPanel({
  keyword,
  currentPosition,
  previousPosition,
  dropDate,
  causes,
  onCauseClick,
  onAuditClick,
  className,
}: DropCausesPanelProps) {
  const positionDelta = currentPosition - previousPosition;
  const formattedDate =
    typeof dropDate === "string"
      ? new Date(dropDate).toLocaleDateString()
      : dropDate.toLocaleDateString();

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)]",
        "bg-surface-2",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-error-soft border-b border-error/10">
        <div className="flex items-center justify-between gap-3">
          {/* Keyword */}
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-text-1 truncate">
              {keyword}
            </p>
            <p className="text-[12px] text-text-3">Dropped on {formattedDate}</p>
          </div>

          {/* Position change */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[12px] text-text-3">#{previousPosition}</span>
            <ArrowDown className="h-3.5 w-3.5 text-error" />
            <NumRow value={currentPosition} className="text-error" />
            <span className="text-[12px] text-error font-mono">
              (+{positionDelta})
            </span>
          </div>
        </div>
      </div>

      {/* Causes list */}
      <div className="divide-y divide-hairline-2">
        {causes.map((cause) => {
          // Confidence color: >= 70 accent, >= 40 warning, < 40 text-4
          const confidenceColor =
            cause.confidence >= 70
              ? "bg-accent"
              : cause.confidence >= 40
              ? "bg-warning"
              : "bg-text-4";

          return (
            <div
              key={cause.id}
              role={onCauseClick ? "button" : undefined}
              tabIndex={onCauseClick ? 0 : undefined}
              onClick={() => onCauseClick?.(cause)}
              onKeyDown={
                onCauseClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onCauseClick(cause);
                      }
                    }
                  : undefined
              }
              className={cn(
                "px-4 py-3",
                onCauseClick && [
                  "cursor-pointer",
                  "hover:bg-surface-3",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset",
                ],
                "transition-colors duration-[160ms]"
              )}
            >
              {/* Type label */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.06em]",
                    "text-text-3"
                  )}
                >
                  {CAUSE_TYPE_LABELS[cause.type]}
                </span>
                <span className="text-[11px] font-mono text-text-3">
                  {cause.confidence}%
                </span>
              </div>

              {/* Title */}
              <p className="text-[13px] text-text-1 mb-2">{cause.title}</p>

              {/* Confidence bar */}
              <div className="h-1.5 bg-hairline rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", confidenceColor)}
                  style={{ width: `${cause.confidence}%` }}
                />
              </div>

              {/* Evidence */}
              {cause.evidence && (
                <p className="text-[12px] text-text-3 mt-2">{cause.evidence}</p>
              )}

              {/* Action button */}
              {cause.actionLabel && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (cause.actionUrl) {
                        window.open(cause.actionUrl, "_blank");
                      }
                    }}
                  >
                    {cause.actionLabel}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {causes.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] text-text-3">No causes identified yet</p>
        </div>
      )}

      {/* Audit CTA */}
      {onAuditClick && (
        <div className="px-4 py-3 border-t border-hairline bg-surface">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={onAuditClick}
          >
            <Search className="h-4 w-4 mr-1.5" />
            Run full audit on this page
          </Button>
        </div>
      )}
    </div>
  );
}

DropCausesPanel.displayName = "DropCausesPanel";
