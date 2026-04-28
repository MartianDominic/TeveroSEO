/**
 * OpportunitySummaryCard component
 * Phase 29: AI Opportunity Discovery - Task 29-04
 *
 * Displays summary statistics for AI-generated keyword opportunities.
 */
import { Card } from "@/client/components/ui/card";
import type { OpportunitySummary } from "./OpportunityKeywordsTable";

interface OpportunitySummaryCardProps {
  summary: OpportunitySummary;
}

/**
 * Renders summary statistics for keyword opportunities
 */
export function OpportunitySummaryCard({ summary }: OpportunitySummaryCardProps) {
  return (
    <div className="space-y-4">
      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Keywords</div>
          <div className="text-2xl font-bold">{summary.totalKeywords}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Volume</div>
          <div className="text-2xl font-bold">
            {summary.totalVolume.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Avg Opportunity</div>
          <div className="text-2xl font-bold">
            {summary.avgOpportunity.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card className="p-4">
        <div className="text-sm text-muted-foreground mb-3">Keywords by Category</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <CategoryCount
            label="Product"
            count={summary.byCategory.product}
            color="text-blue-400"
          />
          <CategoryCount
            label="Brand"
            count={summary.byCategory.brand}
            color="text-purple-400"
          />
          <CategoryCount
            label="Service"
            count={summary.byCategory.service}
            color="text-green-400"
          />
          <CategoryCount
            label="Commercial"
            count={summary.byCategory.commercial}
            color="text-orange-400"
          />
          <CategoryCount
            label="Informational"
            count={summary.byCategory.informational}
            color="text-cyan-400"
          />
        </div>
      </Card>
    </div>
  );
}

function CategoryCount({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-xl font-semibold ${color}`}>{count}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
