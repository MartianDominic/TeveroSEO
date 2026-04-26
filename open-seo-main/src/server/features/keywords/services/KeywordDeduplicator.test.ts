/**
 * KeywordDeduplicator Tests
 *
 * Tests for keyword normalization and deduplication.
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

describe("KeywordDeduplicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: normalizeKeyword removes diacritics
  describe("normalizeKeyword", () => {
    it('should normalize "Plaukų Dažai" to "plauku dazai" (lowercase, diacritics removed)', async () => {
      const { normalizeKeyword } = await import("./KeywordDeduplicator");

      const result = normalizeKeyword("Plaukų Dažai");

      expect(result).toBe("plauku dazai");
    });

    it("should convert to lowercase", async () => {
      const { normalizeKeyword } = await import("./KeywordDeduplicator");

      const result = normalizeKeyword("SEO TOOLS");

      expect(result).toBe("seo tools");
    });

    it("should trim whitespace", async () => {
      const { normalizeKeyword } = await import("./KeywordDeduplicator");

      const result = normalizeKeyword("  keyword  ");

      expect(result).toBe("keyword");
    });

    it("should collapse multiple spaces", async () => {
      const { normalizeKeyword } = await import("./KeywordDeduplicator");

      const result = normalizeKeyword("multiple   spaces   here");

      expect(result).toBe("multiple spaces here");
    });

    it("should remove Lithuanian diacritics (ą, č, ę, ė, į, š, ų, ū, ž)", async () => {
      const { normalizeKeyword } = await import("./KeywordDeduplicator");

      const result = normalizeKeyword("ąčęėįšųūž");

      expect(result).toBe("aceeisuuz");
    });
  });

  // Test 2: deduplicateKeywords merges duplicates
  describe("KeywordDeduplicator.deduplicateAndInsert", () => {
    it("should merge duplicates and keep higher search volume", async () => {
      const { db } = await import("@/db");
      const mockDb = db as any;

      // Mock: existing keyword with lower volume
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: "kw_existing",
                  keyword: "test keyword",
                  normalizedKeyword: "test keyword",
                  searchVolume: 100, // Lower than new
                  source: "manual",
                },
              ])
            ),
          })),
        })),
      });

      const updateSetMock = vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      }));
      mockDb.update.mockReturnValue({ set: updateSetMock });

      const { KeywordDeduplicator } = await import("./KeywordDeduplicator");
      const deduplicator = new KeywordDeduplicator();

      const result = await deduplicator.deduplicateAndInsert("prospect_1", [
        {
          id: "kw_new",
          prospectId: "prospect_1",
          keyword: "Test Keyword",
          normalizedKeyword: "test keyword",
          source: "csv_upload",
          searchVolume: 500, // Higher than existing
          enrichmentStatus: "pending",
        },
      ]);

      expect(result.merged).toBe(1);
      expect(result.inserted).toBe(0);
    });

    it("should skip duplicates with lower or equal search volume", async () => {
      const { db } = await import("@/db");
      const mockDb = db as any;

      // Mock: existing keyword with higher volume
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: "kw_existing",
                  keyword: "test keyword",
                  normalizedKeyword: "test keyword",
                  searchVolume: 1000, // Higher than new
                  source: "manual",
                },
              ])
            ),
          })),
        })),
      });

      const { KeywordDeduplicator } = await import("./KeywordDeduplicator");
      const deduplicator = new KeywordDeduplicator();

      const result = await deduplicator.deduplicateAndInsert("prospect_1", [
        {
          id: "kw_new",
          prospectId: "prospect_1",
          keyword: "Test Keyword",
          normalizedKeyword: "test keyword",
          source: "csv_upload",
          searchVolume: 500, // Lower than existing
          enrichmentStatus: "pending",
        },
      ]);

      expect(result.skipped).toBe(1);
      expect(result.merged).toBe(0);
    });

    it("should insert new keywords when no duplicate exists", async () => {
      const { db } = await import("@/db");
      const mockDb = db as any;

      // Mock: no existing keyword
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      const insertValuesMock = vi.fn(() => Promise.resolve());
      mockDb.insert.mockReturnValue({ values: insertValuesMock });

      const { KeywordDeduplicator } = await import("./KeywordDeduplicator");
      const deduplicator = new KeywordDeduplicator();

      const result = await deduplicator.deduplicateAndInsert("prospect_1", [
        {
          id: "kw_new",
          prospectId: "prospect_1",
          keyword: "Brand New Keyword",
          normalizedKeyword: "brand new keyword",
          source: "manual",
          searchVolume: null,
          enrichmentStatus: "pending",
        },
      ]);

      expect(result.inserted).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });
});
