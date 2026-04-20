/**
 * CSV Export Utility
 *
 * Generates CSV files with proper escaping and triggers browser download.
 */

export interface CSVColumn<T> {
  key: keyof T | string;
  header: string;
  /** Optional formatter for the cell value */
  format?: (value: unknown, row: T) => string;
}

/**
 * Escapes a value for CSV format.
 * Handles commas, quotes, newlines, and special characters.
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Check if escaping is needed
  const needsEscaping =
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r") ||
    stringValue.includes("\t");

  if (needsEscaping) {
    // Escape double quotes by doubling them, then wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Gets a nested value from an object using dot notation.
 * e.g., getValue(obj, "user.name") returns obj.user.name
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Generates CSV content from data array.
 */
export function generateCSVContent<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  // Generate header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(",");

  // Generate data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = getNestedValue(row, col.key as string);
        const formattedValue = col.format
          ? col.format(rawValue, row)
          : rawValue;
        return escapeCSVValue(formattedValue);
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Generates a CSV file and triggers browser download.
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  const csvContent = generateCSVContent(data, columns);

  // Add BOM for Excel compatibility with UTF-8
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  triggerDownload(blob, ensureExtension(filename, ".csv"));
}

/**
 * Triggers a browser download for a blob.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Cleanup
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

/**
 * Ensures a filename has the specified extension.
 */
function ensureExtension(filename: string, extension: string): string {
  if (filename.toLowerCase().endsWith(extension.toLowerCase())) {
    return filename;
  }
  return `${filename}${extension}`;
}

/**
 * Generates a timestamped filename.
 */
export function generateTimestampedFilename(
  prefix: string,
  extension: string = ".csv"
): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `${prefix}-${timestamp}${extension}`;
}
