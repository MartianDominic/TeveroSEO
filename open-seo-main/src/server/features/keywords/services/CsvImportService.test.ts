/**
 * CsvImportService Tests
 *
 * Tests for CSV parsing and import with auto-detection and merge behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock KeywordInputService
vi.mock("./KeywordInputService", () => ({
  keywordInputService: {
    addKeywords: vi.fn(() =>
      Promise.resolve({
        inserted: 3,
        merged: 0,
        skipped: 0,
        keywordIds: ["kw_1", "kw_2", "kw_3"],
      })
    ),
  },
}));

// Mock KeywordEnrichmentService
vi.mock("./KeywordEnrichmentService", () => ({
  keywordEnrichmentService: {
    enrichBatch: vi.fn(() =>
      Promise.resolve({
        enriched: 0,
        cached: 0,
        skipped: 0,
        failed: 0,
        totalCostCents: 0,
      })
    ),
  },
}));

describe("CsvImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("previewCsv", () => {
    it("parses CSV and returns detection with preview rows", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume,KD
seo tools,12000,34
digital marketing,22000,67
content strategy,8000,45`;

      const result = service.previewCsv(csvContent);

      expect(result.detection.detectedFormat).toBeDefined();
      expect(result.detection.hasMetrics.volume).toBe(true);
      expect(result.detection.hasMetrics.difficulty).toBe(true);
      expect(result.totalRows).toBe(3);
      expect(result.previewRows.length).toBeLessThanOrEqual(5);
    });

    it("handles BOM at start of file", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      // BOM character + CSV content
      const csvContent = `﻿Keyword,Volume
test keyword,1000`;

      const result = service.previewCsv(csvContent);

      expect(result.detection.mappings[0].sourceColumn).toBe("Keyword");
      expect(result.totalRows).toBe(1);
    });

    it("handles CRLF line endings", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      const csvContent = "Keyword,Volume\r\ntest keyword,1000\r\ntest keyword 2,2000";

      const result = service.previewCsv(csvContent);

      expect(result.totalRows).toBe(2);
    });

    it("throws error for empty CSV", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      expect(() => service.previewCsv("Keyword")).toThrow(
        "CSV must have header row and at least one data row"
      );
    });
  });

  describe("importCsv", () => {
    it("parses CSV with auto-detected mappings", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const { keywordInputService } = await import("./KeywordInputService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume,KD
seo tools,12000,34
digital marketing,22000,67`;

      const result = await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      expect(keywordInputService.addKeywords).toHaveBeenCalledWith(
        expect.objectContaining({
          prospectId: "prospect_1",
          entryPoint: "csv_import",
        })
      );
      expect(result.rowsParsed).toBe(2);
      expect(result.importResult.inserted).toBe(3);
    });

    it("uses provided mappings when overridden", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const { keywordInputService } = await import("./KeywordInputService");
      const service = new CsvImportService();

      const csvContent = `Term,Searches,Score
seo tools,12000,34`;

      const mappingOverrides = [
        { sourceColumn: "Term", targetField: "keyword" as const, confidence: 1, sampleValue: "seo tools" },
        { sourceColumn: "Searches", targetField: "volume" as const, confidence: 1, sampleValue: "12000" },
        { sourceColumn: "Score", targetField: "difficulty" as const, confidence: 1, sampleValue: "34" },
      ];

      const result = await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
        mappingOverrides,
      });

      expect(result.rowsParsed).toBe(1);
      // Verify the keywords were parsed with correct volume
      const addKeywordsCall = (keywordInputService.addKeywords as any).mock.calls[0][0];
      expect(addKeywordsCall.keywords[0].searchVolume).toBe(12000);
    });

    it("sets autoEnrich=false when metrics are present", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const { keywordInputService } = await import("./KeywordInputService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume,Difficulty
test keyword,1000,30`;

      await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      const call = (keywordInputService.addKeywords as any).mock.calls[0][0];
      expect(call.autoEnrich).toBe(false);
    });

    it("sets autoEnrich=true when metrics are missing", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const { keywordInputService } = await import("./KeywordInputService");
      const service = new CsvImportService();

      const csvContent = `Keyword
test keyword`;

      await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      const call = (keywordInputService.addKeywords as any).mock.calls[0][0];
      expect(call.autoEnrich).toBe(true);
    });

    it("skips rows with empty keyword", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume
seo tools,12000
,5000
content strategy,8000`;

      const result = await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      expect(result.rowsParsed).toBe(2);
      expect(result.rowsSkipped).toBe(1);
    });

    it("reports accurate import statistics", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume,KD
keyword 1,1000,30
keyword 2,2000,40
keyword 3,3000,50`;

      const result = await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      expect(result.rowsParsed).toBe(3);
      expect(result.rowsSkipped).toBe(0);
      expect(result.detection.detectedFormat).toBeDefined();
      expect(result.importResult).toBeDefined();
    });
  });

  describe("cleaning and parsing", () => {
    it("handles mixed line endings", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const service = new CsvImportService();

      // Mix of CR, LF, and CRLF
      const csvContent = "Keyword,Volume\rtest 1,1000\ntest 2,2000\r\ntest 3,3000";

      const result = service.previewCsv(csvContent);

      expect(result.totalRows).toBe(3);
    });

    it("trims whitespace from values", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const { keywordInputService } = await import("./KeywordInputService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume
  seo tools  ,  12000  `;

      await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      const call = (keywordInputService.addKeywords as any).mock.calls[0][0];
      expect(call.keywords[0].keyword).toBe("seo tools");
      expect(call.keywords[0].searchVolume).toBe(12000);
    });

    it("parses CPC values with currency symbols", async () => {
      const { CsvImportService } = await import("./CsvImportService");
      const { keywordInputService } = await import("./KeywordInputService");
      const service = new CsvImportService();

      const csvContent = `Keyword,Volume,CPC
seo tools,12000,$2.50`;

      await service.importCsv({
        prospectId: "prospect_1",
        csvContent,
      });

      const call = (keywordInputService.addKeywords as any).mock.calls[0][0];
      expect(call.keywords[0].cpc).toBe(2.5);
    });
  });
});
