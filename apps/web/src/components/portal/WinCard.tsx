"use client";

/**
 * WinCard Component
 *
 * Displays a keyword that hit top 10 with celebration styling.
 * V6 design: success-soft background, position badge with previous position.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Trophy, ArrowUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecentWin } from "@/lib/portal/types";

export interface WinCardProps {
  /** Win data */
  win: RecentWin;
  /** Additional CSS classes */
  className?: string;
}

export function WinCard({ win, className }: WinCardProps) {
  const timeAgo = formatDistanceToNow(new Date(win.date), { addSuffix: true });
  const positionImprovement = win.previousPosition - win.position;

  return (
    <div
      className={cn(
        "p-4 rounded-[--radius-card] bg-success-soft/50",
        "border border-success/10",
        "transition-all duration-200 hover:bg-success-soft",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Trophy icon */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-success/10">
          <Trophy className="h-4 w-4 text-success" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-text-1 font-medium truncate">
            {win.keyword}
          </p>

          <div className="mt-1 flex items-center gap-2">
            {/* Position badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1",
                "px-2 py-0.5 rounded-[--radius-pill]",
                "bg-success text-white text-[12px] font-medium"
              )}
            >
              #{win.position}
            </span>

            {/* Previous position */}
            <span className="text-[12px] text-text-3 flex items-center gap-1">
              <ArrowUp className="h-3 w-3 text-success" />
              <span className="tabular-nums">from #{win.previousPosition}</span>
              <span className="text-success font-medium">
                (+{positionImprovement})
              </span>
            </span>
          </div>

          {/* Time */}
          <p className="mt-1.5 text-[11px] text-text-3 font-mono">
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * WinCardList - Container for multiple win cards
 */
export interface WinCardListProps {
  /** List of wins */
  wins: RecentWin[];
  /** Maximum items to show */
  maxItems?: number;
  /** Title */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

export function WinCardList({
  wins,
  maxItems = 5,
  title = "Recent Wins",
  className,
}: WinCardListProps) {
  const displayWins = wins.slice(0, maxItems);

  if (displayWins.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h4 className="text-[12px] font-medium text-text-3 uppercase tracking-[0.08em] mb-3">
        {title}
      </h4>
      <div className="space-y-2">
        {displayWins.map((win, idx) => (
          <WinCard key={`${win.keyword}-${idx}`} win={win} />
        ))}
      </div>
    </div>
  );
}
