"use client";

/**
 * ScoreExplanation Component
 * Phase 85-01 Task 2: Score breakdown popover
 *
 * Shows a detailed breakdown of why a keyword received its score.
 * Displays component scores, priority boost, and quick win bonus.
 */

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Badge,
  Separator,
} from "@tevero/ui";

import {
  translations,
  getRelevanceLevel,
  getVolumeLevel,
  getGeoLevel,
  getFunnelExplanation,
  formatPriorityBoost,
  formatQuickWin,
  type Locale,
} from "./ScoreExplanationTranslations";

export interface ScoreBreakdown {
  /** Relevance score 0-1 */
  relevance: number;
  /** Funnel confidence 0-1 */
  funnelConfidence: number;
  /** Funnel stage */
  funnelStage: "BOFU" | "MOFU" | "TOFU";
  /** Geo score 0-1 */
  geoScore: number;
  /** Geo match city name */
  geoMatch: string;
  /** Normalized volume 0-1 */
  volumeNormalized: number;
  /** Raw volume */
  volume: number;
  /** Base score before multipliers */
  baseScore: number;
  /** Priority multiplier 1.0-2.0 */
  priorityMultiplier: number;
  /** Priority category if matched */
  priorityCategory?: string;
  /** Quick win bonus 0-0.2 */
  quickWinBonus: number;
  /** Current position if ranking */
  position?: number;
  /** Final calculated score */
  finalScore: number;
}

export interface ScoreExplanationProps {
  breakdown: ScoreBreakdown;
  locale?: Locale;
  children: React.ReactNode;
}

/**
 * ScoreExplanation popover showing detailed score breakdown.
 *
 * Usage:
 * ```tsx
 * <ScoreExplanation breakdown={breakdown}>
 *   <button>{score.toFixed(2)}</button>
 * </ScoreExplanation>
 * ```
 */
export function ScoreExplanation({
  breakdown,
  locale = "en",
  children,
}: ScoreExplanationProps) {
  const t = translations[locale];

  // Calculate contribution percentages for display
  const relevanceContrib = breakdown.relevance * 0.4;
  const funnelContrib = breakdown.funnelConfidence * 0.3;
  const geoContrib = breakdown.geoScore * 0.2;
  const volumeContrib = breakdown.volumeNormalized * 0.1;

  return (
    <Popover>
      <PopoverTrigger asChild aria-haspopup="dialog">
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        aria-label={t.title}
      >
        <div className="p-4">
          {/* Header */}
          <h3 className="font-medium text-[var(--text-1)] mb-3">{t.title}</h3>

          {/* Component scores table */}
          <div className="space-y-2 text-sm">
            {/* Table header */}
            <div className="flex items-center text-[var(--text-3)] text-xs-safe uppercase tracking-wider">
              <span className="flex-1">{t.factor}</span>
              <span className="w-16 text-right">{t.value}</span>
              <span className="w-16 text-right">{t.contribution}</span>
            </div>

            <Separator />

            {/* Relevance */}
            <ScoreRow
              label={t.relevance.label}
              value={`${Math.round(breakdown.relevance * 100)}%`}
              contribution={`+${relevanceContrib.toFixed(2)}`}
              explanation={getRelevanceLevel(locale, breakdown.relevance)}
            />

            {/* Funnel Stage */}
            <ScoreRow
              label={t.funnel.label}
              value={
                <Badge variant="secondary" className="text-xs-safe">
                  {breakdown.funnelStage}
                </Badge>
              }
              contribution={`+${funnelContrib.toFixed(2)}`}
              explanation={getFunnelExplanation(locale, breakdown.funnelStage)}
            />

            {/* Geo Match */}
            <ScoreRow
              label={t.geo.label}
              value={breakdown.geoMatch || "-"}
              contribution={`+${geoContrib.toFixed(2)}`}
              explanation={getGeoLevel(locale, breakdown.geoScore)}
            />

            {/* Volume */}
            <ScoreRow
              label={t.volume.label}
              value={String(breakdown.volume)}
              contribution={`+${volumeContrib.toFixed(2)}`}
              explanation={getVolumeLevel(locale, breakdown.volume)}
            />

            <Separator />

            {/* Base Score */}
            <div className="flex items-center py-1">
              <span className="flex-1 font-medium">{t.baseScore}</span>
              <span className="w-32 text-right font-mono">
                {breakdown.baseScore.toFixed(2)}
              </span>
            </div>

            {/* Priority Boost (only if > 1.0) */}
            {breakdown.priorityMultiplier > 1.0 && (
              <div className="flex items-center py-1">
                <span className="flex-1">{t.priorityBoost.label}</span>
                <span className="w-32 text-right">
                  <span className="font-mono text-[var(--accent)]">
                    x{breakdown.priorityMultiplier.toFixed(1)}
                  </span>
                  {breakdown.priorityCategory && (
                    <span className="text-[var(--text-3)] text-xs-safe ml-1">
                      ({breakdown.priorityCategory})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Quick Win Bonus (only if > 0) */}
            {breakdown.quickWinBonus > 0 && (
              <div className="flex items-center py-1">
                <span className="flex-1">{t.quickWin.label}</span>
                <span className="w-32 text-right">
                  <span className="font-mono text-[var(--success)]">
                    +{breakdown.quickWinBonus.toFixed(2)}
                  </span>
                  {breakdown.position && (
                    <span className="text-[var(--text-3)] text-xs-safe ml-1">
                      (pos {breakdown.position})
                    </span>
                  )}
                </span>
              </div>
            )}

            <Separator />

            {/* Final Score */}
            <div className="flex items-center py-1">
              <span className="flex-1 font-medium">{t.finalScore}</span>
              <span className="w-32 text-right font-mono text-lg font-semibold text-[var(--accent)]">
                {breakdown.finalScore.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Single score row with label, value, contribution, and explanation.
 */
interface ScoreRowProps {
  label: string;
  value: React.ReactNode;
  contribution: string;
  explanation: string;
}

function ScoreRow({ label, value, contribution, explanation }: ScoreRowProps) {
  return (
    <div className="py-1">
      <div className="flex items-center">
        <span className="flex-1">{label}</span>
        <span className="w-16 text-right">{value}</span>
        <span className="w-16 text-right font-mono text-[var(--success)]">
          {contribution}
        </span>
      </div>
      <div className="text-xs-safe text-[var(--text-3)] mt-0.5">{explanation}</div>
    </div>
  );
}
