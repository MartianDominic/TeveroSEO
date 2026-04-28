/**
 * CSV parser for prospect import.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Uses papaparse to parse CSV content and validates with Zod schema.
 * Normalizes common header variations to expected field names.
 */
import Papa from "papaparse";
import {
  validateCsvRows,
  type ValidationResult,
  type CsvRow,
} from "./prospectCsvSchema";

export interface ParseResult extends ValidationResult {
  /** Total number of data rows in the CSV (excluding header) */
  totalRows: number;
  /** Number of duplicate domains removed during validation */
  duplicatesRemoved: number;
}

/**
 * Parse CSV content and validate rows for prospect import.
 *
 * Header normalization:
 * - company, company_name -> companyName
 * - email, contact_email -> contactEmail
 * - name, contact_name -> contactName
 *
 * @param csvContent - Raw CSV string content
 * @returns ParseResult with valid rows, invalid rows, and counts
 */
export function parseProspectCsv(csvContent: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
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
      // Return trimmed original to preserve casing for unknown headers
      return header.trim();
    },
  });

  const validation = validateCsvRows(parsed.data);

  // Duplicates = total - valid - invalid
  // (rows that were valid but had a duplicate domain already seen)
  const duplicatesRemoved =
    parsed.data.length - validation.valid.length - validation.invalid.length;

  return {
    ...validation,
    totalRows: parsed.data.length,
    duplicatesRemoved,
  };
}

export type { CsvRow, ValidationResult };
