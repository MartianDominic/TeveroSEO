/**
 * Heatmap Overlay Component for Document Builder
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 *
 * Positioned absolute overlay on PersuasionBlock showing engagement levels.
 * Per UI-SPEC:
 * - background: linear-gradient with heat color
 * - pointer-events: none
 * - opacity transition: 280ms var(--ease-smooth)
 * - Toggle via "Show Engagement" switch in parent
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  type HeatLevel,
  getHeatColor,
  getHeatLabel,
  getHeatGradient,
} from "@/lib/document-builder/heatmap-calculator";

// =============================================================================
// Types
// =============================================================================

export interface HeatmapOverlayProps {
  /** Heat level for this block */
  level: HeatLevel;
  /** Engagement score (0-100) */
  score: number;
  /** Whether the overlay is visible */
  visible: boolean;
  /** Show label on hover */
  showLabel?: boolean;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * HeatmapOverlay renders a color overlay showing engagement level.
 *
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <PersuasionBlock ... />
 *   <HeatmapOverlay level="hot" score={75} visible={showHeatmap} />
 * </div>
 * ```
 */
export function HeatmapOverlay({
  level,
  score,
  visible,
  showLabel = true,
  className,
}: HeatmapOverlayProps) {
  const color = getHeatColor(level);
  const label = getHeatLabel(level);
  const gradient = getHeatGradient(level);

  return (
    <div
      className={cn(
        // Positioning
        "absolute inset-0 z-10",
        // Pointer events - none so clicks pass through
        "pointer-events-none",
        // Opacity transition per UI-SPEC: 280ms
        "transition-opacity duration-[280ms]",
        // Visibility
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        background: gradient,
      }}
      aria-hidden="true"
    >
      {/* Label badge */}
      {showLabel && visible && (
        <div
          className={cn(
            "absolute top-2 right-2",
            "px-2 py-0.5",
            "rounded-full",
            "text-[11px] font-medium",
            "backdrop-blur-sm",
            // Heat level-specific styling
            level === "cold" && "bg-gray-100/80 text-gray-600",
            level === "cool" && "bg-amber-100/80 text-amber-700",
            level === "warm" && "bg-orange-100/80 text-orange-700",
            level === "hot" && "bg-red-100/80 text-red-700",
            level === "very_hot" && "bg-red-200/80 text-red-800"
          )}
        >
          {label}
        </div>
      )}

      {/* Score indicator */}
      {visible && (
        <div
          className={cn(
            "absolute bottom-2 right-2",
            "w-8 h-8",
            "flex items-center justify-center",
            "rounded-full",
            "backdrop-blur-sm",
            "text-xs font-semibold",
            // Heat level-specific styling
            level === "cold" && "bg-gray-100/80 text-gray-600",
            level === "cool" && "bg-amber-100/80 text-amber-700",
            level === "warm" && "bg-orange-100/80 text-orange-700",
            level === "hot" && "bg-red-100/80 text-red-700",
            level === "very_hot" && "bg-red-200/80 text-red-800"
          )}
        >
          {score}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BlockAnalytics wrapper (for convenience)
// =============================================================================

export interface BlockAnalyticsDisplayProps {
  /** Block ID */
  blockId: string;
  /** Heat level */
  level: HeatLevel;
  /** Engagement score (0-100) */
  score: number;
  /** Number of impressions */
  impressions: number;
  /** Average dwell time in ms */
  avgDwellMs: number;
  /** Correlation with wins (-1 to 1) */
  correlation?: number;
  /** Additional class names */
  className?: string;
}

/**
 * BlockAnalytics displays detailed analytics for a block.
 *
 * Used in analytics panel, not as overlay.
 */
export function BlockAnalyticsDisplay({
  blockId,
  level,
  score,
  impressions,
  avgDwellMs,
  correlation,
  className,
}: BlockAnalyticsDisplayProps) {
  const label = getHeatLabel(level);

  // Format dwell time
  const dwellSeconds = Math.round(avgDwellMs / 1000);
  const dwellDisplay = dwellSeconds >= 60
    ? `${Math.floor(dwellSeconds / 60)}m ${dwellSeconds % 60}s`
    : `${dwellSeconds}s`;

  // Format correlation
  const correlationDisplay = correlation !== undefined
    ? `${correlation >= 0 ? "+" : ""}${(correlation * 100).toFixed(0)}%`
    : "N/A";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3",
        "rounded-lg border",
        "bg-surface",
        className
      )}
    >
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-2">{label}</span>
        <div
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-semibold",
            level === "cold" && "bg-gray-100 text-gray-600",
            level === "cool" && "bg-amber-100 text-amber-700",
            level === "warm" && "bg-orange-100 text-orange-700",
            level === "hot" && "bg-red-100 text-red-700",
            level === "very_hot" && "bg-red-200 text-red-800"
          )}
        >
          {score}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold text-text-1">
            {impressions.toLocaleString()}
          </div>
          <div className="text-[11px] text-text-3">Views</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-text-1">{dwellDisplay}</div>
          <div className="text-[11px] text-text-3">Avg. Time</div>
        </div>
        <div>
          <div
            className={cn(
              "text-lg font-semibold",
              correlation !== undefined && correlation > 0 && "text-success",
              correlation !== undefined && correlation < 0 && "text-error",
              (correlation === undefined || correlation === 0) && "text-text-3"
            )}
          >
            {correlationDisplay}
          </div>
          <div className="text-[11px] text-text-3">Win Corr.</div>
        </div>
      </div>
    </div>
  );
}

export default HeatmapOverlay;
