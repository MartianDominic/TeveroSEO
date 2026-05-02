import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeywordUniverseBuilder, type DataForSEOAutocomplete } from "./KeywordUniverseBuilder";

describe("KeywordUniverseBuilder", () => {
  let mockDataForSEO: DataForSEOAutocomplete;
  let builder: KeywordUniverseBuilder;

  beforeEach(() => {
    mockDataForSEO = {
      keywords: vi.fn(),
      keywordIdeas: vi.fn(),
      relatedKeywords: vi.fn(),
    };
    builder = new KeywordUniverseBuilder(mockDataForSEO, { concurrency: 2 });
  });

  describe("expand", () => {
    it("should expand seeds into many keywords", async () => {
      // Mock each API to return unique keywords per seed
      let callCount = 0;
      (mockDataForSEO.keywords as ReturnType<typeof vi.fn>).mockImplementation(async (seed) => ({
        keywords: Array(10).fill(null).map((_, i) => `${seed}-autocomplete-${callCount++}-${i}`),
      }));
      (mockDataForSEO.keywordIdeas as ReturnType<typeof vi.fn>).mockImplementation(async (seed) => ({
        keywords: Array(30).fill(null).map((_, i) => ({ keyword: `${seed}-idea-${callCount++}-${i}`, search_volume: 100 })),
      }));
      (mockDataForSEO.relatedKeywords as ReturnType<typeof vi.fn>).mockImplementation(async (seed) => ({
        keywords: Array(10).fill(null).map((_, i) => ({ keyword: `${seed}-related-${callCount++}-${i}`, search_volume: 50 })),
      }));

      const seeds = ["seed1", "seed2", "seed3", "seed4", "seed5"];
      const result = await builder.expand(seeds);

      // 5 seeds + (10+30+10) * 5 = 5 + 250 = 255 raw, all unique
      expect(result.length).toBeGreaterThan(200);
      expect(result.length).toBeLessThan(300);
    });

    it("should deduplicate keywords", async () => {
      (mockDataForSEO.keywords as ReturnType<typeof vi.fn>).mockResolvedValue({
        keywords: ["duplicate", "Duplicate", "DUPLICATE", "unique1"],
      });
      (mockDataForSEO.keywordIdeas as ReturnType<typeof vi.fn>).mockResolvedValue({
        keywords: [{ keyword: "duplicate", search_volume: 100 }, { keyword: "unique2", search_volume: 50 }],
      });
      (mockDataForSEO.relatedKeywords as ReturnType<typeof vi.fn>).mockResolvedValue({
        keywords: [{ keyword: "unique3", search_volume: 25 }],
      });

      const result = await builder.expand(["seed"]);

      // Should deduplicate "duplicate" variations
      const duplicateCount = result.filter(k => k.toLowerCase() === "duplicate").length;
      expect(duplicateCount).toBe(1);
    });

    it("should handle API failures gracefully", async () => {
      (mockDataForSEO.keywords as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API Error"));
      (mockDataForSEO.keywordIdeas as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API Error"));
      (mockDataForSEO.relatedKeywords as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API Error"));

      const result = await builder.expand(["seed1", "seed2"]);

      // Should still return seeds even if expansion fails
      expect(result).toContain("seed1");
      expect(result).toContain("seed2");
    });

    it("should respect concurrency limit", async () => {
      let concurrentCalls = 0;
      let maxConcurrent = 0;

      (mockDataForSEO.keywords as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise(r => setTimeout(r, 10));
        concurrentCalls--;
        return { keywords: ["test"] };
      });
      (mockDataForSEO.keywordIdeas as ReturnType<typeof vi.fn>).mockResolvedValue({ keywords: [] });
      (mockDataForSEO.relatedKeywords as ReturnType<typeof vi.fn>).mockResolvedValue({ keywords: [] });

      await builder.expand(["s1", "s2", "s3", "s4"]);

      // With concurrency: 2, max should be 2
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("should return empty array for empty seeds", async () => {
      const result = await builder.expand([]);
      expect(result).toEqual([]);
      expect(mockDataForSEO.keywords).not.toHaveBeenCalled();
    });
  });

  describe("deduplicate", () => {
    it("should handle Lithuanian diacritics", () => {
      const keywords = ["šampūnas", "sampunas", "ŠAMPŪNAS"];
      const result = builder.deduplicate(keywords);

      // All normalize to same, so only first kept
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("šampūnas");
    });

    it("should preserve order of first occurrence", () => {
      const keywords = ["first", "second", "FIRST", "third", "Second"];
      const result = builder.deduplicate(keywords);

      expect(result).toEqual(["first", "second", "third"]);
    });
  });
});
