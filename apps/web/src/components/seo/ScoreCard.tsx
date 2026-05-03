"use client";

import { Card, CardContent, Badge } from "@tevero/ui";
import type { ScoreBreakdown } from "@/lib/audit/checks/types";
import { QUALITY_THRESHOLDS } from "@tevero/types";

interface ScoreCardProps {
  score: number;
  breakdown: ScoreBreakdown;
  gates: string[];
}

/**
 * Get score color based on standardized thresholds.
 * FIX-14: Red (0-49), Yellow (50-79), Green (80-100)
 */
function getScoreColor(score: number): string {
  if (score >= QUALITY_THRESHOLDS.PASS) return "text-green-600"; // >= 80
  if (score >= QUALITY_THRESHOLDS.WARN) return "text-yellow-600"; // >= 50
  return "text-red-600"; // < 50
}

/**
 * Get score background color based on standardized thresholds.
 * FIX-14: Red (0-49), Yellow (50-79), Green (80-100)
 */
function getScoreBg(score: number): string {
  if (score >= QUALITY_THRESHOLDS.PASS) return "bg-green-500"; // >= 80
  if (score >= QUALITY_THRESHOLDS.WARN) return "bg-yellow-500"; // >= 50
  return "bg-red-500"; // < 50
}

const TIER_CONFIG = [
  { key: "tier1", label: "Tier 1", max: 20, desc: "Critical on-page" },
  { key: "tier2", label: "Tier 2", max: 10, desc: "Content quality" },
  { key: "tier3", label: "Tier 3", max: 10, desc: "Technical SEO" },
  { key: "tier4", label: "Tier 4", max: 10, desc: "Advanced" },
] as const;

export function ScoreCard({ score, breakdown, gates }: ScoreCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Main Score */}
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <div
              className={`text-5xl font-bold ${getScoreColor(score)}`}
            >
              {score}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              SEO Score
            </div>
          </div>

          {/* Breakdown Bars */}
          <div className="flex-1 space-y-3">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Score Breakdown
            </div>
            {TIER_CONFIG.map(({ key, label, max, desc }) => {
              const value = breakdown[key] ?? 0;
              const pct = Math.round((value / max) * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {label}{" "}
                      <span className="text-muted-foreground">({desc})</span>
                    </span>
                    <span className="font-medium">
                      {value}/{max}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getScoreBg(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gates */}
        {gates.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Active Gates (Blocking Issues)
            </div>
            <div className="flex flex-wrap gap-2">
              {gates.map((gate) => (
                <Badge key={gate} variant="destructive">
                  {gate}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
