/**
 * GapSummaryCard component
 * Phase 28: Keyword Gap Analysis UI
 *
 * Displays summary statistics for keyword gap analysis.
 */
import { Card } from "@/client/components/ui/card";
import type { GapSummary } from "./KeywordGapTable";

interface GapSummaryCardProps {
  summary: GapSummary;
}

/**
 * Renders summary statistics for keyword gaps
 */
export function GapSummaryCard({ summary }: GapSummaryCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Total Gaps</div>
        <div className="text-2xl font-bold">{summary.totalGaps}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Avg Opportunity</div>
        <div className="text-2xl font-bold">
          {Math.round(summary.avgOpportunity).toLocaleString()}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Total Volume</div>
        <div className="text-2xl font-bold">
          {summary.totalVolume.toLocaleString()}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Avg Difficulty</div>
        <div className="text-2xl font-bold">{summary.avgDifficulty}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Competitors</div>
        <div className="text-2xl font-bold">{summary.uniqueCompetitors}</div>
      </Card>
    </div>
  );
}
