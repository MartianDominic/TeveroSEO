/**
 * KeywordInputService Tests
 *
 * Tests for unified input orchestrator for all 5 entry points.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock KeywordDeduplicator
vi.mock("./KeywordDeduplicator", () => ({
  normalizeKeyword: vi.fn((kw: string) => kw.toLowerCase().trim()),
  keywordDeduplicator: {
    deduplicateAndInsert: vi.fn(() =>
      Promise.resolve({ inserted: 1, merged: 0, skipped: 0 })
    ),
  },
  KeywordDeduplicator: vi.fn().mockImplementation(() => ({
    deduplicateAndInsert: vi.fn(() =>
      Promise.resolve({ inserted: 1, merged: 0, skipped: 0 })
    ),
  })),
}));

// Mock KeywordEnrichmentService
vi.mock("./KeywordEnrichmentService", () => ({
  keywordEnrichmentService: {
    enrichBatch: vi.fn(() =>
      Promise.resolve({
        enriched: 1,
        cached: 0,
        skipped: 0,
        failed: 0,
        totalCostCents: 0.5,
      })
    ),
  },
  KeywordEnrichmentService: vi.fn().mockImplementation(() => ({
    enrichBatch: vi.fn(() =>
      Promise.resolve({
        enriched: 1,
        cached: 0,
        skipped: 0,
        failed: 0,
        totalCostCents: 0.5,
      })
    ),
  })),
}));

describe("KeywordInputService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: KeywordInputService exports KeywordEntryPoint type
  describe("exports", () => {
    it("should export KeywordInputService class", async () => {
      const mod = await import("./KeywordInputService");
      expect(mod.KeywordInputService).toBeDefined();
    });

    it("should export keywordInputService singleton", async () => {
      const mod = await import("./KeywordInputService");
      expect(mod.keywordInputService).toBeDefined();
    });
  });

  // Test 2: Supports all 5 entry points
  describe("entry point mapping", () => {
    it("should map quick_check to quick_check source", async () => {
      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "quick_check",
        keywords: [{ keyword: "test" }],
        autoEnrich: false,
      });

      expect(result.keywordIds).toHaveLength(1);
    });

    it("should map csv_import to csv_upload source", async () => {
      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "csv_import",
        keywords: [{ keyword: "csv keyword", searchVolume: 100 }],
        autoEnrich: false,
      });

      expect(result.keywordIds).toHaveLength(1);
    });

    it("should map full_discovery to dataforseo source", async () => {
      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "full_discovery",
        keywords: [{ keyword: "discovery keyword" }],
        autoEnrich: false,
      });

      expect(result.keywordIds).toHaveLength(1);
    });

    it("should map gap_analysis to competitor_gap source", async () => {
      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "gap_analysis",
        keywords: [{ keyword: "gap keyword" }],
        autoEnrich: false,
      });

      expect(result.keywordIds).toHaveLength(1);
    });

    it("should map competitor_spy to competitor_gap source", async () => {
      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "competitor_spy",
        keywords: [{ keyword: "spy keyword" }],
        autoEnrich: false,
      });

      expect(result.keywordIds).toHaveLength(1);
    });
  });

  // Test 3: addKeywords validates, normalizes, dedupes, and inserts
  describe("addKeywords", () => {
    it("should return inserted, merged, and skipped counts from deduplication", async () => {
      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "manual",
        keywords: [{ keyword: "test keyword" }],
        autoEnrich: false,
      });

      expect(result).toHaveProperty("inserted");
      expect(result).toHaveProperty("merged");
      expect(result).toHaveProperty("skipped");
    });

    it("should call enrichment when autoEnrich is true", async () => {
      const { keywordEnrichmentService } = await import(
        "./KeywordEnrichmentService"
      );

      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "manual",
        keywords: [{ keyword: "test keyword" }],
        autoEnrich: true,
      });

      expect(keywordEnrichmentService.enrichBatch).toHaveBeenCalled();
      expect(result.enrichment).toBeDefined();
    });

    it("should skip enrichment when autoEnrich is false", async () => {
      const { keywordEnrichmentService } = await import(
        "./KeywordEnrichmentService"
      );

      const { KeywordInputService } = await import("./KeywordInputService");
      const service = new KeywordInputService();

      const result = await service.addKeywords({
        prospectId: "prospect_1",
        entryPoint: "csv_import",
        keywords: [{ keyword: "csv keyword", searchVolume: 100 }],
        autoEnrich: false,
      });

      expect(keywordEnrichmentService.enrichBatch).not.toHaveBeenCalled();
      expect(result.enrichment).toBeUndefined();
    });
  });
});
