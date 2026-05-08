/**
 * ClusterCard Component
 * Phase 86-10: Semantic Intelligence Integration
 *
 * Displays a single cluster (growth area) in the client portal.
 * Follows design-system-v6: ghost-edge shadows, Newsreader for numerals,
 * Geist for UI text, accessible keyboard navigation.
 */
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Badge,
  SegmentedProgressBar,
  type ProgressSegment,
} from "@tevero/ui";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { PortalCluster, PortalKeyword } from "@/types/portal";

/**
 * Props for the ClusterCard component
 */
export interface ClusterCardProps {
  /** Cluster data including keywords and progress metrics */
  cluster: PortalCluster;
  /** Whether the keyword list is expanded */
  isExpanded: boolean;
  /** Callback when expand/collapse is toggled */
  onToggleExpand: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tier badge configuration - v6 semantic colors
 */
const TIER_CONFIG: Record<
  PortalCluster["tier"],
  { label: string; variant: "default" | "info" | "muted" }
> = {
  pillar: {
    label: "Pillar",
    variant: "default", // accent-soft/accent
  },
  subtopic: {
    label: "Subtopic",
    variant: "info", // info-soft/info
  },
  longtail: {
    label: "Long-tail",
    variant: "muted", // surface-2/text-2
  },
};

/**
 * Funnel stage colors for the distribution bar - v6 semantic colors
 */
const FUNNEL_COLORS: Record<"bofu" | "mofu" | "tofu", string> = {
  bofu: "bg-success",
  mofu: "bg-info",
  tofu: "bg-accent",
};

/**
 * Status badge configuration for keyword rows - v6 semantic colors
 */
const STATUS_CONFIG: Record<
  PortalKeyword["status"],
  { label: string; variant: "success" | "warning" | "info" | "muted" }
> = {
  top10: {
    label: "Top 10",
    variant: "success",
  },
  top20: {
    label: "Top 20",
    variant: "warning",
  },
  progress: {
    label: "Moving",
    variant: "info",
  },
  pending: {
    label: "Pending",
    variant: "muted",
  },
};

/**
 * ClusterCard - Displays a growth area cluster with expandable keyword list
 */
export function ClusterCard({
  cluster,
  isExpanded,
  onToggleExpand,
  className,
}: ClusterCardProps) {
  const tierConfig = TIER_CONFIG[cluster.tier];
  const quickWinCount = cluster.quickWinCount ?? 0;

  // Calculate funnel distribution segments for progress bar
  const funnelSegments: ProgressSegment[] = React.useMemo(() => {
    const breakdown = cluster.funnelBreakdown;
    if (!breakdown) return [];

    const segments: ProgressSegment[] = [];
    if (breakdown.bofu > 0) {
      segments.push({
        id: "bofu",
        label: "BOFU",
        value: breakdown.bofu,
        color: FUNNEL_COLORS.bofu,
      });
    }
    if (breakdown.mofu > 0) {
      segments.push({
        id: "mofu",
        label: "MOFU",
        value: breakdown.mofu,
        color: FUNNEL_COLORS.mofu,
      });
    }
    if (breakdown.tofu > 0) {
      segments.push({
        id: "tofu",
        label: "TOFU",
        value: breakdown.tofu,
        color: FUNNEL_COLORS.tofu,
      });
    }
    return segments;
  }, [cluster.funnelBreakdown]);

  // Calculate progress percentage
  const hasPositions = cluster.keywords.some((k) => k.currentPosition !== null);
  const inTop10Count = cluster.progress?.inTop10 ?? 0;
  const totalKeywords = cluster.keywords.length;
  const progressPercent =
    totalKeywords > 0 ? Math.round((inTop10Count / totalKeywords) * 100) : 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div
        className={cn(
          // Base card styles with V6 ghost-edge shadow
          "bg-surface rounded-[var(--radius-card,12px)] overflow-hidden",
          "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Ghost-edge shadow system
          "shadow-[0_0_0_1px_rgba(20,20,26,0.045),0_1px_2px_rgba(20,20,26,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]",
          // Hover lift effect
          "hover:shadow-[0_0_0_1px_rgba(20,20,26,0.06),0_6px_16px_-4px_rgba(20,20,26,0.06),0_16px_40px_-16px_rgba(20,20,26,0.10),inset_0_1px_0_rgba(255,255,255,0.55)]",
          "hover:-translate-y-px",
          className
        )}
      >
        {/* Card Header - Trigger for expand/collapse */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full px-6 py-5 text-left",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              "transition-colors duration-[160ms]"
            )}
            aria-expanded={isExpanded}
            aria-controls={`cluster-content-${cluster.id}`}
          >
            {/* Top row: tier badge + label + quick wins + expand icon */}
            <div className="flex items-center gap-3">
              {/* Tier badge - v6 Badge component */}
              <Badge variant={tierConfig.variant} className="text-xs-safe">
                {tierConfig.label}
              </Badge>

              {/* Cluster label - Newsreader for editorial feel */}
              <h3 className="font-display text-[clamp(15px,1.1vw,16px)] font-medium text-text-1 flex-1">
                {cluster.label}
              </h3>

