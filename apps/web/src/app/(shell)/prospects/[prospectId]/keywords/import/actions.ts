"use server";

/**
 * CSV Import Server Actions
 * Phase 43-03: CSV Import + Metric Detection
 */

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { requireActionAuth, validateProspectOwnership } from "@/lib/auth/action-auth";

/** Maximum CSV content size: 5MB */
const MAX_CSV_SIZE = 5 * 1024 * 1024;

/** Input validation schemas */
const prospectIdSchema = z.string().uuid("Invalid prospect ID format");
const csvContentSchema = z.string().max(MAX_CSV_SIZE, `CSV content too large (max ${MAX_CSV_SIZE / 1024 / 1024}MB)`);

/** Default timeout for API requests (30 seconds) */
const API_TIMEOUT_MS = 30000;

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
  const authContext = await requireActionAuth();

  // Validate inputs
  const validatedProspectId = prospectIdSchema.parse(prospectId);
  const validatedCsvContent = csvContentSchema.parse(csvContent);

  // Validate ownership - user must have access to this prospect
  await validateProspectOwnership(validatedProspectId, authContext);

  const { getToken } = await auth();
  const token = await getToken();

  const response = await fetch(
    `${env.OPEN_SEO_URL}/api/prospects/${validatedProspectId}/keywords/import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Preview": "true",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ csvContent: validatedCsvContent }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
    } catch {
      // Response wasn't JSON (e.g., 502 HTML from nginx)
    }
    throw new Error(errorMessage);
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
  const authContext = await requireActionAuth();

  // Validate inputs
  const validatedProspectId = prospectIdSchema.parse(prospectId);
  const validatedCsvContent = csvContentSchema.parse(csvContent);

  // Validate ownership - user must have access to this prospect
  await validateProspectOwnership(validatedProspectId, authContext);

  const { getToken } = await auth();
  const token = await getToken();

  // Use longer timeout for imports (60 seconds) as they may process many rows
  const IMPORT_TIMEOUT_MS = 60000;

  const response = await fetch(
    `${env.OPEN_SEO_URL}/api/prospects/${validatedProspectId}/keywords/import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        csvContent: validatedCsvContent,
        mappingOverrides,
        forceEnrich,
        mergeWithExisting: true,
      }),
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
    } catch {
      // Response wasn't JSON (e.g., 502 HTML from nginx)
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  return result.data;
}
