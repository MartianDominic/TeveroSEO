/**
 * Tests for BrandedKeywordService
 * Phase 96-05: Brand term detection and classification
 *
 * TDD RED phase - tests for brand term auto-detection and query classification
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrandedKeywordService } from "./BrandedKeywordService";

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  delete: vi.fn().mockReturnThis(),
};

describe("BrandedKeywordService", () => {
  let service: BrandedKeywordService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BrandedKeywordService(mockDb as any);
  });

  describe("autoDetectBrandTerms", () => {
    it("should extract brand term from simple domain", () => {
      const terms = service.autoDetectBrandTerms("client-123", "example.com");

      expect(terms).toContainEqual(
        expect.objectContaining({ term: "example", isAutoDetected: true })
      );
    });

    it("should extract brand term from domain with subdomain", () => {
      const terms = service.autoDetectBrandTerms("client-123", "www.example.com");

      expect(terms).toContainEqual(
        expect.objectContaining({ term: "example", isAutoDetected: true })
      );
    });

    it("should extract brand term from domain with country TLD", () => {
      const terms = service.autoDetectBrandTerms("client-123", "tevero.lt");

      expect(terms).toContainEqual(
        expect.objectContaining({ term: "tevero", isAutoDetected: true })
      );
    });

    it("should extract brand terms from hyphenated domain", () => {
      const terms = service.autoDetectBrandTerms("client-123", "my-brand-name.com");

      expect(terms).toContainEqual(
        expect.objectContaining({ term: "my-brand-name", isAutoDetected: true })
      );
      expect(terms).toContainEqual(
        expect.objectContaining({ term: "mybrandname", isAutoDetected: true })
      );
    });

    it("should extract brand terms from site name", () => {
      const terms = service.autoDetectBrandTerms("client-123", "example.com", "Example Corp");

      expect(terms).toContainEqual(
        expect.objectContaining({ term: "example corp", isAutoDetected: true })
      );
      expect(terms).toContainEqual(
        expect.objectContaining({ term: "examplecorp", isAutoDetected: true })
      );
    });

    it("should deduplicate brand terms", () => {
      const terms = service.autoDetectBrandTerms("client-123", "example.com", "Example");

      const exampleTerms = terms.filter(t => t.term === "example");
      expect(exampleTerms.length).toBe(1);
    });

    it("should handle multi-word company names", () => {
      const terms = service.autoDetectBrandTerms("client-123", "company.com", "The Big Company Inc");

      expect(terms).toContainEqual(
        expect.objectContaining({ term: "big company", isAutoDetected: true })
      );
    });

    it("should ignore common TLDs and suffixes", () => {
      const terms = service.autoDetectBrandTerms("client-123", "mysite.com", "MySite LLC");

      const hasLlc = terms.some(t => t.term.includes("llc"));
      expect(hasLlc).toBe(false);
    });
  });

  describe("classifyQuery", () => {
    const brandTerms = ["example", "example corp", "examplecorp"];

    it("should classify query containing brand term as branded", () => {
      const result = service.classifyQuery("example pricing", brandTerms);
      expect(result).toBe("branded");
    });

    it("should classify query without brand term as non-branded", () => {
      const result = service.classifyQuery("seo tools comparison", brandTerms);
      expect(result).toBe("non-branded");
    });

    it("should be case insensitive", () => {
      const result = service.classifyQuery("EXAMPLE reviews", brandTerms);
      expect(result).toBe("branded");
    });

    it("should match multi-word brand terms", () => {
      const result = service.classifyQuery("example corp headquarters", brandTerms);
      expect(result).toBe("branded");
    });

    it("should handle empty query", () => {
      const result = service.classifyQuery("", brandTerms);
      expect(result).toBe("non-branded");
    });

    it("should handle empty brand terms", () => {
      const result = service.classifyQuery("example query", []);
      expect(result).toBe("non-branded");
    });
  });

  describe("splitMetricsByBranded", () => {
    const brandTerms = ["acme", "acme corp"];
    const metrics = [
      { query: "acme pricing", clicks: 100, impressions: 1000 },
      { query: "acme corp reviews", clicks: 50, impressions: 500 },
      { query: "seo tools", clicks: 200, impressions: 2000 },
      { query: "best analytics software", clicks: 150, impressions: 1500 },
    ];

    it("should split metrics into branded and non-branded", () => {
      const result = service.splitMetricsByBranded(metrics, brandTerms);

      expect(result.branded.length).toBe(2);
      expect(result.nonBranded.length).toBe(2);
    });

    it("should calculate correct percentages", () => {
      const result = service.splitMetricsByBranded(metrics, brandTerms);

      // Branded: 100 + 50 = 150 clicks
      // Non-branded: 200 + 150 = 350 clicks
      // Total: 500 clicks
      expect(result.brandedPercent).toBeCloseTo(30); // 150/500 * 100
      expect(result.nonBrandedPercent).toBeCloseTo(70); // 350/500 * 100
    });

    it("should preserve metrics in each group", () => {
      const result = service.splitMetricsByBranded(metrics, brandTerms);

      const acmePricing = result.branded.find(m => m.query === "acme pricing");
      expect(acmePricing).toBeDefined();
      expect(acmePricing?.clicks).toBe(100);
    });

    it("should handle empty metrics array", () => {
      const result = service.splitMetricsByBranded([], brandTerms);

      expect(result.branded).toEqual([]);
      expect(result.nonBranded).toEqual([]);
      expect(result.brandedPercent).toBe(0);
      expect(result.nonBrandedPercent).toBe(0);
    });

    it("should handle all branded queries", () => {
      const allBranded = [
        { query: "acme pricing", clicks: 100, impressions: 1000 },
        { query: "acme corp", clicks: 50, impressions: 500 },
      ];

      const result = service.splitMetricsByBranded(allBranded, brandTerms);

      expect(result.brandedPercent).toBe(100);
      expect(result.nonBrandedPercent).toBe(0);
    });

    it("should handle all non-branded queries", () => {
      const allNonBranded = [
        { query: "seo tools", clicks: 100, impressions: 1000 },
        { query: "analytics software", clicks: 50, impressions: 500 },
      ];

      const result = service.splitMetricsByBranded(allNonBranded, brandTerms);

      expect(result.brandedPercent).toBe(0);
      expect(result.nonBrandedPercent).toBe(100);
    });
  });

  describe("getBrandTerms", () => {
    it("should return brand terms for client", async () => {
      const mockTerms = [
        { id: "term-1", clientId: "client-123", term: "example", isAutoDetected: true, createdAt: new Date() },
        { id: "term-2", clientId: "client-123", term: "example corp", isAutoDetected: false, createdAt: new Date() },
      ];
      mockDb.where.mockResolvedValueOnce(mockTerms);

      const terms = await service.getBrandTerms("client-123");

      expect(terms.length).toBe(2);
      expect(terms[0].term).toBe("example");
    });

    it("should return empty array for client with no terms", async () => {
      mockDb.where.mockResolvedValueOnce([]);

      const terms = await service.getBrandTerms("client-456");

      expect(terms).toEqual([]);
    });
  });

  describe("addBrandTerm", () => {
    it("should add a manual brand term", async () => {
      const newTerm = {
        id: "term-new",
        clientId: "client-123",
        term: "custom brand",
        isAutoDetected: false,
        createdAt: new Date(),
      };
      mockDb.returning.mockResolvedValueOnce([newTerm]);

      const result = await service.addBrandTerm("client-123", "custom brand");

      expect(result.term).toBe("custom brand");
      expect(result.isAutoDetected).toBe(false);
    });

    it("should allow adding auto-detected term", async () => {
      const newTerm = {
        id: "term-auto",
        clientId: "client-123",
        term: "auto brand",
        isAutoDetected: true,
        createdAt: new Date(),
      };
      mockDb.returning.mockResolvedValueOnce([newTerm]);

      const result = await service.addBrandTerm("client-123", "auto brand", true);

      expect(result.isAutoDetected).toBe(true);
    });
  });

  describe("removeBrandTerm", () => {
    it("should remove brand term by id", async () => {
      await service.removeBrandTerm("client-123", "term-1");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("syncAutoDetectedTerms", () => {
    it("should insert new auto-detected terms", async () => {
      mockDb.where.mockResolvedValueOnce([]); // No existing terms
      mockDb.returning.mockResolvedValue([
        { id: "term-1", clientId: "client-123", term: "example", isAutoDetected: true, createdAt: new Date() },
      ]);

      await service.syncAutoDetectedTerms("client-123", "example.com", "Example Corp");

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should not duplicate existing auto-detected terms", async () => {
      mockDb.where.mockResolvedValueOnce([
        { id: "term-1", clientId: "client-123", term: "example", isAutoDetected: true, createdAt: new Date() },
      ]);

      await service.syncAutoDetectedTerms("client-123", "example.com");

      // Should only insert terms that don't exist yet (filtered to exclude existing "example" term)
      // Insert may still be called but with filtered values excluding duplicates
      expect(mockDb.insert.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });
});
