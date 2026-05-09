/**
 * CsvImportDialog Component
 * Phase 84-01 Task 4: CSV import dialog frontend
 *
 * A 3-step wizard for importing keywords from CSV files.
 * Supports Ahrefs, SEMrush, Moz, and generic CSV formats.
 *
 * Steps:
 * 1. Upload: Drag and drop or select CSV file
 * 2. Preview: Review detected format and sample data
 * 3. Results: Import confirmation with success/skip counts
 */

"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";

import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@tevero/ui";
import { Button, Badge, cn } from "@tevero/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";

/**
 * Props for CsvImportDialog component
 */
export interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (data: ImportResult) => void;
}

/**
 * Column mapping from source to target field
 */
interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

/**
 * Preview data returned from the preview endpoint
 */
interface PreviewData {
  format: string;
  detectedColumns: ColumnMapping[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

/**
 * Import result returned from the import endpoint
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  keywords?: Array<{ keyword: string }>;
}

type Step = "upload" | "preview" | "results";

/**
 * CsvImportDialog - 3-step wizard for CSV keyword import
 */
export function CsvImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setFile(null);
      setPreviewData(null);
      setImportResult(null);
      setError(null);
      setIsLoading(false);
      setIsImporting(false);
    }
  }, [open]);

  /**
   * Handle file selection via input or drop
   */
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError("File size exceeds 10MB limit");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    try {
      // Create form data for preview request
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/keywords/csv/preview", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to preview CSV file");
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: PreviewData;
        error?: string;
      };

      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Failed to parse CSV");
      }

      setPreviewData(result.data);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files && files[0]) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle import action
   */
  const handleImport = useCallback(async () => {
    if (!file || !previewData) return;

    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", previewData.format);
      formData.append("columns", JSON.stringify(previewData.detectedColumns));

      const response = await fetch("/api/keywords/csv/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to import CSV file");
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: ImportResult;
        error?: string;
      };

      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Import failed");
      }

      setImportResult(result.data);
      setStep("results");
      onImportComplete(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }, [file, previewData, onImportComplete]);

  /**
   * Format number with comma separators
   */
  const formatNumber = (num: number): string => {
    return num.toLocaleString("en-US");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface border border-[var(--hairline)]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-text-1">
            Import CSV
          </DialogTitle>
          <DialogDescription className="text-text-3">
            Upload a CSV file from Ahrefs, SEMrush, Moz, or any keyword tool
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="py-6">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8",
                "flex flex-col items-center justify-center gap-4",
                "transition-colors duration-200",
                isDragOver
                  ? "border-accent bg-accent/5"
                  : "border-[var(--hairline)] bg-surface-2/50",
                "cursor-pointer"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-10 h-10 text-accent animate-spin" />
                  <p className="text-text-2">Processing file...</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-text-4" />
                  <div className="text-center">
                    <p className="text-text-2 font-medium">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-text-4 text-sm mt-1">
                      or click to browse
                    </p>
                  </div>
                  <p className="text-text-4 text-xs">
                    Maximum file size: 10 MB
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleInputChange}
              data-testid="csv-file-input"
            />

            {error && (
              <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger" />
                <span className="text-sm text-danger">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && previewData && (
          <div className="py-4">
            {/* Format badge and stats */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-text-3" />
                <span className="text-text-2">{file?.name}</span>
                <Badge variant="secondary" className="capitalize">
                  {previewData.format}
                </Badge>
              </div>
              <span className="text-text-3 text-sm">
                {formatNumber(previewData.totalRows)} rows
              </span>
            </div>

            {/* Column mapping preview */}
            {previewData.detectedColumns.length > 0 && (
              <div className="mb-4">
                <p className="text-text-3 text-sm mb-2">Detected columns:</p>
                <div className="flex flex-wrap gap-2">
                  {previewData.detectedColumns.map((col) => (
                    <Badge
                      key={col.sourceColumn}
                      variant="outline"
                      className="text-xs"
                    >
                      {col.sourceColumn} → {col.targetField}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sample data table */}
            {previewData.sampleRows.length > 0 && (
              <div className="border border-[var(--hairline)] rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-2">
                      {Object.keys(previewData.sampleRows[0]).map((header) => (
                        <TableHead
                          key={header}
                          className="text-text-3 font-medium"
                        >
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.sampleRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.values(row).map((value, cellIdx) => (
                          <TableCell key={cellIdx} className="text-text-2">
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger" />
                <span className="text-sm text-danger">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setPreviewData(null);
                }}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${formatNumber(previewData.totalRows)} keywords`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && importResult && (
          <div className="py-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="w-12 h-12 text-success mb-4" />
              <h3 className="text-lg font-semibold text-text-1 mb-2">
                Import Complete
              </h3>

              <div className="flex items-center gap-6 mt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">
                    {formatNumber(importResult.imported)}
                  </p>
                  <p className="text-text-3 text-sm">imported</p>
                </div>
                {importResult.skipped > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">
                      {importResult.skipped}
                    </p>
                    <p className="text-text-3 text-sm">skipped</p>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-md w-full">
                  <p className="text-sm text-warning">
                    {importResult.errors.length} errors occurred during import
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
