/**
 * KeywordGapsTab component
 * Phase 28: Keyword Gap Analysis UI
 *
 * Tab content for displaying keyword gap analysis on prospect detail page.
 * Includes summary stats, export button, and sortable table.
 */
import { useMemo } from "react";
import { Button } from "@/client/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { KeywordGapTable, calculateGapSummary } from "./KeywordGapTable";
import { GapSummaryCard } from "./GapSummaryCard";
import {
  exportKeywordGaps,
  downloadCsv,
  generateExportFilename,
} from "@/client/utils/export";
import type { KeywordGap } from "@/db/prospect-schema";

interface KeywordGapsTabProps {
  gaps: KeywordGap[] | null | undefined;
  domain: string;
  isLoading?: boolean;
  onAddTarget?: (keyword: string) => void;
}

/**
 * Renders the keyword gaps tab content with summary, export, and table
 */
export function KeywordGapsTab({
  gaps,
  domain,
  isLoading,
  onAddTarget,
}: KeywordGapsTabProps) {
  const summary = useMemo(
    () => calculateGapSummary(gaps ?? []),
    [gaps]
  );

  const handleExport = () => {
    if (!gaps || gaps.length === 0) return;

    const csv = exportKeywordGaps(gaps);
    const filename = generateExportFilename(domain);
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
          Run a gap analysis to discover keyword opportunities from competitors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Keyword Gap Analysis</h3>
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
      <GapSummaryCard summary={summary} />

      {/* Keyword gaps table */}
      <KeywordGapTable gaps={gaps} onAddTarget={onAddTarget} />
    </div>
  );
}
