"use client";

/**
 * RecommendationsPanel - AI-driven insights from keyword analysis
 * Phase 47-01: Deferred from 43-06
 *
 * Displays awareness level, hook strategy, and keyword highlights
 * with v6 design system compliance.
 */

import { useEffect, useState, useCallback } from "react";

import { Lightbulb, TrendingUp, Target, Users, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, Badge } from "@tevero/ui";

import {
  getAIRecommendations,
  type AIRecommendations,
  type AwarenessLevel,
} from "../actions";

interface RecommendationsPanelProps {
  prospectId: string;
  onAwarenessDetected?: (level: AwarenessLevel) => void;
}

/** v6 design tokens for awareness level badges */
const AWARENESS_COLORS: Record<AwarenessLevel, { bg: string; text: string }> = {
  unaware: { bg: "bg-gray-100", text: "text-gray-700" },
  "problem-aware": { bg: "bg-amber-50", text: "text-amber-700" },
  "solution-aware": { bg: "bg-blue-50", text: "text-blue-700" },
  "product-aware": { bg: "bg-green-50", text: "text-green-700" },
  "most-aware": { bg: "bg-emerald-50", text: "text-emerald-700" },
};

/** Lithuanian labels for awareness levels */
const AWARENESS_LABELS: Record<AwarenessLevel, string> = {
  unaware: "Neinformuotas",
  "problem-aware": "Zino problema",
  "solution-aware": "Iesko sprendimu",
  "product-aware": "Lygina pasiulymus",
  "most-aware": "Pasiruoses pirkti",
};

export function RecommendationsPanel({
  prospectId,
  onAwarenessDetected,
}: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] =
    useState<AIRecommendations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize callback to prevent infinite loops
  const handleAwarenessDetected = useCallback(
    (level: AwarenessLevel) => {
      onAwarenessDetected?.(level);
    },
    [onAwarenessDetected]
  );

  useEffect(() => {
    let mounted = true;

    async function fetchRecommendations() {
      setIsLoading(true);
      setError(null);

      const result = await getAIRecommendations(prospectId);

      if (!mounted) return;

      if (result.success) {
        setRecommendations(result.data);
        handleAwarenessDetected(result.data.awarenessLevel);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    }

    fetchRecommendations();

    return () => {
      mounted = false;
    };
  }, [prospectId, handleAwarenessDetected]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#93939a]" />
          <p className="mt-2 text-sm text-[#93939a]">
            Analizuojame perspektyva...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !recommendations) {
    // Silently fail - recommendations are optional enhancement
    return null;
  }

  const {
    awarenessLevel,
    hookStrategy,
    recommendedApproach,
    keywordHighlights,
  } = recommendations;
  const colors = AWARENESS_COLORS[awarenessLevel];

  return (
    <Card className="border-l-4" style={{ borderLeftColor: "#0f4f3d" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#0f4f3d]" />
            <span style={{ color: "#14141a" }}>AI Rekomendacijos</span>
          </CardTitle>
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {AWARENESS_LABELS[awarenessLevel]}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hook Strategy - v6 accent soft background */}
        <div className="p-3 bg-[#eaf1ed] rounded-lg">
          <p className="text-sm font-medium text-[#093528] mb-1">
            Rekomenduojama strategija
          </p>
          <p className="text-sm text-[#54545a]">{hookStrategy}</p>
        </div>

        {/* Opening Angle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#93939a]" />
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#93939a" }}
            >
              Pradinis kampas
            </span>
          </div>
          <p className="text-sm" style={{ color: "#14141a" }}>
            {recommendedApproach.openingAngle}
          </p>
        </div>

        {/* Objections to Address */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#93939a]" />
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#93939a" }}
            >
              Priestaravimai, kuriuos reikia adresuoti
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {recommendedApproach.objectionsToAddress.map((objection, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {objection}
              </Badge>
            ))}
          </div>
        </div>

        {/* Keyword Highlights - only show if data exists */}
        {keywordHighlights.totalKeywords > 0 && (
          <div className="pt-3 border-t" style={{ borderColor: "#f2f1eb" }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-[#93939a]" />
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "#93939a" }}
              >
                Raktazodziu apzvalga
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {/* Total Keywords - v6 Newsreader display font */}
              <div>
                <div
                  className="text-2xl font-semibold"
                  style={{
                    fontFamily: "Newsreader, serif",
                    color: "#14141a",
                  }}
                >
                  {keywordHighlights.totalKeywords}
                </div>
                <div className="text-xs" style={{ color: "#93939a" }}>
                  Viso
                </div>
              </div>
              {/* Quick Wins - v6 accent color */}
              <div>
                <div
                  className="text-2xl font-semibold"
                  style={{
                    fontFamily: "Newsreader, serif",
                    color: "#0f4f3d",
                  }}
                >
                  {keywordHighlights.quickWins}
                </div>
                <div className="text-xs" style={{ color: "#93939a" }}>
                  Greiti laimejimai
                </div>
              </div>
              {/* Estimated Traffic Gain */}
              <div>
                <div
                  className="text-2xl font-semibold"
                  style={{
                    fontFamily: "Newsreader, serif",
                    color: "#14141a",
                  }}
                >
                  +{keywordHighlights.estimatedTrafficGain.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: "#93939a" }}>
                  Lankytoju/men.
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

RecommendationsPanel.displayName = "RecommendationsPanel";
