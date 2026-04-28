/**
 * CSV validation schema for prospect import.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Validates and transforms CSV rows for bulk prospect creation.
 * T-30.5-01: Server-side zod validation revalidates all rows.
 * T-30.5-04: sanitizeCsvValue prevents formula injection (OWASP).
 */
import { z } from "zod";

/**
 * Normalize a domain string for storage.
 * Removes protocol, www prefix, path, and port.
 * Lowercases the result.
 */
function normalizeDomain(domain: string): string {
  // Remove protocol if present
  let normalized = domain.replace(/^https?:\/\//, "");
  // Remove www. prefix
  normalized = normalized.replace(/^www\./, "");
  // Remove trailing slash and path (including query string)
  normalized = normalized.split("/")[0];
  normalized = normalized.split("?")[0];
  // Remove port
  normalized = normalized.split(":")[0];
  // Lowercase and trim
  return normalized.toLowerCase().trim();
}

/**
 * Sanitize CSV value to prevent formula injection.
 * Prefixes dangerous characters with single quote (OWASP guidance).
 * Characters: =, +, -, @, tab, carriage return, newline
 */
function sanitizeCsvValue(value: string): string {
  if (value.length === 0) return value;
  const firstChar = value[0];
  if (["=", "+", "-", "@", "\t", "\r", "\n"].includes(firstChar)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Zod schema for a single CSV row.
 * Domain is required, all other fields are optional.
 * Transforms: domain normalization, CSV injection sanitization.
 */
export const csvRowSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .transform(normalizeDomain),
  companyName: z
    .string()
    .optional()
    .transform((v) => (v ? sanitizeCsvValue(v) : v)),
  contactEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  contactName: z
    .string()
    .optional()
    .transform((v) => (v ? sanitizeCsvValue(v) : v)),
  industry: z.string().optional(),
  notes: z
    .string()
    .optional()
    .transform((v) => (v ? sanitizeCsvValue(v) : v)),
  source: z.string().optional(),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export interface ValidationResult {
  valid: CsvRow[];
  invalid: Array<{
    rowIndex: number;
    row: Record<string, unknown>;
    errors: string[];
  }>;
}

/**
 * Validate an array of parsed CSV rows.
 * Returns valid rows (deduplicated by domain) and invalid rows with errors.
 *
 * T-30.5-01: All rows are validated server-side before database insertion.
 * Deduplication keeps first occurrence of each domain.
 */
export function validateCsvRows(
  rows: Record<string, unknown>[]
): ValidationResult {
  const valid: CsvRow[] = [];
  const invalid: ValidationResult["invalid"] = [];
  const seenDomains = new Set<string>();

  rows.forEach((row, index) => {
    const result = csvRowSchema.safeParse(row);
    if (result.success) {
      // Deduplicate by normalized domain (keeps first occurrence)
      if (!seenDomains.has(result.data.domain)) {
        seenDomains.add(result.data.domain);
        valid.push(result.data);
      }
      // If duplicate, silently skip (counted in duplicatesRemoved)
    } else {
      invalid.push({
        rowIndex: index + 1, // 1-indexed for user display
        row,
        errors: result.error.issues.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        ),
      });
    }
  });

  return { valid, invalid };
}
