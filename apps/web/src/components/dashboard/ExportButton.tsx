"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Checkbox,
  Label,
} from "@tevero/ui";
import { Download, FileSpreadsheet } from "lucide-react";
import type { ExportColumn } from "@/lib/dashboard/types";
import { EXPORT_COLUMN_LABELS } from "@/lib/dashboard/types";

const ALL_COLUMNS: ExportColumn[] = [
  "clientName",
  "healthScore",
  "trafficCurrent",
  "trafficTrendPct",
  "keywordsTotal",
  "keywordsTop10",
  "keywordsTop3",
  "keywordsPosition1",
  "alertsOpen",
  "connectionStatus",
  "lastReportAt",
  "lastAuditAt",
];

const DEFAULT_COLUMNS: ExportColumn[] = [
  "clientName",
  "healthScore",
  "trafficCurrent",
  "trafficTrendPct",
  "keywordsTotal",
  "alertsOpen",
];

export function ExportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (column: ExportColumn) => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column]
    );
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        columns: selectedColumns.join(","),
      });

      const response = await fetch(`/api/dashboard/export?${params}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clients-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setIsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export to CSV
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Select columns to export:</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLUMNS.map((column) => (
                <div key={column} className="flex items-center space-x-2">
                  <Checkbox
                    id={column}
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => toggleColumn(column)}
                  />
                  <Label htmlFor={column} className="text-sm font-normal">
                    {EXPORT_COLUMN_LABELS[column]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="link"
              size="sm"
              onClick={() => setSelectedColumns(ALL_COLUMNS)}
              className="p-0"
            >
              Select All
            </Button>
            <Button
              variant="link"
              size="sm"
              onClick={() => setSelectedColumns(DEFAULT_COLUMNS)}
              className="p-0"
            >
              Reset to Default
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedColumns.length === 0 || isExporting}
            >
              {isExporting ? "Exporting..." : "Download CSV"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
