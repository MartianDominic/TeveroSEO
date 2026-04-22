"use client";

import { useState } from "react";
import { ProspectCard } from "./ProspectCard";
import { BulkActionBar } from "./BulkActionBar";
import { PipelineDistributionChart } from "./PipelineDistributionChart";
import { Badge, Checkbox } from "@tevero/ui";
import type { Prospect } from "@/app/(shell)/prospects/actions";
import {
  updateProspectAction,
  bulkAnalyzeAction,
} from "@/app/(shell)/prospects/actions";

interface ProspectListProps {
  prospects: Prospect[];
  remainingAnalyses: number;
}

export function ProspectList({
  prospects,
  remainingAnalyses,
}: ProspectListProps) {
  const [remaining, setRemaining] = useState(remainingAnalyses);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleAnalyzeStart = () => {
    setRemaining((prev) => Math.max(0, prev - 1));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === prospects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prospects.map((p) => p.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleAnalyzeSelected = async (ids: string[]) => {
    const result = await bulkAnalyzeAction(ids);
    setRemaining(result.remainingQuota);
  };

  const handleArchiveSelected = async (ids: string[]) => {
    for (const id of ids) {
      await updateProspectAction(id, { status: "archived" });
    }
  };

  if (prospects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No prospects yet</p>
        <p className="text-sm mt-1">
          Click &quot;Add Prospect&quot; to start building your pipeline
        </p>
      </div>
    );
  }

  const allSelected = selectedIds.length === prospects.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <div className="space-y-4">
      <PipelineDistributionChart prospects={prospects} />

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected || (someSelected ? "indeterminate" : false)}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
          />
          <span className="text-muted-foreground">
            Showing {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Analyses remaining today:
          </span>
          <Badge
            variant={
              remaining > 3
                ? "secondary"
                : remaining > 0
                  ? "outline"
                  : "destructive"
            }
          >
            {remaining} / 10
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            canAnalyze={remaining > 0}
            onAnalyzeStart={handleAnalyzeStart}
            selected={selectedIds.includes(prospect.id)}
            onToggleSelect={() => handleToggleSelect(prospect.id)}
          />
        ))}
      </div>

      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={handleClearSelection}
        onAnalyzeSelected={handleAnalyzeSelected}
        onArchiveSelected={handleArchiveSelected}
        disabled={remaining <= 0}
      />
    </div>
  );
}
