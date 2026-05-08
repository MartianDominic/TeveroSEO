/**
 * AnalyticsExportService
 * Phase 96-05: CSV and Google Sheets export
 *
 * Generates CSV exports and Google Sheets from analytics data.
 * Handles large datasets with streaming/batching.
 *
 * Key features:
 * - CSV export with formula injection protection
 * - Google Sheets API integration
 * - Visibility-aware column filtering
 * - Large dataset handling (100K+ rows)
 */
import type { VisibilityConfig } from "@/db/analytics-extended-schema";
import { createLogger } from "@/server/lib/logger";

const logger = createLogger({ module: "analytics-export-service" });

/**
 * Export column definition
 */
export interface ExportColumn {
  key: string;
  header: string;
  format?: "number" | "percent" | "currency" | "date";
}

/**
 * Export options
 */
export interface ExportOptions {
  filename?: string;
  visibilityConfig?: VisibilityConfig;
}

/**
 * Google Sheets export result
 */
export interface SheetsExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Column visibility mapping
 */
const VISIBILITY_COLUMN_MAP: Record<string, keyof VisibilityConfig> = {
  clicks: "showClicks",
  totalClicks: "showClicks",
  clicksChange: "showClicks",
  impressions: "showImpressions",
  totalImpressions: "showImpressions",
  impressionsChange: "showImpressions",
  position: "showPosition",
  avgPosition: "showPosition",
  positionChange: "showPosition",
  ctr: "showCtr",
  avgCtr: "showCtr",
  ctrChange: "showCtr",
  query: "showQueries",
  queries: "showQueries",
  searchQuery: "showQueries",
  pageUrl: "showPages",
  page: "showPages",
  url: "showPages",
  competitors: "showCompetitors",
  competitorDomain: "showCompetitors",
};

export class AnalyticsExportService {
  /**
   * Generate CSV string from data.
   * Handles formula injection protection and large datasets.
   */
  exportToCsv<T extends Record<string, unknown>>(
    data: T[],
    columns: ExportColumn[],
    options?: ExportOptions
  ): string {
    // Filter columns by visibility if config provided
    const visibleColumns = options?.visibilityConfig
      ? this.filterColumnsByVisibility(columns, options.visibilityConfig)
      : columns;

    // Generate header row
    const headers = visibleColumns.map((c) => c.header).join(",");

    if (data.length === 0) {
      return headers;
    }

    // Generate data rows
    const rows = data.map((row) =>
      visibleColumns
        .map((col) => {
          const value = row[col.key];
          const formatted = this.formatValue(value, col.format);
          return this.escapeCsvField(formatted);
        })
        .join(",")
    );

    return [headers, ...rows].join("\n");
  }

