/**
 * OpportunityKeywordsTab component
 * Phase 29: AI Opportunity Discovery - Task 29-04
 *
 * Tab content for displaying AI-generated keyword opportunities on prospect detail page.
 * Includes summary stats, export button, and sortable/filterable table.
 */
import { useMemo } from "react";
import { Button } from "@/client/components/ui/button";
import { Download, Loader2, Sparkles } from "lucide-react";
import {
  OpportunityKeywordsTable,
  calculateOpportunitySummary,
} from "./OpportunityKeywordsTable";
import { OpportunitySummaryCard } from "./OpportunitySummaryCard";
import type { OpportunityKeyword } from "@/db/prospect-schema";

interface OpportunityKeywordsTabProps {
  keywords: OpportunityKeyword[] | null | undefined;
  domain: string;
  isLoading?: boolean;
  onAddToProposal?: (keyword: string) => void;
}

/**
 * Export keywords to CSV format
 */
function exportOpportunityKeywords(keywords: OpportunityKeyword[]): string {
  const headers = [
    "Keyword",
    "Category",
    "Search Volume",
    "CPC",
    "Difficulty",
    "Opportunity Score",
    "Source",
  ];

  const rows = keywords.map((k) => [
    `"${k.keyword.replace(/"/g, '""')}"`,
    k.category,
    k.searchVolume.toString(),
    k.cpc.toFixed(2),
    k.difficulty.toString(),
    k.opportunityScore.toString(),
    k.source,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Download CSV file
 */
function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Renders the opportunity keywords tab content with summary, export, and table
 */
export function OpportunityKeywordsTab({
  keywords,
  domain,
  isLoading,
  onAddToProposal,
}: OpportunityKeywordsTabProps) {
  const summary = useMemo(
    () => calculateOpportunitySummary(keywords ?? []),
    [keywords],
  );

  const handleExport = () => {
    if (!keywords || keywords.length === 0) return;

    const csv = exportOpportunityKeywords(keywords);
    const date = new Date().toISOString().split("T")[0];
    const filename = `${domain.replace(/\./g, "_")}_opportunities_${date}.csv`;
    downloadCsv(csv, filename);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!keywords || keywords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="mb-2">No keyword opportunities found yet.</p>
        <p className="text-sm">
          Run an analysis to generate AI-powered keyword suggestions based on
          the website's products, brands, and services.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI-Generated Opportunities</h3>
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

      {/* Summary statistics */}
      <OpportunitySummaryCard summary={summary} />

      {/* Opportunity keywords table */}
      <OpportunityKeywordsTable
        keywords={keywords}
        onAddToProposal={onAddToProposal}
      />
    </div>
  );
}
