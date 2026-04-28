"use server";

/**
 * CSV Import Server Actions
 * Phase 43-03: CSV Import + Metric Detection
 */

export interface ColumnMapping {
  sourceColumn: string;
  targetField:
    | "keyword"
    | "volume"
    | "difficulty"
    | "cpc"
    | "position"
    | "url"
    | "ignore";
  confidence: number;
  sampleValue: string;
}

export interface CsvPreviewResponse {
  detection: {
    detectedFormat: string;
    hasMetrics: {
      volume: boolean;
      difficulty: boolean;
      cpc: boolean;
      position: boolean;
    };
    mappings: ColumnMapping[];
    enrichmentNeeded: boolean;
    estimatedCost: number;
  };
  previewRows: Record<string, string>[];
  totalRows: number;
}

export interface CsvImportResponse {
  detection: CsvPreviewResponse["detection"];
  rowsParsed: number;
  rowsSkipped: number;
  importResult: {
    inserted: number;
    merged: number;
    skipped: number;
    keywordIds: string[];
    enrichment?: {
      enriched: number;
      cached: number;
      skipped: number;
      failed: number;
      totalCostCents: number;
    };
  };
  warnings: string[];
}

/**
 * Preview CSV without importing - detect format and return mappings.
 */
export async function previewCsv(
  prospectId: string,
  csvContent: string
): Promise<CsvPreviewResponse> {
  const openSeoUrl = process.env.OPEN_SEO_URL || "http://localhost:3001";

  const response = await fetch(
    `${openSeoUrl}/api/prospects/${prospectId}/keywords/import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Preview": "true",
      },
      body: JSON.stringify({ csvContent }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Preview failed" }));
    throw new Error(error.error || "Preview failed");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Import CSV with optional mapping overrides.
 */
export async function importCsv(
  prospectId: string,
  csvContent: string,
  mappingOverrides?: ColumnMapping[],
  forceEnrich?: boolean
): Promise<CsvImportResponse> {
  const openSeoUrl = process.env.OPEN_SEO_URL || "http://localhost:3001";

  const response = await fetch(
    `${openSeoUrl}/api/prospects/${prospectId}/keywords/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csvContent,
        mappingOverrides,
        forceEnrich,
        mergeWithExisting: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Import failed" }));
    throw new Error(error.error || "Import failed");
  }

  const result = await response.json();
  return result.data;
}