  /**
   * Create a Google Sheets spreadsheet with data.
   */
  async exportToGoogleSheets<T extends Record<string, unknown>>(
    data: T[],
    columns: ExportColumn[],
    title: string,
    oauthToken: string,
    options?: ExportOptions
  ): Promise<SheetsExportResult> {
    // Filter columns by visibility if config provided
    const visibleColumns = options?.visibilityConfig
      ? this.filterColumnsByVisibility(columns, options.visibilityConfig)
      : columns;

    // Create spreadsheet
    const createResponse = await fetch(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [
            {
              properties: {
                title: "Data",
                gridProperties: {
                  rowCount: data.length + 1,
                  columnCount: visibleColumns.length,
                },
              },
            },
          ],
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error(
        `Failed to create spreadsheet: ${createResponse.status} ${createResponse.statusText}`
      );
    }

    const spreadsheet = (await createResponse.json()) as {
      spreadsheetId: string;
      spreadsheetUrl: string;
    };

    // Prepare data for batch update
    const headerRow = visibleColumns.map((c) => c.header);
    const dataRows = data.map((row) =>
      visibleColumns.map((col) => {
        const value = row[col.key];
        return this.formatValue(value, col.format);
      })
    );

    const allRows = [headerRow, ...dataRows];

    // Batch update with data
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Data!A1:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            {
              range: `Data!A1:${this.columnLetter(visibleColumns.length)}${allRows.length}`,
              values: allRows,
            },
          ],
        }),
      }
    );

    if (!updateResponse.ok) {
      logger.error('Failed to update spreadsheet data', undefined, {
        status: updateResponse.status,
        spreadsheetId: spreadsheet.spreadsheetId,
      });
    }

    return {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl:
        spreadsheet.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}`,
    };
  }

  /**
   * Filter columns based on visibility configuration.
   */
  filterColumnsByVisibility(
    columns: ExportColumn[],
    config: VisibilityConfig
  ): ExportColumn[] {
    return columns.filter((col) => {
      const visibilityKey = VISIBILITY_COLUMN_MAP[col.key];
      if (!visibilityKey) {
        // Column not in visibility map - always include
        return true;
      }
      return config[visibilityKey];
    });
  }

  /**
   * Format a value based on its type.
   */
  formatValue(
    value: unknown,
    format?: "number" | "percent" | "currency" | "date"
  ): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (format === "percent" && typeof value === "number") {
      return `${Math.round(value * 100)}%`;
    }

    if (format === "date" && value instanceof Date) {
      return value.toISOString().split("T")[0];
    }

    if (format === "number" && typeof value === "number") {
      return value.toString();
    }

    if (format === "currency" && typeof value === "number") {
      return `$${value.toFixed(2)}`;
    }

    return String(value);
  }

  /**
   * Escape a CSV field to prevent formula injection and handle special chars.
   */
  escapeCsvField(value: string): string {
    // Escape formula triggers by prepending single quote
    const formulaTriggers = ["=", "+", "-", "@", "\t", "\r"];
    let escaped = value;

    if (formulaTriggers.some((trigger) => value.startsWith(trigger))) {
      escaped = `'${value}`;
    }

    // If value contains comma, newline, or quote, wrap in quotes
    if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
      // Escape internal quotes by doubling them
      escaped = escaped.replace(/"/g, '""');
      escaped = `"${escaped}"`;
    }

    return escaped;
  }

  /**
   * Split array into chunks of specified size.
   */
  chunkArray<T>(array: T[], size: number): T[][] {
    if (array.length === 0) {
      return [];
    }

    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * CPR-002: Export multiple sections to a single Google Sheet.
   * Each section becomes a separate sheet/tab in the spreadsheet.
   */
  async exportMultiSectionToGoogleSheets(
    sections: { name: string; headers: string[]; rows: string[][] }[],
    title: string,
    oauthToken: string
  ): Promise<SheetsExportResult> {
    // Create spreadsheet with multiple sheets
    const sheetDefinitions = sections.map((section, index) => ({
      properties: {
        title: section.name.slice(0, 31), // Max 31 chars for sheet name
        index,
        gridProperties: {
          rowCount: Math.max(section.rows.length + 1, 10),
          columnCount: Math.max(section.headers.length, 5),
        },
      },
    }));

    const createResponse = await fetch(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title },
          sheets: sheetDefinitions,
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      logger.error("Failed to create spreadsheet", undefined, {
        status: createResponse.status,
        error: errorText,
      });
      throw new Error(
        `Failed to create spreadsheet: ${createResponse.status} ${createResponse.statusText}`
      );
    }

    const spreadsheet = (await createResponse.json()) as {
      spreadsheetId: string;
      spreadsheetUrl: string;
    };

    // Batch update all sheets with data
    const batchData = sections.map((section) => {
      const allRows = [section.headers, ...section.rows];
      const colLetter = this.columnLetter(section.headers.length);
      return {
        range: `'${section.name.slice(0, 31)}'!A1:${colLetter}${allRows.length}`,
        values: allRows,
      };
    });

    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: batchData,
        }),
      }
    );

    if (!updateResponse.ok) {
      const updateErrorText = await updateResponse.text();
      logger.error("Failed to update spreadsheet data", undefined, {
        status: updateResponse.status,
        spreadsheetId: spreadsheet.spreadsheetId,
        error: updateErrorText,
      });
    }

    logger.info("Multi-section Google Sheet created", {
      spreadsheetId: spreadsheet.spreadsheetId,
      sheetCount: sections.length,
      totalRows: sections.reduce((sum, s) => sum + s.rows.length, 0),
    });

    return {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl:
        spreadsheet.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}`,
    };
  }

  /**
   * Convert column index to letter (1=A, 26=Z, 27=AA, etc.)
   */
  private columnLetter(index: number): string {
    let letter = "";
    while (index > 0) {
      const remainder = (index - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      index = Math.floor((index - 1) / 26);
    }
    return letter || "A";
  }
}

// Singleton instance
let instance: AnalyticsExportService | null = null;

export function getAnalyticsExportService(): AnalyticsExportService {
  if (!instance) {
    instance = new AnalyticsExportService();
  }
  return instance;
}

// Reset singleton for testing
export function resetAnalyticsExportService(): void {
  instance = null;
}
