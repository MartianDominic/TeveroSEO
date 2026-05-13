/**
 * SectionHeatmap Component
 * Phase 101: Document Management (D-04)
 *
 * PandaDoc-style visualization showing time spent per document section.
 * Uses design-system-v6 tokens for consistent styling.
 */
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface HeatmapSection {
  sectionId: string;
  sectionName: string;
  totalTimeMs: number;
  avgTimeMs: number;
  viewCount: number;
  avgScrollDepth: number | null;
}

interface SectionHeatmapProps {
  sections: HeatmapSection[];
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Map time percentage to a heat color.
 * Uses warm-to-hot gradient matching design-system-v6 accent palette.
 */
function getHeatColor(percentage: number): string {
  // Scale: 0% = cool (blue-gray), 100% = hot (orange)
  if (percentage >= 80) return "bg-orange-500";
  if (percentage >= 60) return "bg-amber-500";
  if (percentage >= 40) return "bg-yellow-500";
  if (percentage >= 20) return "bg-emerald-400";
  return "bg-slate-300";
}

function getHeatOpacity(percentage: number): string {
  // Higher engagement = more opacity
  if (percentage >= 80) return "opacity-100";
  if (percentage >= 60) return "opacity-90";
  if (percentage >= 40) return "opacity-80";
  if (percentage >= 20) return "opacity-70";
  return "opacity-60";
}

// ============================================================================
// Component
// ============================================================================

export function SectionHeatmap({ sections, className }: SectionHeatmapProps) {
  // Calculate max time for relative scaling
  const maxTime = useMemo(() => {
    return Math.max(...sections.map((s) => s.totalTimeMs), 1);
  }, [sections]);

  // Sort by total time descending (most engaged at top)
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => b.totalTimeMs - a.totalTimeMs);
  }, [sections]);

  const totalTimeMs = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.totalTimeMs, 0);
  }, [sections]);

  if (sections.length === 0) {
    return (
      <div className={cn("rounded-lg border border-hairline bg-surface p-6", className)}>
        <p className="text-sm text-text-3">No engagement data yet</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-hairline bg-surface", className)}>
      {/* Header */}
      <div className="border-b border-hairline-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium text-text-1">Section Engagement</h3>
          <span className="text-[13px] text-text-3">
            Total: {formatDuration(totalTimeMs)}
          </span>
        </div>
      </div>

      {/* Heatmap Bars */}
      <div className="divide-y divide-hairline-3">
        {sortedSections.map((section) => {
          const percentage = (section.totalTimeMs / maxTime) * 100;
          const heatColor = getHeatColor(percentage);
          const heatOpacity = getHeatOpacity(percentage);

          return (
            <div
              key={section.sectionId}
              className="group relative px-4 py-3 transition-colors hover:bg-surface-2"
            >
              {/* Section Info */}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-medium text-text-1 truncate pr-4">
                  {section.sectionName}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[13px] tabular-nums text-text-2">
                    {formatDuration(section.totalTimeMs)}
                  </span>
                  <span className="text-[12px] text-text-3">
                    {section.viewCount} view{section.viewCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Heat Bar */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                    heatColor,
                    heatOpacity
                  )}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>

              {/* Hover Stats (design-system-v6: hover-to-reveal) */}
              <div className="mt-2 hidden items-center gap-4 text-[12px] text-text-3 group-hover:flex">
                <span>Avg: {formatDuration(section.avgTimeMs)}</span>
                {section.avgScrollDepth !== null && (
                  <span>Scroll depth: {Math.round(section.avgScrollDepth)}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-hairline-2 px-4 py-3">
        <div className="flex items-center gap-4 text-[12px] text-text-3">
          <span className="font-medium">Engagement:</span>
          <div className="flex items-center gap-1">
            <div className="h-2 w-4 rounded bg-slate-300" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-4 rounded bg-emerald-400" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-4 rounded bg-amber-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-4 rounded bg-orange-500" />
            <span>Very High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