              {/* Quick-win count badge */}
              {quickWinCount > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5",
                    "bg-accent-soft text-accent rounded-full",
                    "text-[12px] font-medium"
                  )}
                  title={`${quickWinCount} quick-win opportunities`}
                >
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  {quickWinCount}
                </span>
              )}

              {/* Chevron icon with rotation animation */}
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-text-3 transition-transform duration-[280ms] flex-shrink-0",
                  isExpanded && "rotate-180"
                )}
                aria-hidden="true"
              />
            </div>

            {/* Middle row: keyword count + volume + funnel distribution */}
            <div className="mt-4 flex items-center gap-6">
              {/* Keyword count & volume */}
              <div className="flex items-baseline gap-4">
                <div className="text-right">
                  <span className="font-display text-[clamp(20px,1.7vw,26px)] font-normal text-text-1 tabular-nums">
                    {totalKeywords}
                  </span>
                  <span className="ml-1 text-[13px] text-text-3">keywords</span>
                </div>
                <div className="h-4 w-px bg-hairline-2" aria-hidden="true" />
                <div className="text-right">
                  <span className="font-display text-[clamp(20px,1.7vw,26px)] font-normal text-text-1 tabular-nums">
                    {cluster.totalVolume.toLocaleString()}
                  </span>
                  <span className="ml-1 text-[13px] text-text-3">volume</span>
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Progress indicator (if positions available) */}
              {hasPositions && (
                <div className="text-right">
                  <span className="font-display text-[clamp(24px,2vw,30px)] font-normal text-text-1 tabular-nums">
                    {inTop10Count}
                  </span>
                  <span className="text-[13px] text-text-3">
                    /{totalKeywords} in Top 10
                  </span>
                </div>
              )}
            </div>

            {/* Funnel distribution bar */}
            {funnelSegments.length > 0 && (
              <div className="mt-4">
                <SegmentedProgressBar
                  segments={funnelSegments}
                  showLabels
                  size="sm"
                />
              </div>
            )}

            {/* Progress bar (shown if there are positions) */}
            {hasPositions && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-text-3 uppercase tracking-[0.1em]">
                    Progress
                  </span>
                  <span className="text-[13px] text-text-2 font-medium tabular-nums">
                    {progressPercent}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-[280ms]"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${progressPercent}% of keywords in top 10`}
                  />
                </div>
              </div>
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expandable keyword list */}
        <CollapsibleContent id={`cluster-content-${cluster.id}`}>
          <div className="border-t border-hairline-2">
            {/* Table header */}
            <div
              className={cn(
                "px-6 py-3 bg-surface-2",
                "grid grid-cols-[2fr_0.7fr_0.8fr_0.6fr] gap-4",
                "text-[12px] font-medium text-text-3 uppercase tracking-[0.1em]"
              )}
              role="row"
              aria-hidden="true"
            >
              <div>Keyword</div>
              <div className="text-right">Volume</div>
              <div className="text-right">Position</div>
              <div className="text-right">Status</div>
            </div>

            {/* Keyword rows */}
            <ul
              role="list"
              className="divide-y divide-hairline-3"
              aria-label={`Keywords in ${cluster.label} cluster`}
            >
              {cluster.keywords.map((keyword) => (
                <KeywordRow key={keyword.id} keyword={keyword} />
              ))}
            </ul>

            {/* Empty state */}
            {cluster.keywords.length === 0 && (
              <div className="px-6 py-8 text-center text-[14px] text-text-3">
                No keywords in this cluster yet.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * KeywordRow - Individual keyword row in the expanded list
 */
interface KeywordRowProps {
  keyword: PortalKeyword;
}

function KeywordRow({ keyword }: KeywordRowProps) {
  const statusConfig = STATUS_CONFIG[keyword.status];
  const hasPosition = keyword.currentPosition !== null;
  const positionChange = keyword.positionChange;

  return (
    <li
      className={cn(
        "px-6 py-3.5",
        "grid grid-cols-[2fr_0.7fr_0.8fr_0.6fr] gap-4 items-center",
        "transition-colors duration-[160ms]",
        "hover:bg-surface-2"
      )}
      role="listitem"
    >
      {/* Keyword text */}
      <div
        className="font-sans text-[14px] text-text-1 truncate"
        title={keyword.keyword}
      >
        {keyword.keyword}
      </div>

      {/* Volume */}
      <div className="text-right font-sans text-[14px] text-text-2 tabular-nums">
        {keyword.volume.toLocaleString()}
      </div>

      {/* Position with change indicator */}
      <div className="text-right flex items-center justify-end gap-1.5">
        {hasPosition ? (
          <>
            <span className="font-display text-[clamp(15px,1.2vw,18px)] font-normal text-text-1 tabular-nums">
              #{keyword.currentPosition}
            </span>
            {positionChange !== null && positionChange !== 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[13px] font-medium tabular-nums",
                  positionChange > 0 ? "text-success" : "text-error"
                )}
                title={
                  positionChange > 0
                    ? `Improved ${positionChange} positions`
                    : `Dropped ${Math.abs(positionChange)} positions`
                }
              >
                {positionChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span aria-label={positionChange > 0 ? "improved by" : "dropped by"}>
                  {positionChange > 0 ? "+" : ""}
                  {positionChange}
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="text-[14px] text-text-4">-</span>
        )}
      </div>

      {/* Status badge - v6 Badge component */}
      <div className="text-right">
        <Badge variant={statusConfig.variant} className="text-xs-safe">
          {statusConfig.label}
        </Badge>
      </div>
    </li>
  );
}

ClusterCard.displayName = "ClusterCard";
