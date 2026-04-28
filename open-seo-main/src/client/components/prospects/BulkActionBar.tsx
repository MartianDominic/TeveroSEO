/**
 * Bulk action bar for selected prospects.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Shows actions: Analyze All, Archive, Export CSV
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { bulkAnalyzeProspects, bulkArchiveProspects } from "@/serverFunctions/prospects";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import type { ProspectSelect } from "@/db/prospect-schema";
import { Sparkles, Archive, Download, ChevronDown, X, Loader2 } from "lucide-react";

interface BulkActionBarProps {
  selectedProspects: ProspectSelect[];
  remainingQuota: number;
  onClear: () => void;
  onActionComplete: () => void;
}

export function BulkActionBar({
  selectedProspects,
  remainingQuota,
  onClear,
  onActionComplete,
}: BulkActionBarProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const selectedIds = selectedProspects.map((p) => p.id);
  const count = selectedIds.length;

  const handleAnalyze = async (analysisType: "quick_scan" | "deep_dive" | "opportunity_discovery") => {
    if (count === 0) return;

    setIsAnalyzing(true);
    try {
      await bulkAnalyzeProspects({
        data: {
          prospectIds: selectedIds,
          analysisType,
        },
      });

      onActionComplete();
    } catch (error) {
      console.error("Bulk analyze failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleArchive = async () => {
    if (count === 0) return;

    setIsArchiving(true);
    try {
      await bulkArchiveProspects({ data: { prospectIds: selectedIds } });
      onActionComplete();
    } catch (error) {
      console.error("Bulk archive failed:", error);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleExport = () => {
    if (count === 0) return;

    const headers = ["domain", "companyName", "contactEmail", "contactName", "pipelineStage", "priorityScore", "industry"];
    const rows = selectedProspects.map((p) => [
      p.domain,
      p.companyName ?? "",
      p.contactEmail ?? "",
      p.contactName ?? "",
      p.pipelineStage ?? "",
      p.priorityScore?.toString() ?? "",
      p.industry ?? "",
    ]);

    const csv = buildCsv(headers, rows);
    const filename = `prospects-export-${new Date().toISOString().split("T")[0]}.csv`;
    downloadCsv(filename, csv);
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 bg-background border rounded-lg shadow-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">
              {count} selected
            </span>

            <div className="h-4 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" disabled={isAnalyzing || remainingQuota === 0}>
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Analyze
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleAnalyze("quick_scan")}>
                  Quick Scan ({Math.min(count, remainingQuota)} of {count})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAnalyze("deep_dive")}>
                  Deep Dive ({Math.min(count, remainingQuota)} of {count})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAnalyze("opportunity_discovery")}>
                  Opportunity Discovery ({Math.min(count, remainingQuota)} of {count})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Archive className="w-4 h-4 mr-2" />
              )}
              Archive
            </Button>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>

            <div className="h-4 w-px bg-border" />

            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {remainingQuota < count && (
            <div className="text-center mt-2 text-xs text-amber-600">
              Daily quota: {remainingQuota} analyses remaining
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
