/**
 * Tests for AnalyticsExportService
 * Phase 96-05: CSV and Google Sheets export
 *
 * TDD RED phase - tests for export functionality
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsExportService } from "./AnalyticsExportService";
import { DEFAULT_VISIBILITY, type VisibilityConfig } from "@/db/analytics-extended-schema";

describe("AnalyticsExportService", () => {
  let service: AnalyticsExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnalyticsExportService();
  });

  describe("exportToCsv", () => {
    const columns = [
      { key: "url", header: "URL" },
      { key: "clicks", header: "Clicks" },
      { key: "impressions", header: "Impressions" },
      { key: "ctr", header: "CTR", format: "percent" as const },
    ];

    const data = [
      { url: "/page1", clicks: 100, impressions: 1000, ctr: 0.1 },
      { url: "/page2", clicks: 50, impressions: 500, ctr: 0.1 },
    ];

    it("should generate CSV with headers", () => {
      const csv = service.exportToCsv(data, columns);

      expect(csv).toContain("URL,Clicks,Impressions,CTR");
    });

    it("should include data rows", () => {
      const csv = service.exportToCsv(data, columns);
      const lines = csv.split("\n");

      expect(lines.length).toBe(3); // header + 2 data rows
      expect(lines[1]).toContain("/page1");
      expect(lines[1]).toContain("100");
    });

    it("should format percentages correctly", () => {
      const csv = service.exportToCsv(data, columns);

      expect(csv).toContain("10%"); // 0.1 formatted as 10%
    });

    it("should escape formula triggers (=, +, -, @)", () => {
      const formulaData = [
        { url: "=IMPORTRANGE(...)", clicks: 100, impressions: 1000, ctr: 0.1 },
        { url: "+1234567890", clicks: 50, impressions: 500, ctr: 0.1 },
        { url: "-malicious", clicks: 25, impressions: 250, ctr: 0.1 },
        { url: "@mention", clicks: 10, impressions: 100, ctr: 0.1 },
      ];

      const csv = service.exportToCsv(formulaData, columns);

      // Formula triggers should be escaped with single quote
      expect(csv).toContain("'=IMPORTRANGE");
      expect(csv).toContain("'+1234567890");
      expect(csv).toContain("'-malicious");
      expect(csv).toContain("'@mention");
    });

    it("should escape commas and quotes in values", () => {
      const commaData = [
        { url: 'Page "with" quotes, and comma', clicks: 100, impressions: 1000, ctr: 0.1 },
      ];

      const csv = service.exportToCsv(commaData, columns);

      // Should be wrapped in quotes with escaped internal quotes
      expect(csv).toContain('"Page ""with"" quotes, and comma"');
    });

    it("should handle large datasets (100K+ rows)", () => {
      // Generate 100,000 rows
      const largeData = Array.from({ length: 100000 }, (_, i) => ({
        url: `/page${i}`,
        clicks: Math.floor(Math.random() * 1000),
        impressions: Math.floor(Math.random() * 10000),
        ctr: Math.random(),
      }));

      const startTime = Date.now();
      const csv = service.exportToCsv(largeData, columns);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (<5s)
      expect(duration).toBeLessThan(5000);

      // Should have correct number of lines
      const lineCount = csv.split("\n").length;
      expect(lineCount).toBe(100001); // header + 100K rows
    });

    it("should filter columns by visibility config", () => {
      const config: VisibilityConfig = {
        ...DEFAULT_VISIBILITY,
        showClicks: false,
      };

      const csv = service.exportToCsv(data, columns, { visibilityConfig: config });

      // Should not include Clicks column
      expect(csv).not.toContain("Clicks");
      expect(csv).toContain("URL");
      expect(csv).toContain("Impressions");
    });

    it("should handle empty data array", () => {
      const csv = service.exportToCsv([], columns);

      // Should only have headers
      expect(csv).toBe("URL,Clicks,Impressions,CTR");
    });

    it("should format numbers correctly", () => {
      const numberData = [
        { url: "/page1", clicks: 1234567, impressions: 9876543, ctr: 0.125 },
      ];
      const numberColumns = [
        { key: "url", header: "URL" },
        { key: "clicks", header: "Clicks", format: "number" as const },
        { key: "impressions", header: "Impressions", format: "number" as const },
      ];

      const csv = service.exportToCsv(numberData, numberColumns);

      expect(csv).toContain("1234567");
    });

    it("should format dates correctly", () => {
      const dateData = [
        { url: "/page1", date: new Date("2024-01-15"), clicks: 100 },
      ];
      const dateColumns = [
        { key: "url", header: "URL" },
        { key: "date", header: "Date", format: "date" as const },
        { key: "clicks", header: "Clicks" },
      ];

      const csv = service.exportToCsv(dateData, dateColumns);

      expect(csv).toContain("2024-01-15");
    });
  });

  describe("chunkArray", () => {
    it("should split array into chunks of specified size", () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = service.chunkArray(arr, 3);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });

    it("should handle empty array", () => {
      const chunks = service.chunkArray([], 3);
      expect(chunks).toEqual([]);
    });

    it("should handle array smaller than chunk size", () => {
      const chunks = service.chunkArray([1, 2], 5);
      expect(chunks).toEqual([[1, 2]]);
    });
  });

  describe("filterColumnsByVisibility", () => {
    const columns = [
      { key: "clicks", header: "Clicks" },
      { key: "impressions", header: "Impressions" },
      { key: "position", header: "Position" },
      { key: "ctr", header: "CTR" },
      { key: "query", header: "Query" },
      { key: "pageUrl", header: "Page URL" },
    ];

    it("should remove clicks column when showClicks is false", () => {
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showClicks: false };
      const filtered = service.filterColumnsByVisibility(columns, config);

      expect(filtered.find(c => c.key === "clicks")).toBeUndefined();
      expect(filtered.find(c => c.key === "impressions")).toBeDefined();
    });

    it("should remove position column when showPosition is false", () => {
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showPosition: false };
      const filtered = service.filterColumnsByVisibility(columns, config);

      expect(filtered.find(c => c.key === "position")).toBeUndefined();
    });

    it("should remove query column when showQueries is false", () => {
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showQueries: false };
      const filtered = service.filterColumnsByVisibility(columns, config);

      expect(filtered.find(c => c.key === "query")).toBeUndefined();
    });

    it("should keep all columns when all visibility flags are true", () => {
      const config: VisibilityConfig = {
        ...DEFAULT_VISIBILITY,
        showClicks: true,
        showImpressions: true,
        showPosition: true,
        showCtr: true,
        showQueries: true,
        showPages: true,
      };
      const filtered = service.filterColumnsByVisibility(columns, config);

      expect(filtered.length).toBe(columns.length);
    });
  });

  describe("formatValue", () => {
    it("should format number values", () => {
      expect(service.formatValue(1234.567, "number")).toBe("1234.567");
    });

    it("should format percent values", () => {
      expect(service.formatValue(0.1234, "percent")).toBe("12%");
    });

    it("should format date values", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      expect(service.formatValue(date, "date")).toBe("2024-01-15");
    });

    it("should handle null values", () => {
      expect(service.formatValue(null, "number")).toBe("");
    });

    it("should handle undefined values", () => {
      expect(service.formatValue(undefined, "number")).toBe("");
    });

    it("should handle string values without format", () => {
      expect(service.formatValue("hello", undefined)).toBe("hello");
    });
  });

  describe("exportToGoogleSheets", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
    });

    it("should create a new spreadsheet", async () => {
      // Mock spreadsheet creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          spreadsheetId: "sheet-123",
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123",
        }),
      });

      // Mock batch update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const data = [{ url: "/page1", clicks: 100 }];
      const columns = [
        { key: "url", header: "URL" },
        { key: "clicks", header: "Clicks" },
      ];

      const result = await service.exportToGoogleSheets(
        data,
        columns,
        "Test Export",
        "oauth-token-123"
      );

      expect(result.spreadsheetId).toBe("sheet-123");
      expect(result.spreadsheetUrl).toContain("sheet-123");
    });

    it("should batch data in 1000-row chunks", async () => {
      // Generate 2500 rows (should be 3 batches)
      const data = Array.from({ length: 2500 }, (_, i) => ({
        url: `/page${i}`,
        clicks: i,
      }));
      const columns = [
        { key: "url", header: "URL" },
        { key: "clicks", header: "Clicks" },
      ];

      // Mock spreadsheet creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          spreadsheetId: "sheet-123",
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123",
        }),
      });

      // Mock batch updates (should be called once with all data)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await service.exportToGoogleSheets(data, columns, "Test Export", "oauth-token-123");

      // Verify batch update was called
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const data = [{ url: "/page1", clicks: 100 }];
      const columns = [
        { key: "url", header: "URL" },
        { key: "clicks", header: "Clicks" },
      ];

      await expect(
        service.exportToGoogleSheets(data, columns, "Test Export", "invalid-token")
      ).rejects.toThrow("Failed to create spreadsheet");
    });
  });
});
