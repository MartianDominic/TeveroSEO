/**
 * Coverage Dashboard Component
 * Phase 93: Keyword Coverage Intelligence
 *
 * Shows keyword coverage metrics before allowing new research.
 * Per 93-CONTEXT.md: "Show coverage before allowing re-research"
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface TierCoverage {
  tier: string;
  keywordCount: number;
  avgSearchVolume: number;
  coverageLevel: 'comprehensive' | 'moderate' | 'minimal' | 'missing';
}

interface CoverageSummary {
  totalKeywords: number;
  totalActiveKeywords: number;
  lastResearchedAt: string | null;
  tiers: TierCoverage[];
  suggestedAction: string | null;
}

interface CoverageDashboardProps {
  prospectId: string;
  onResearchClick?: () => void;
}

const COVERAGE_COLORS: Record<string, string> = {
  comprehensive: 'bg-success text-success-foreground',
  moderate: 'bg-warning text-warning-foreground',
  minimal: 'bg-accent-soft text-accent-ink',
  missing: 'bg-error text-error-foreground',
};

const COVERAGE_ICONS: Record<string, string> = {
  comprehensive: '✅',
  moderate: '⚠️',
  minimal: '📊',
  missing: '❌',
};

const TIER_LABELS: Record<string, string> = {
  must_do: 'Must Do (High Priority)',
  should_do: 'Should Do (Medium Priority)',
  nice_to_have: 'Nice to Have (Low Priority)',
  unclassified: 'Unclassified',
};

export function CoverageDashboard({ prospectId, onResearchClick }: CoverageDashboardProps) {
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCoverage() {
      try {
        setLoading(true);
        const response = await fetch(`/api/keywords/coverage?prospectId=${prospectId}`);
        const data = await response.json() as { success: boolean; data?: CoverageSummary; error?: string };

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch coverage');
        }

        setCoverage(data.data ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchCoverage();
  }, [prospectId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-error">
        <CardContent className="pt-6">
          <p className="text-error">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!coverage) {
    return null;
  }

  const lastResearchedText = coverage.lastResearchedAt
    ? `Last researched ${formatDistanceToNow(new Date(coverage.lastResearchedAt))} ago`
    : 'Never researched';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Keyword Coverage</span>
          <Badge variant="outline" className="font-normal">
            {lastResearchedText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-surface-2 rounded-lg">
            <div className="text-2xl font-semibold">{coverage.totalKeywords.toLocaleString()}</div>
            <div className="text-sm text-text-3">Total Keywords</div>
          </div>
          <div className="p-4 bg-surface-2 rounded-lg">
            <div className="text-2xl font-semibold">{coverage.totalActiveKeywords.toLocaleString()}</div>
            <div className="text-sm text-text-3">Active Keywords</div>
          </div>
        </div>

        {/* Tier Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-3">Coverage by Priority Tier</h4>
          <div className="space-y-2">
            {coverage.tiers.length === 0 ? (
              <p className="text-text-3 text-sm">No keywords yet. Start with EXPAND research.</p>
            ) : (
              coverage.tiers.map((tier) => (
                <div
                  key={tier.tier}
                  className="flex items-center justify-between p-3 bg-surface-2 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span>{COVERAGE_ICONS[tier.coverageLevel]}</span>
                    <span className="font-medium">{TIER_LABELS[tier.tier] || tier.tier}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-3">
                      {tier.keywordCount.toLocaleString()} kw
                    </span>
                    <Badge className={COVERAGE_COLORS[tier.coverageLevel]}>
                      {tier.coverageLevel}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Suggested Action */}
        {coverage.suggestedAction && (
          <div className="p-4 bg-accent-soft rounded-lg border border-accent">
            <p className="text-sm text-accent-ink">{coverage.suggestedAction}</p>
          </div>
        )}

        {/* Research Button */}
        {onResearchClick && (
          <Button onClick={onResearchClick} className="w-full">
            Research New Keywords
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
