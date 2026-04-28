/**
 * CSV export utilities for keyword gap analysis
 * Phase 28: Keyword Gap Analysis UI
 */
import type { KeywordGap } from "@/db/prospect-schema";

/**
 * Characters that can trigger formula execution in Excel/Google Sheets
 * Prefixing with a tab character prevents execution while preserving display
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Escapes a CSV field value to prevent CSV injection and handle special characters
 * - Prefixes formula-triggering characters with tab to prevent execution
 * - Escapes double quotes by doubling them
 * - Wraps in quotes if contains commas, quotes, or newlines
 */
function escapeCsvField(value: string | number): string {
  let stringValue = String(value);

  // Sanitize formula-triggering characters by prefixing with tab
  if (FORMULA_TRIGGERS.some((trigger) => stringValue.startsWith(trigger))) {
    stringValue = `\t${stringValue}`;
  }

  // Check if quoting is needed (commas, quotes, or newlines)
  const needsQuoting =
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r");

  if (needsQuoting) {
    // Escape double quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

/**
 * Generates a CSV string from keyword gap data
 * @param gaps - Array of keyword gaps to export
 * @returns CSV string with headers and data rows
 */
export function exportKeywordGaps(gaps: KeywordGap[]): string {
  const headers = [
    "Keyword",
    "Competitor",
    "Position",
    "Search Volume",
    "CPC",
    "Difficulty",
    "Opportunity Score",
  ];

  const rows = gaps.map((gap) => [
    escapeCsvField(gap.keyword),
    gap.competitorDomain,
    gap.competitorPosition,
    gap.searchVolume,
    gap.cpc.toFixed(2),
    gap.difficulty,
    gap.trafficPotential,
  ]);

  const csvLines = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ];

  return csvLines.join("\n");
}

/**
 * Triggers a browser download of CSV data
 * @param csvContent - CSV string content
 * @param filename - Name of the file to download
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generates a filename for keyword gap export
 * @param domain - Prospect domain
 * @param suffix - Optional suffix to append (e.g., "quick-wins")
 * @returns Filename in format: keyword-gaps-{domain}[-{suffix}]-{date}.csv
 */
export function generateExportFilename(domain: string, suffix?: string): string {
  const date = new Date().toISOString().split("T")[0];
  const sanitizedDomain = domain.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const suffixPart = suffix ? `-${suffix}` : "";
  return `keyword-gaps-${sanitizedDomain}${suffixPart}-${date}.csv`;
}
