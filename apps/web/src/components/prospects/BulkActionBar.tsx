"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@tevero/ui";
import { Search, Tag, Archive, Download, X, Loader2 } from "lucide-react";

interface BulkActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onAnalyzeSelected: (ids: string[]) => Promise<void>;
  onArchiveSelected: (ids: string[]) => Promise<void>;
  disabled?: boolean;
}

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  onAnalyzeSelected,
  onArchiveSelected,
  disabled = false,
}: BulkActionBarProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const count = selectedIds.length;

  if (count === 0) return null;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await onAnalyzeSelected(selectedIds);
      onClearSelection();
      router.refresh();
    } catch (error) {
      console.error("Bulk analyze failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive ${count} prospect${count !== 1 ? "s" : ""}?`)) return;
    setArchiving(true);
    try {
      await onArchiveSelected(selectedIds);
      onClearSelection();
      router.refresh();
    } catch (error) {
      console.error("Bulk archive failed:", error);
    } finally {
      setArchiving(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set("ids", selectedIds.join(","));
    window.open(`/api/prospects/export?${params.toString()}`, "_blank");
  };

  const isLoading = analyzing || archiving;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-background border rounded-lg shadow-lg px-4 py-3">
        <Badge variant="secondary" className="font-medium">
          {count} selected
        </Badge>

        <div className="h-6 w-px bg-border" />

        <Button
          size="sm"
          variant="outline"
          onClick={handleAnalyze}
          disabled={disabled || isLoading}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Analyze
        </Button>

        <Button size="sm" variant="outline" disabled={isLoading}>
          <Tag className="h-4 w-4 mr-2" />
          Tag
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleArchive}
          disabled={isLoading}
        >
          {archiving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 mr-2" />
          )}
          Archive
        </Button>

        <Button size="sm" variant="outline" onClick={handleExport} disabled={isLoading}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>

        <div className="h-6 w-px bg-border" />

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
