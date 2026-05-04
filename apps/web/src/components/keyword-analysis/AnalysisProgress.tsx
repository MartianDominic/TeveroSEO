"use client";

/**
 * AnalysisProgress Component
 * Phase 82: Chat Integration
 *
 * Shows real-time progress during keyword analysis.
 * Displays current stage, progress bar, and partial results.
 */

import { ProgressBar } from "@tevero/ui";
import {
  CheckCircle2,
  Loader2,
  Target,
  MapPin,
  Filter,
  Sparkles,
  Layers,
} from "lucide-react";
import type { AnalysisStage, AnalysisResult } from "@/lib/keyword-chat/types";

interface AnalysisProgressProps {
  stage: AnalysisStage;
  progress: number;
  message?: string;
  partials: Partial<AnalysisResult>[];
}

const STAGE_CONFIG: Record<
  AnalysisStage,
  { label: string; icon: typeof Loader2; description: string }
> = {
  idle: { label: "Ready", icon: Loader2, description: "Waiting to start" },
  extracting_constraints: {
    label: "Analyzing Conversation",
    icon: Target,
    description: "Extracting business context and constraints",
  },
  classifying_funnel: {
    label: "Classifying Funnel",
    icon: Layers,
    description: "Categorizing keywords by BOFU/MOFU/TOFU",
  },
  classifying_geo: {
    label: "Geographic Analysis",
    icon: MapPin,
    description: "Detecting city mentions and locations",
  },
  scoring_relevance: {
    label: "Scoring Relevance",
    icon: Target,
    description: "Computing relevance scores",
  },
  filtering: {
    label: "Applying Filters",
    icon: Filter,
    description: "Excluding keywords by constraints",
  },
  selecting: {
    label: "Cascade Selection",
    icon: Sparkles,
    description: "Selecting top keywords by funnel priority",
  },
  discovering_pseo: {
    label: "Detecting pSEO",
    icon: Sparkles,
    description: "Finding programmatic SEO opportunities",
  },
  discovering_side_keywords: {
    label: "Side Keywords",
    icon: Sparkles,
    description: "Discovering related keywords",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    description: "Analysis finished",
  },
};

export function AnalysisProgress({
  stage,
  progress,
  message,
  partials,
}: AnalysisProgressProps) {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;

  // Extract partial data for display
  const latestPartial = partials[partials.length - 1];
  const funnelBreakdown = latestPartial?.funnelBreakdown;
  const geoBreakdown = latestPartial?.geoBreakdown;
  const selectionBreakdown = latestPartial?.selection?.breakdown;

  return (
    <div className="space-y-4 p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--hairline)]">
      {/* Current stage */}
      <div className="flex items-center gap-3">
        {stage === "complete" ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
        ) : (
          <Icon className="h-5 w-5 animate-spin text-[var(--accent)]" />
        )}
        <div>
          <span className="font-medium">{config.label}</span>
          <p className="text-sm text-[var(--text-3)]">
            {message || config.description}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar value={progress} size="md" />

      {/* Partial results preview */}
      {partials.length > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[var(--hairline)]">
          {/* Funnel breakdown */}
          {funnelBreakdown && (
            <div className="text-sm">
              <span className="text-[var(--text-3)]">Funnel:</span>
              <div className="flex gap-2 mt-1">
                <span className="text-[var(--success)]">
                  BOFU: {funnelBreakdown.bofu}
                </span>
                <span className="text-[var(--warning)]">
                  MOFU: {funnelBreakdown.mofu}
                </span>
                <span className="text-[var(--info)]">
                  TOFU: {funnelBreakdown.tofu}
                </span>
              </div>
            </div>
          )}

          {/* Geo breakdown */}
          {geoBreakdown && (
            <div className="text-sm">
              <span className="text-[var(--text-3)]">Geo:</span>
              <div className="mt-1">
                {Object.entries(geoBreakdown.byCity)
                  .slice(0, 2)
                  .map(([city, count]) => (
                    <span key={city} className="mr-2">
                      {city}: {count}
                    </span>
                  ))}
                {geoBreakdown.generic > 0 && (
                  <span className="text-[var(--text-3)]">
                    Generic: {geoBreakdown.generic}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Selection preview */}
          {selectionBreakdown && (
            <div className="text-sm">
              <span className="text-[var(--text-3)]">Selected:</span>
              <div className="mt-1">
                <span className="font-medium text-[var(--accent)]">
                  {selectionBreakdown.total} keywords
                </span>
                <span className="text-[var(--text-3)] ml-2">
                  (avg: {selectionBreakdown.averageScore.toFixed(2)})
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
