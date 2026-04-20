"use client";

import { useState } from "react";
import { Button, Badge } from "@tevero/ui";
import { Download, FileText, X, Loader2 } from "lucide-react";

export interface BulkActionBarProps {
  /** Number of items currently selected */
  selectedCount: number;
  /** Set of selected client IDs */
  selectedIds: Set<string>;
  /** Callback to clear all selections */
  onClearSelection: () => void;
  /** Callback when export is triggered */
  onExport?: (clientIds: string[]) => void;
  /** Callback when generate reports is triggered */
  onGenerateReports?: (clientIds: string[]) => void;
}

/**
 * Fixed action bar that appears when items are selected in a table.
 * Provides bulk actions: Export Selected, Generate Reports, Clear Selection.
 *
 * Phase 24: Power User Features
 */
export function BulkActionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onExport,
  onGenerateReports,
}: BulkActionBarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const clientIds = Array.from(selectedIds);

  const handleExport = async () => {
    if (!onExport) {
      // Default export behavior: download CSV of selected clients
      setIsExporting(true);
      try {
        const params = new URLSearchParams({
          clientIds: clientIds.join(","),
        });
        const response = await fetch(`/api/dashboard/export?${params}`);
        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `selected-clients-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("Export failed:", error);
      } finally {
        setIsExporting(false);
      }
      return;
    }
    onExport(clientIds);
  };

  const handleGenerateReports = async () => {
    if (!onGenerateReports) {
      // Default behavior: trigger report generation
      setIsGenerating(true);
      try {
        const response = await fetch("/api/reports/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientIds }),
        });
        if (!response.ok) throw new Error("Report generation failed");
        // Reports are queued for background processing
      } catch (error) {
        console.error("Report generation failed:", error);
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    onGenerateReports(clientIds);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 bg-background border border-border rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-2 py-1 font-semibold">
            {selectedCount}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {selectedCount === 1 ? "client" : "clients"} selected
          </span>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Selected
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateReports}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Generate Reports
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
