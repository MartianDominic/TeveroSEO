"use client";

/**
 * ExportActions Component
 * Phase 82: Chat Integration
 *
 * Provides CSV export buttons for analysis results.
 * Three exports: Selected, Excluded, pSEO Opportunities
 */

import { Button } from "@tevero/ui";
import { Download } from "lucide-react";
import Papa from "papaparse";
import type { AnalysisResult } from "@/lib/keyword-chat/types";

interface ExportActionsProps {
  result: AnalysisResult;
}

function downloadCSV(data: string, filename: string) {
  const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportSelected(result: AnalysisResult) {
  const rows = result.selection.selected.map((kw) => ({
    keyword: kw.keyword,
    funnel_stage: kw.funnelStage,
    volume: kw.metrics.volume,
    difficulty: kw.metrics.difficulty,
    cpc: kw.metrics.cpc ?? "",
    composite_score: kw.compositeScore.toFixed(3),
    cascade_position: kw.cascadePosition,
  }));

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `selected-keywords-${Date.now()}.csv`);
}

function exportExcluded(result: AnalysisResult) {
  const rows = result.filtering.excluded.map((kw) => ({
    keyword: kw.keyword,
    exclusion_reason: kw.exclusionReason,
    exclusion_stage: kw.exclusionStage,
    human_readable: kw.humanReadable,
  }));

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `excluded-keywords-${Date.now()}.csv`);
}

function exportPSEO(result: AnalysisResult) {
  const rows = result.pseoOpportunities.flatMap((cluster) =>
    cluster.keywords.map((kw) => ({
      pattern: cluster.pattern,
      template: cluster.template,
      keyword: kw,
      estimated_pages: cluster.estimatedPages,
      total_volume: cluster.totalVolume,
      opportunity_score: cluster.opportunityScore.toFixed(3),
    }))
  );

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `pseo-opportunities-${Date.now()}.csv`);
}

export function ExportActions({ result }: ExportActionsProps) {
  const hasSelected = result.selection.selected.length > 0;
  const hasExcluded = result.filtering.excluded.length > 0;
  const hasPSEO = result.pseoOpportunities.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportSelected(result)}
        disabled={!hasSelected}
      >
        <Download className="h-4 w-4 mr-2" />
        Export Selected ({result.selection.selected.length})
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => exportExcluded(result)}
        disabled={!hasExcluded}
      >
        <Download className="h-4 w-4 mr-2" />
        Export Excluded ({result.filtering.excluded.length})
      </Button>

      {hasPSEO && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportPSEO(result)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export pSEO ({result.pseoOpportunities.length} clusters)
        </Button>
      )}
    </div>
  );
}
