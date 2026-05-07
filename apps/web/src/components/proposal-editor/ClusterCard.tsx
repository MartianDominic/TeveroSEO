/**
 * ClusterCard Component
 * Phase 86-07: Proposal Output + Editing UX
 *
 * Displays individual clusters ("growth areas") with:
 * - Tier badge (Pillar/Subtopic/Longtail)
 * - Funnel stage distribution with color coding
 * - Keyword count and total volume
 * - Expandable keyword list
 * - Remove cluster action
 *
 * Design System v6:
 * - Newsreader + Geist fonts
 * - Ghost-edge shadows (no solid borders on cards)
 * - 12px minimum text floor
 * - Hover-to-reveal patterns
 */

'use client';

import { forwardRef, useId } from 'react';
import { ChevronDown, ChevronUp, X, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ClusterKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  position?: number | null;
}

export interface ClusterCardProps {
  cluster: {
    id: string;
    labelLt: string;
    labelEn: string;
    tier: 'pillar' | 'subtopic' | 'longtail';
    keywords: ClusterKeyword[];
    funnelBreakdown: Record<'bofu' | 'mofu' | 'tofu', number>;
    totalVolume: number;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TIER_CONFIG = {
  pillar: {
    label: 'Pillar',
    className: 'bg-accent-soft text-accent-ink border-accent-line',
  },
  subtopic: {
    label: 'Subtopic',
    className: 'bg-info-soft text-info border-info/20',
  },
  longtail: {
    label: 'Longtail',
    className: 'bg-surface-2 text-text-2 border-hairline',
  },
} as const;

const FUNNEL_CONFIG = {
  bofu: {
    label: 'BOFU',
    color: 'bg-success',
    textColor: 'text-success',
    description: 'Buy-now intent',
  },
  mofu: {
    label: 'MOFU',
    color: 'bg-info',
    textColor: 'text-info',
    description: 'Comparison stage',
  },
  tofu: {
    label: 'TOFU',
    color: 'bg-warning',
    textColor: 'text-warning',
    description: 'Awareness stage',
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a keyword is a "quick-win" (position 11-50 = striking distance)
 */
function isQuickWin(position: number | null | undefined): boolean {
  return position !== null && position !== undefined && position >= 11 && position <= 50;
}

/**
 * Format volume with K/M suffixes
 */
function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`;
  }
  return volume.toString();
}

/**
 * Get difficulty color based on score
 */
function getDifficultyColor(difficulty: number): string {
  if (difficulty < 30) return 'text-success';
  if (difficulty < 70) return 'text-warning';
  return 'text-error';
}

// ============================================================================
// Sub-components
// ============================================================================

interface TierBadgeProps {
  tier: 'pillar' | 'subtopic' | 'longtail';
}

function TierBadge({ tier }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5',
        'text-[12px] font-medium tracking-wide',
        'border',
        config.className
      )}
      style={{ fontVariantCaps: 'all-small-caps' }}
    >
      {config.label}
    </span>
  );
}

interface FunnelDistributionProps {
  breakdown: Record<'bofu' | 'mofu' | 'tofu', number>;
  total: number;
}

function FunnelDistribution({ breakdown, total }: FunnelDistributionProps) {
  if (total === 0) return null;

  const segments = (['bofu', 'mofu', 'tofu'] as const).map((stage) => ({
    stage,
    count: breakdown[stage],
    percentage: (breakdown[stage] / total) * 100,
    config: FUNNEL_CONFIG[stage],
  }));

  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label="Funnel stage distribution"
      >
        {segments.map(
          ({ stage, percentage, config }) =>
            percentage > 0 && (
              <div
                key={stage}
                className={cn('h-full transition-all', config.color)}
                style={{ width: `${percentage}%` }}
              />
            )
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[12px]">
        {segments.map(
          ({ stage, count, config }) =>
            count > 0 && (
              <span key={stage} className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', config.color)} />
                <span className={cn('font-medium', config.textColor)}>
                  {config.label}
                </span>
                <span className="text-text-3">{count}</span>
              </span>
            )
        )}
      </div>
    </div>
  );
}

interface KeywordRowProps {
  keyword: ClusterKeyword;
  index: number;
}

function KeywordRow({ keyword, index }: KeywordRowProps) {
  const quickWin = isQuickWin(keyword.position);
  const funnelConfig = FUNNEL_CONFIG[keyword.funnelStage];

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_auto_auto] items-center gap-3',
        'px-3 py-2',
        'border-b border-hairline-3 last:border-b-0',
        'transition-colors duration-[160ms]',
        'hover:bg-surface-2'
      )}
      role="row"
      aria-rowindex={index + 1}
    >
      {/* Keyword text */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="truncate text-[14px] text-text-2"
          title={keyword.keyword}
        >
          {keyword.keyword}
        </span>
        {quickWin && (
          <Badge
            variant="secondary"
            className={cn(
              'flex-shrink-0 gap-1 px-1.5 py-0',
              'bg-warning-soft text-warning border-warning/20',
              'text-[12px]'
            )}
          >
            <Zap className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Quick win - </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              #{keyword.position}
            </span>
          </Badge>
        )}
      </div>

      {/* Volume */}
      <span
        className="text-[13px] text-text-3 tabular-nums"
        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
      >
        {formatVolume(keyword.volume)}
      </span>

      {/* Difficulty */}
      <span
        className={cn(
          'text-[13px] tabular-nums font-medium',
          getDifficultyColor(keyword.difficulty)
        )}
        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        title={`Keyword difficulty: ${keyword.difficulty}`}
      >
        KD {keyword.difficulty}
      </span>

      {/* Funnel badge */}
      <span
        className={cn(
          'inline-flex items-center rounded px-1.5 py-0.5',
          'text-[12px] font-medium',
          'bg-surface-2',
          funnelConfig.textColor
        )}
        style={{ fontVariantCaps: 'all-small-caps' }}
      >
        {funnelConfig.label}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const ClusterCard = forwardRef<HTMLDivElement, ClusterCardProps>(
  function ClusterCard(
    { cluster, isExpanded, onToggleExpand, onRemove, disabled = false },
    ref
  ) {
    const headingId = useId();
    const contentId = useId();
    const keywordCount = cluster.keywords.length;
    const quickWinCount = cluster.keywords.filter((k) =>
      isQuickWin(k.position)
    ).length;

    return (
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand} asChild>
        <article
          ref={ref}
          className={cn(
            // Card base - ghost-edge shadows per design-system-v6
            'bg-surface rounded-xl overflow-hidden',
            'shadow-card',
            'transition-[box-shadow,transform] duration-[280ms]',
            'ease-[cubic-bezier(0.16,1,0.3,1)]',
            // Hover lift
            'hover:shadow-lift hover:-translate-y-px',
            // Disabled state
            disabled && 'opacity-50 pointer-events-none'
          )}
          aria-labelledby={headingId}
        >
          {/* Card header */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3 mb-3">
              {/* Title + tier */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TierBadge tier={cluster.tier} />
                  {quickWinCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-warning-soft text-warning text-[12px] px-1.5 py-0"
                    >
                      <Zap className="h-3 w-3 mr-0.5" aria-hidden="true" />
                      {quickWinCount} quick-win{quickWinCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <h3
                  id={headingId}
                  className="text-[15px] font-medium text-text-1 leading-snug tracking-[-0.005em]"
                >
                  {cluster.labelLt}
                </h3>
                {cluster.labelEn !== cluster.labelLt && (
                  <p className="text-[13px] text-text-3 mt-0.5 italic">
                    {cluster.labelEn}
                  </p>
                )}
              </div>

              {/* Remove button - hover-to-reveal */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 flex-shrink-0',
                  'opacity-0 group-hover:opacity-100',
                  'transition-opacity duration-[240ms]',
                  'text-text-3 hover:text-error hover:bg-error-soft',
                  'focus-visible:opacity-100'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                disabled={disabled}
                aria-label={`Remove ${cluster.labelLt} cluster`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-[13px] text-text-3 mb-3">
              <span>
                <span
                  className="font-medium text-text-2 tabular-nums"
                  style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
                >
                  {keywordCount}
                </span>{' '}
                keyword{keywordCount !== 1 ? 's' : ''}
              </span>
              <span className="text-text-4">|</span>
              <span>
                <span
                  className="font-medium text-text-2 tabular-nums"
                  style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
                >
                  {formatVolume(cluster.totalVolume)}
                </span>{' '}
                monthly
              </span>
            </div>

            {/* Funnel distribution */}
            <FunnelDistribution
              breakdown={cluster.funnelBreakdown}
              total={keywordCount}
            />
          </div>

          {/* Expand/collapse trigger */}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                'w-full flex items-center justify-center gap-1.5',
                'px-4 py-2.5',
                'bg-surface-2 border-t border-hairline-2',
                'text-[13px] font-medium text-text-3',
                'transition-colors duration-[160ms]',
                'hover:bg-surface-3 hover:text-text-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset'
              )}
              aria-expanded={isExpanded}
              aria-controls={contentId}
              disabled={disabled}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  <span>Hide keywords</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  <span>Show {keywordCount} keywords</span>
                </>
              )}
            </button>
          </CollapsibleTrigger>

          {/* Expandable keyword list */}
          <CollapsibleContent id={contentId}>
            <div
              className="border-t border-hairline-2 max-h-[320px] overflow-y-auto"
              role="table"
              aria-label={`Keywords in ${cluster.labelLt}`}
            >
              <div role="rowgroup">
                {cluster.keywords.map((keyword, index) => (
                  <KeywordRow
                    key={keyword.keyword}
                    keyword={keyword}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </article>
      </Collapsible>
    );
  }
);

ClusterCard.displayName = 'ClusterCard';

export default ClusterCard;
