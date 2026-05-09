"use client";

/**
 * AnalysisResults Component
 * Phase 82: Chat Integration
 * Phase 85-01: Score explanation popover integration
 *
 * Displays complete analysis results with stats, breakdowns, and export actions.
 */

import { Clock, Target, Filter, Layers, Sparkles } from "lucide-react";

import type { AnalysisResult, SelectedKeyword } from "@/lib/keyword-chat/types";

import { Card, Badge } from "@tevero/ui";

import { ExportActions } from "./ExportActions";
import { ScoreExplanation, type ScoreBreakdown } from "./ScoreExplanation";


interface AnalysisResultsProps {
  result: AnalysisResult;
  locale?: "en" | "lt";
  onRefine?: (refinement: string) => void;
}

/**
 * Build score breakdown from available keyword data.
 * Some fields are estimated from available data when detailed breakdown isn't provided.
 */
function buildScoreBreakdown(kw: SelectedKeyword): ScoreBreakdown {
  // Use available data, estimate missing values from composite score
  const baseScore = kw.compositeScore > 1 ? kw.compositeScore / 1.5 : kw.compositeScore;

  return {
    // Estimated component scores (will be replaced when API provides detailed breakdown)
    relevance: 0.7, // Placeholder - keywords passed filtering so relevance is decent
    funnelConfidence: kw.funnelStage === "BOFU" ? 0.9 : kw.funnelStage === "MOFU" ? 0.6 : 0.3,
    funnelStage: kw.funnelStage,
    geoScore: 0.8, // Placeholder - passed geo filter
    geoMatch: "", // Not available in current API
    volumeNormalized: Math.min(1, Math.log10(Math.max(1, kw.metrics.volume)) / 4),
    volume: kw.metrics.volume,
    baseScore: Math.min(1, baseScore),
    priorityMultiplier: kw.compositeScore > 1 ? 1.5 : 1.0, // Infer from high scores
    priorityCategory: kw.compositeScore > 1 ? "priority" : undefined,
    quickWinBonus: 0, // Not available in current API
    position: undefined, // Not available in current API
    finalScore: kw.compositeScore,
  };
}

