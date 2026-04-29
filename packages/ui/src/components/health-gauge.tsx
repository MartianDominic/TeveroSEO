"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { NumRow } from "./numerals";

// ---------------------------------------------------------------------------
// HealthGaugeProps
// ---------------------------------------------------------------------------

export interface HealthGaugeProps {
  /** Score from 0-100 */
  score: number;
  /** Letter grade (auto-calculated if not provided) */
  grade?: string;
  /** Gauge size: sm=64px, md=96px, lg=128px */
  size?: "sm" | "md" | "lg";
  /** Whether to show the letter grade */
  showGrade?: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Size configurations
// ---------------------------------------------------------------------------

const SIZE_CONFIG = {
  sm: {
    viewBox: "0 0 64 64",
    cx: 32,
    cy: 32,
    r: 24,
    strokeWidth: 5,
    numClass: "text-[16px]",
    gradeClass: "text-[11px]",
    width: 64,
    height: 64,
  },
  md: {
    viewBox: "0 0 96 96",
    cx: 48,
    cy: 48,
    r: 38,
    strokeWidth: 7,
    numClass: "text-[length:var(--num-row)]",
    gradeClass: "text-[13px]",
    width: 96,
    height: 96,
  },
  lg: {
    viewBox: "0 0 128 128",
    cx: 64,
    cy: 64,
    r: 52,
    strokeWidth: 9,
    numClass: "text-[length:var(--num-card)]",
    gradeClass: "text-[16px]",
    width: 128,
    height: 128,
  },
} as const;

// ---------------------------------------------------------------------------
// Grade calculation
// ---------------------------------------------------------------------------

function calculateGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

// ---------------------------------------------------------------------------
// HealthGauge
// ---------------------------------------------------------------------------

/**
 * HealthGauge renders an SVG arc gauge showing a health score (0-100).
 *
 * Features:
 * - Three sizes: sm (64px), md (96px), lg (128px)
 * - Automatic grade calculation (A/B+/B/C/D)
 * - Accessible with role="img" and aria-label
 * - Uses v6 design tokens for colors
 *
 * @example
 * <HealthGauge score={85} size="md" showGrade />
 */
export function HealthGauge({
  score,
  grade,
  size = "md",
  showGrade = true,
  className,
}: HealthGaugeProps) {
  const config = SIZE_CONFIG[size];
  const computedGrade = grade ?? calculateGrade(score);

  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Calculate stroke-dasharray for the arc
  // Using pathLength trick: the arc has pathLength=239 (approx circumference percentage)
  // So dasharray of [score, 100] creates the fill effect
  const circumference = 2 * Math.PI * config.r;
  const arcLength = (clampedScore / 100) * circumference;
  const dashArray = `${arcLength} ${circumference}`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: config.width, height: config.height }}
    >
      <svg
        viewBox={config.viewBox}
        width={config.width}
        height={config.height}
        role="img"
        aria-label={`Health score: ${clampedScore}%`}
        className="transform -rotate-90"
      >
        {/* Track circle */}
        <circle
          cx={config.cx}
          cy={config.cy}
          r={config.r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={config.strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={config.cx}
          cy={config.cy}
          r={config.r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumRow value={clampedScore} className={config.numClass} />
        {showGrade && (
          <span
            className={cn(
              "font-display italic text-text-3 -mt-0.5",
              config.gradeClass
            )}
          >
            {computedGrade}
          </span>
        )}
      </div>
    </div>
  );
}

HealthGauge.displayName = "HealthGauge";
