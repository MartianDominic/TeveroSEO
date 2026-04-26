/**
 * CsvImportService
 *
 * CSV parsing and import with auto-detection of Ahrefs, SEMrush, Moz formats.
 * Handles BOM, various line endings, and metric presence detection.
 */

import { parse } from "csv-parse/sync";
import {
  columnDetector,
  type ColumnMapping,
  type CsvColumnDetection,
} from "./ColumnDetector";
import { keywordInputService } from "./KeywordInputService";
import type { AddKeywordsResult } from "./KeywordInputService";

export interface CsvImportOptions {
  prospectId: string;
  csvContent: string;
  mappingOverrides?: ColumnMapping[];
  forceEnrich?: boolean;
  mergeWithExisting?: boolean;
}

export interface CsvImportResult {
  detection: CsvColumnDetection;
  rowsParsed: number;
  rowsSkipped: number;
  importResult: AddKeywordsResult;
  warnings: string[];
}

export interface CsvPreviewResult {
  detection: CsvColumnDetection;
  previewRows: Record<string, string>[];
  totalRows: number;
}

export class CsvImportService {
  /**
   * Preview CSV without importing - just detect format and show mappings.
   */
  previewCsv(csvContent: string): CsvPreviewResult {
    const cleanedContent = this.cleanCsvContent(csvContent);
    const records = parse(cleanedContent, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];

    if (records.length < 2) {
      throw new Error("CSV must have header row and at least one data row");
    }

    const headers = records[0];
    const sampleRow = records[1];
    const detection = columnDetector.detectFormat(headers, sampleRow);

    // Create preview rows (first 5)
    const previewRows = records.slice(1, 6).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || "";
      });
      return obj;
    });

    return {
      detection,
      previewRows,
      totalRows: records.length - 1,
    };
  }

  /**
   * Import CSV with detected or overridden mappings.
   */
  async importCsv(options: CsvImportOptions): Promise<CsvImportResult> {
    const {
      prospectId,
      csvContent,
      mappingOverrides,
      forceEnrich = false,
    } = options;

    const cleanedContent = this.cleanCsvContent(csvContent);
    const records = parse(cleanedContent, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];

    if (records.length < 2) {
      throw new Error("CSV must have header row and at least one data row");
    }

    const headers = records[0];
    const sampleRow = records[1];
    let detection = columnDetector.detectFormat(headers, sampleRow);

    // Apply mapping overrides
    if (mappingOverrides) {
      detection = {
        ...detection,
        mappings: mappingOverrides,
        enrichmentNeeded:
          forceEnrich ||
          !mappingOverrides.some((m) => m.targetField === "volume"),
      };
    }

    const warnings: string[] = [];
    let rowsSkipped = 0;

    // Build mapping index: targetField -> column index
    const fieldToColumn: Record<string, number> = {};
    detection.mappings.forEach((mapping, idx) => {
      if (mapping.targetField !== "ignore") {
        fieldToColumn[mapping.targetField] = idx;
      }
    });

    // Check if keyword column is mapped
    if (fieldToColumn.keyword === undefined) {
      warnings.push("No keyword column mapped");
      return {
        detection,
        rowsParsed: 0,
        rowsSkipped: records.length - 1,
        importResult: {
          inserted: 0,
          merged: 0,
          skipped: 0,
          keywordIds: [],
        },
        warnings,
      };
    }

    // Parse data rows
    const keywords: Array<{
      keyword: string;
      searchVolume?: number;
      keywordDifficulty?: number;
      cpc?: number;
      currentPosition?: number;
      currentUrl?: string;
      sourceMetadata: { csvRowNumber: number; csvFileName?: string };
    }> = [];

    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const keywordIdx = fieldToColumn.keyword;

      const keyword = row[keywordIdx]?.trim();
      if (!keyword) {
        rowsSkipped++;
        continue;
      }

      const entry: (typeof keywords)[number] = {
        keyword,
        sourceMetadata: { csvRowNumber: i + 1 },
      };

      // Parse optional fields
      if (fieldToColumn.volume !== undefined) {
        const val = columnDetector.parseNumericValue(row[fieldToColumn.volume]);
        if (val !== null) entry.searchVolume = val;
      }

      if (fieldToColumn.difficulty !== undefined) {
        const val = columnDetector.parseNumericValue(
          row[fieldToColumn.difficulty]
        );
        if (val !== null) entry.keywordDifficulty = val;
      }

      if (fieldToColumn.cpc !== undefined) {
        const val = columnDetector.parseNumericValue(row[fieldToColumn.cpc]);
        if (val !== null) entry.cpc = val;
      }

      if (fieldToColumn.position !== undefined) {
        const val = columnDetector.parseNumericValue(
          row[fieldToColumn.position]
        );
        if (val !== null) entry.currentPosition = Math.round(val);
      }

      if (fieldToColumn.url !== undefined) {
        entry.currentUrl = row[fieldToColumn.url]?.trim() || undefined;
      }

      keywords.push(entry);
    }

    // Determine if enrichment is needed
    const hasVolumeData = keywords.some((kw) => kw.searchVolume !== undefined);
    const hasDifficultyData = keywords.some(
      (kw) => kw.keywordDifficulty !== undefined
    );
    const needsEnrichment =
      forceEnrich || !hasVolumeData || !hasDifficultyData;

    // Import via KeywordInputService
    const importResult = await keywordInputService.addKeywords({
      prospectId,
      entryPoint: "csv_import",
      keywords,
      autoEnrich: needsEnrichment,
    });

    return {
      detection,
      rowsParsed: keywords.length,
      rowsSkipped,
      importResult,
      warnings,
    };
  }

  /**
   * Clean CSV content: handle BOM, normalize line endings.
   */
  private cleanCsvContent(content: string): string {
    // Remove BOM (both UTF-8 BOM and the escaped version)
    let cleaned = content.replace(/^﻿/, "").replace(/^﻿/, "");

    // Normalize line endings: CR -> LF, CRLF -> LF
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    return cleaned;
  }
}

export const csvImportService = new CsvImportService();
