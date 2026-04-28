/**
 * CSV Import Dialog for bulk prospect creation.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Uses papaparse for client-side parsing and preview.
 * Calls importProspectsFromCsv server function on confirm.
 */
import { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { importProspectsFromCsv } from "@/serverFunctions/prospects";
import { Upload, AlertCircle, CheckCircle2, FileWarning } from "lucide-react";

interface CsvRow {
  domain: string;
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  notes?: string;
  source?: string;
}

interface ParsedData {
  valid: CsvRow[];
  invalid: Array<{
    rowIndex: number;
    row: Record<string, unknown>;
    errors: string[];
  }>;
  totalRows: number;
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: { created: number; skipped: number }) => void;
}

// Domain validation regex
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Normalize a domain string for validation.
 * Mirrors server-side normalization.
 */
function normalizeDomain(domain: string): string {
  let normalized = domain.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.split("/")[0];
  normalized = normalized.split("?")[0];
  normalized = normalized.split(":")[0];
  return normalized.toLowerCase().trim();
}

/**
 * Client-side validation (mirrors server schema).
 * Used for preview - server validates again on import.
 */
function validateRows(rows: Record<string, unknown>[]): ParsedData {
  const valid: CsvRow[] = [];
  const invalid: ParsedData["invalid"] = [];
  const seenDomains = new Set<string>();

  rows.forEach((row, index) => {
    const errors: string[] = [];
    const rawDomain =
      typeof row.domain === "string" ? row.domain : String(row.domain ?? "");
    const domain = normalizeDomain(rawDomain);

    if (!domain) {
      errors.push("domain: Domain is required");
    } else if (!DOMAIN_REGEX.test(domain)) {
      errors.push("domain: Invalid domain format");
    }

    // Check for email in multiple possible fields
    const email =
      row.contactEmail ?? row.email ?? row.contact_email ?? row.contactemail;
    if (email && typeof email === "string" && email.length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("contactEmail: Invalid email format");
      }
    }

    if (errors.length > 0) {
      invalid.push({ rowIndex: index + 1, row, errors });
    } else if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      valid.push({
        domain,
        companyName: (row.companyName ??
          row.company ??
          row.company_name ??
          row.companyname) as string | undefined,
        contactEmail: (email || undefined) as string | undefined,
        contactName: (row.contactName ??
          row.name ??
          row.contact_name ??
          row.contactname) as string | undefined,
        industry: row.industry as string | undefined,
        notes: row.notes as string | undefined,
        source: row.source as string | undefined,
      });
    }
    // Duplicate domains are silently skipped (counted in display)
  });

  return { valid, invalid, totalRows: rows.length };
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CsvImportDialogProps) {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setParseError(null);
      setImportResult(null);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Normalize common header variations to expected field names
          const h = header.toLowerCase().trim();
          if (h === "company" || h === "company_name" || h === "companyname")
            return "companyName";
          if (h === "email" || h === "contact_email" || h === "contactemail")
            return "contactEmail";
          if (h === "name" || h === "contact_name" || h === "contactname")
            return "contactName";
          return header.trim();
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            setParseError(`CSV parse error: ${results.errors[0].message}`);
            return;
          }
          if (results.data.length === 0) {
            setParseError("CSV file is empty");
            return;
          }
          if (results.data.length > 10000) {
            setParseError("CSV file exceeds 10,000 row limit");
            return;
          }
          const validated = validateRows(
            results.data as Record<string, unknown>[]
          );
          setParsedData(validated);
        },
        error: (error) => {
          setParseError(`Failed to parse CSV: ${error.message}`);
        },
      });

      // Reset file input
      event.target.value = "";
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!parsedData || parsedData.valid.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importProspectsFromCsv({ data: { rows: parsedData.valid } });
      setImportResult({
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.map((e) => `${e.domain}: ${e.error}`),
      });
      if (result.created > 0) {
        onImportComplete({ created: result.created, skipped: result.skipped });
      }
    } catch (error) {
      setImportResult({
        created: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Import failed"],
      });
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, onImportComplete]);

  const handleClose = useCallback(() => {
    setParsedData(null);
    setImportResult(null);
    setParseError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // Calculate duplicates for display
  const duplicatesInCsv = parsedData
    ? parsedData.totalRows - parsedData.valid.length - parsedData.invalid.length
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-card rounded-lg border shadow-lg">
        <DialogHeader>
          <DialogTitle>Import Prospects from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: domain (required), companyName,
            contactEmail, contactName, industry, notes, source
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {!parsedData && !importResult && (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Click to select CSV file
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="csv-file-input"
              />
            </label>
          )}

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {parsedData && !importResult && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {parsedData.valid.length} valid rows
                </span>
                {parsedData.invalid.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <FileWarning className="w-4 h-4" />
                    {parsedData.invalid.length} invalid rows
                  </span>
                )}
                {duplicatesInCsv > 0 && (
                  <span className="text-muted-foreground">
                    {duplicatesInCsv} duplicates removed
                  </span>
                )}
              </div>

              {parsedData.invalid.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">
                      Invalid rows will be skipped:
                    </div>
                    <ul className="text-xs space-y-1 max-h-20 overflow-auto">
                      {parsedData.invalid.slice(0, 5).map((inv) => (
                        <li key={inv.rowIndex}>
                          Row {inv.rowIndex}: {inv.errors.join(", ")}
                        </li>
                      ))}
                      {parsedData.invalid.length > 5 && (
                        <li>...and {parsedData.invalid.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.valid.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">
                          {row.domain}
                        </TableCell>
                        <TableCell>{row.companyName || "-"}</TableCell>
                        <TableCell>{row.contactName || "-"}</TableCell>
                        <TableCell>{row.contactEmail || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {parsedData.valid.length > 10 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          ...and {parsedData.valid.length - 10} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {importResult && (
            <Alert
              variant={importResult.errors.length > 0 ? "destructive" : "success"}
            >
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">Import complete</div>
                <div className="text-sm mt-1">
                  Created: {importResult.created} | Skipped (duplicates):{" "}
                  {importResult.skipped}
                  {importResult.errors.length > 0 && (
                    <div className="text-destructive mt-1">
                      Errors: {importResult.errors.slice(0, 3).join(", ")}
                      {importResult.errors.length > 3 &&
                        ` ...and ${importResult.errors.length - 3} more`}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? "Close" : "Cancel"}
          </Button>
          {parsedData && !importResult && (
            <Button
              onClick={handleImport}
              disabled={isImporting || parsedData.valid.length === 0}
            >
              {isImporting
                ? "Importing..."
                : `Import ${parsedData.valid.length} prospects`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