export function AnalysisResults({ result, locale = "en", onRefine }: AnalysisResultsProps) {
  const {
    stats,
    constraints,
    selection,
    filtering,
    pseoOpportunities,
    sideKeywords,
  } = result;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Analyzed" value={stats.totalKeywords} />
        <StatCard
          icon={Sparkles}
          label="Selected"
          value={stats.selectedCount}
          color="success"
        />
        <StatCard
          icon={Filter}
          label="Excluded"
          value={stats.excludedCount}
          color="warning"
        />
        <StatCard
          icon={Clock}
          label="Time"
          value={`${(stats.processingTimeMs / 1000).toFixed(1)}s`}
        />
      </div>

      {/* Constraints summary */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Extracted Constraints</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--text-3)]">Business:</span>{" "}
            {constraints.businessType} - {constraints.coreOffering}
          </div>
          <div>
            <span className="text-[var(--text-3)]">Audience:</span>{" "}
            <Badge
              variant={
                constraints.audienceType === "B2B" ? "secondary" : "default"
              }
            >
              {constraints.audienceType}
            </Badge>
          </div>
          <div>
            <span className="text-[var(--text-3)]">Geo Scope:</span>{" "}
            {constraints.geoConstraints.scope}
            {constraints.geoConstraints.includeCities.length > 0 && (
              <span className="text-[var(--text-3)] ml-1">
                ({constraints.geoConstraints.includeCities.join(", ")})
              </span>
            )}
          </div>
          <div>
            <span className="text-[var(--text-3)]">Funnel Focus:</span>{" "}
            {constraints.funnelPreference}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-[var(--text-3)]">Confidence:</span>
          <div className="flex-1 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--success)]"
              style={{ width: `${constraints.confidence * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium">
            {(constraints.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </Card>

      {/* Funnel breakdown */}
      <Card className="p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Funnel Breakdown
        </h3>
        <div className="flex gap-4">
          <FunnelBar
            label="BOFU"
            count={selection.breakdown.byStage.bofu}
            total={selection.breakdown.total}
            color="bg-[var(--success)]"
          />
          <FunnelBar
            label="MOFU"
            count={selection.breakdown.byStage.mofu}
            total={selection.breakdown.total}
            color="bg-[var(--warning)]"
          />
          <FunnelBar
            label="TOFU"
            count={selection.breakdown.byStage.tofu}
            total={selection.breakdown.total}
            color="bg-[var(--info)]"
          />
        </div>
      </Card>

      {/* pSEO opportunities */}
      {pseoOpportunities.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            pSEO Opportunities ({pseoOpportunities.length})
          </h3>
          <div className="space-y-2">
            {pseoOpportunities.slice(0, 5).map((opp, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-mono">{opp.pattern}</span>
                  <span className="text-[var(--text-3)] ml-2">
                    {opp.template}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[var(--accent)]">
                    {opp.estimatedPages} pages
                  </span>
                  <span className="text-[var(--text-3)] ml-2">
                    {opp.totalVolume} vol
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Side keywords */}
      {sideKeywords.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">
            Side Keywords ({sideKeywords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {sideKeywords.slice(0, 10).map((kw, i) => (
              <Badge key={i} variant="outline">
                {kw.keyword}
                {kw.volume && (
                  <span className="ml-1 text-[var(--text-3)]">{kw.volume}</span>
                )}
              </Badge>
            ))}
            {sideKeywords.length > 10 && (
              <Badge variant="outline" className="text-[var(--text-3)]">
                +{sideKeywords.length - 10} more
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Top selected keywords preview */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Top Selected Keywords</h3>
        <div className="space-y-1">
          {selection.selected.slice(0, 10).map((kw, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm py-1 border-b border-[var(--hairline)] last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-3)] w-6">
                  #{kw.cascadePosition}
                </span>
                <span>{kw.keyword}</span>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-3)]">
                <Badge
                  variant={
                    kw.funnelStage === "BOFU"
                      ? "default"
                      : kw.funnelStage === "MOFU"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs-safe"
                >
                  {kw.funnelStage}
                </Badge>
                <span>{kw.metrics.volume} vol</span>
                <ScoreExplanation
                  breakdown={buildScoreBreakdown(kw)}
                  locale={locale}
                >
                  <button
                    className="cursor-pointer hover:underline hover:text-[var(--accent)] transition-colors font-mono"
                    aria-label={`Score ${kw.compositeScore.toFixed(2)}, click for breakdown`}
                  >
                    {kw.compositeScore.toFixed(2)}
                  </button>
                </ScoreExplanation>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Export actions */}
      <div className="pt-4 border-t border-[var(--hairline)]">
        <ExportActions result={result} />
      </div>

      {/* Refine prompt (optional) */}
      {onRefine && (
        <div className="pt-4 text-sm text-[var(--text-3)]">
          Want to adjust the analysis? Ask a follow-up question to refine the
          constraints.
        </div>
      )}
    </div>
  );
}

// Helper components

interface StatCardProps {
  icon: typeof Target;
  label: string;
  value: string | number;
  color?: "success" | "warning" | "default";
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "default",
}: StatCardProps) {
  const colorClass =
    color === "success"
      ? "text-[var(--success)]"
      : color === "warning"
        ? "text-[var(--warning)]"
        : "text-[var(--text-1)]";

  return (
    <div className="p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--hairline)]">
      <div className="flex items-center gap-2 text-[var(--text-3)] text-sm">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${colorClass}`}>{value}</div>
    </div>
  );
}

interface FunnelBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function FunnelBar({ label, count, total, color }: FunnelBarProps) {
  const percent = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex-1">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-[var(--text-3)]">{count}</span>
      </div>
      <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
