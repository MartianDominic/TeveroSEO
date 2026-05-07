"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import type { ArticlePipelineStage } from "./types";

// ---------------------------------------------------------------------------
// Pipeline Stage Configuration
// ---------------------------------------------------------------------------

const PIPELINE_STAGES: ArticlePipelineStage[] = [
  "research",
  "writing",
  "images",
  "links",
  "review",
  "complete",
];

const STAGE_LABELS: Record<ArticlePipelineStage, string> = {
  research: "Research",
  writing: "Write",
  images: "Images",
  links: "Links",
  review: "Review",
  complete: "Published",
};

// ---------------------------------------------------------------------------
// PipelineProgress
// ---------------------------------------------------------------------------

export interface PipelineProgressProps {
  /** Current pipeline stage */
  currentStage: ArticlePipelineStage;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Show stage labels */
  showLabels?: boolean;
  /** Compact mode (single bar) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * PipelineProgress shows the article's position in the content pipeline.
 *
 * Visual pattern:
 * - Segmented progress bar with stage markers
 * - Filled segments for completed stages
 * - Current stage partially filled based on progress
 * - Upcoming stages empty
 *
 * @example
 * <PipelineProgress currentStage="writing" progress={60} />
 * <PipelineProgress currentStage="images" compact />
 */
export function PipelineProgress({
  currentStage,
  progress = 0,
  showLabels = false,
  compact = false,
  className,
}: PipelineProgressProps) {
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);
  const totalStages = PIPELINE_STAGES.length;

  // Calculate overall progress
  const stageProgress = currentIndex / totalStages;
  const withinStageProgress = progress / 100 / totalStages;
  const overallProgress = Math.min(
    (stageProgress + withinStageProgress) * 100,
    100
  );

  if (compact) {
    return (
      <div className={cn("relative", className)}>
        {/* Track */}
        <div className="h-1 w-full rounded-full bg-surface-3" />

        {/* Fill */}
        <div
          className="absolute top-0 left-0 h-1 rounded-full bg-accent transition-all duration-300"
          style={{ width: `${overallProgress}%` }}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Segmented progress bar */}
      <div className="flex gap-0.5">
        {PIPELINE_STAGES.map((stage, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div
              key={stage}
              className={cn(
                "h-1 flex-1 rounded-sm transition-colors duration-200",
                // Complete stages
                isComplete && "bg-accent",
                // Current stage (partial fill)
                isCurrent && "relative bg-surface-3 overflow-hidden",
                // Upcoming stages
                isUpcoming && "bg-surface-3"
              )}
            >
              {/* Partial fill for current stage */}
              {isCurrent && (
                <div
                  className="absolute inset-y-0 left-0 bg-accent-tint transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage labels */}
      {showLabels && (
        <div className="flex justify-between">
          {PIPELINE_STAGES.map((stage, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <span
                key={stage}
                className={cn(
                  "text-[11px] tracking-[0.04em]",
                  "[font-variant-caps:all-small-caps]",
                  // Styling based on state
                  isComplete && "text-accent font-medium",
                  isCurrent && "text-text-1 font-medium",
                  !isComplete && !isCurrent && "text-text-4"
                )}
              >
                {STAGE_LABELS[stage]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PipelineProgressInline
// ---------------------------------------------------------------------------

export interface PipelineProgressInlineProps {
  /** Current pipeline stage */
  currentStage: ArticlePipelineStage;
  /** Additional class names */
  className?: string;
}

/**
 * PipelineProgressInline shows a compact text representation of pipeline progress.
 *
 * @example
 * <PipelineProgressInline currentStage="images" />
 * // Renders: "Research -> Write -> Images -> Links"
 */
export function PipelineProgressInline({
  currentStage,
  className,
}: PipelineProgressInlineProps) {
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[12px] text-text-3",
        className
      )}
    >
      {PIPELINE_STAGES.slice(0, -1).map((stage, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={stage}>
            <span
              className={cn(
                isComplete && "text-accent",
                isCurrent && "text-text-1 font-medium"
              )}
            >
              {STAGE_LABELS[stage]}
            </span>
            {index < PIPELINE_STAGES.length - 2 && (
              <span className="text-text-4">-&gt;</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
