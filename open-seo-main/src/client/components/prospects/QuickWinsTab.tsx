/**
 * QuickWinsTab component
 * Phase 28-04: Quick Wins Classification
 *
 * Displays only Quick Win keywords - low difficulty, decent volume, highly achievable.
 * Quick Win = difficulty < 30 AND searchVolume > 100 AND achievability > 70
 */
import { useMemo } from "react";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import { Download, Loader2, Zap, TrendingUp, Target } from "lucide-react";
import { KeywordGapTable } from "./KeywordGapTable";
import {
  exportKeywordGaps,
  downloadCsv,
  generateExportFilename,
} from "@/client/utils/export";
import type { KeywordGap } from "@/db/prospect-schema";

interface QuickWinsTabProps {
  gaps: KeywordGap[] | null | undefined;
  domainAuthority: number;
  domain: string;
  isLoading?: boolean;
  onAddTarget?: (keyword: string) => void;
}

/**
 * Calculate achievability score for a keyword
 */
function calculateAchievability(difficulty: number, domainAuthority: number): number {
  return 100 - Math.max(0, difficulty - domainAuthority);
}

/**
 * Check if a keyword qualifies as a Quick Win
 */
function isQuickWin(gap: KeywordGap, domainAuthority: number): boolean {
  const achievability = calculateAchievability(gap.difficulty, domainAuthority);
  return gap.difficulty < 30 && gap.searchVolume > 100 && achievability > 70;
}

/**
 * Filter gaps to only Quick Wins
 */
function filterQuickWins(gaps: KeywordGap[], domainAuthority: number): KeywordGap[] {
  return gaps.filter((gap) => isQuickWin(gap, domainAuthority));
}

/**
 * Renders the Quick Wins tab content with filtered keywords
 */
export function QuickWinsTab({
  gaps,
  domainAuthority,
  domain,
  isLoading,
  onAddTarget,
}: QuickWinsTabProps) {
  const quickWins = useMemo(
    () => filterQuickWins(gaps ?? [], domainAuthority),
    [gaps, domainAuthority]
  );

  const summary = useMemo(() => {
    if (quickWins.length === 0) {
      return { totalVolume: 0, avgDifficulty: 0, totalOpportunity: 0 };
    }
    const totalVolume = quickWins.reduce((sum, g) => sum + g.searchVolume, 0);
    const totalDifficulty = quickWins.reduce((sum, g) => sum + g.difficulty, 0);
    const totalOpportunity = quickWins.reduce((sum, g) => sum + g.trafficPotential, 0);
    return {
      totalVolume,
      avgDifficulty: Math.round(totalDifficulty / quickWins.length),
      totalOpportunity,
    };
  }, [quickWins]);

  const handleExport = () => {
    if (quickWins.length === 0) return;
    const csv = exportKeywordGaps(quickWins);
    const filename = generateExportFilename(domain, "quick-wins");
    downloadCsv(csv, filename);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!gaps || gaps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">No keyword gaps found yet.</p>
        <p className="text-sm">
          Run a gap analysis to discover Quick Win opportunities.
        </p>
      </div>
    );
  }

  if (quickWins.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="mb-2">No Quick Wins found.</p>
        <p className="text-sm">
          Quick Wins require: difficulty &lt; 30, volume &gt; 100, achievability &gt; 70
        </p>
        <p className="text-sm mt-2">
          Domain Authority: {domainAuthority} | Total gaps: {gaps.length}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Quick Wins</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Target className="h-4 w-4" />
            Quick Wins Found
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {quickWins.length}
          </div>
          <div className="text-xs text-muted-foreground">
            of {gaps.length} total gaps
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Total Search Volume
          </div>
          <div className="text-2xl font-bold">
            {summary.totalVolume.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            monthly searches
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">
            Avg. Difficulty
          </div>
          <div className="text-2xl font-bold text-green-600">
            {summary.avgDifficulty}
          </div>
          <div className="text-xs text-muted-foreground">
            low competition
          </div>
        </Card>
      </div>

      {/* Info banner */}
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              These keywords are your best opportunities
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Low difficulty (&lt;30), decent volume (&gt;100), and highly achievable
              for a domain with DA {domainAuthority}. Start ranking for these first.
            </p>
          </div>
        </div>
      </div>

      {/* Quick wins table */}
      <KeywordGapTable gaps={quickWins} onAddTarget={onAddTarget} />
    </div>
  );
}
