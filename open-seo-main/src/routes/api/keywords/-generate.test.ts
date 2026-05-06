/**
 * Tests for POST /api/keywords/generate
 * Phase 84-01: Wire KeywordGenerator into chat flow
 *
 * TDD RED: Tests written before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the services before importing the module
vi.mock("@/server/features/keywords/conversation/ConstraintExtractor", () => ({
  createConstraintExtractor: vi.fn(() => ({
    extract: vi.fn(),
  })),
}));

vi.mock("@/server/lib/opportunity/keywordGenerator", () => ({
  generateKeywordOpportunities: vi.fn(),
}));

describe("POST /api/keywords/generate", () => {
  let mockExtractor: {
    extract: ReturnType<typeof vi.fn>;
  };
  let mockGenerateKeywords: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Get the mocked functions
    const extractorModule = await import(
      "@/server/features/keywords/conversation/ConstraintExtractor"
    );
    const generatorModule = await import(
      "@/server/lib/opportunity/keywordGenerator"
    );

    mockExtractor = {
      extract: vi.fn(),
    };
    (extractorModule.createConstraintExtractor as ReturnType<typeof vi.fn>).mockReturnValue(
      mockExtractor
    );
    mockGenerateKeywords =
      generatorModule.generateKeywordOpportunities as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("request validation", () => {
    it("rejects empty business description", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      const result = await handleGenerateKeywords({
        businessDescription: "",
        language: "en",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Business description is required");
    });

    it("rejects description exceeding 50000 chars (DoS protection)", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      const longDescription = "a".repeat(50001);
      const result = await handleGenerateKeywords({
        businessDescription: longDescription,
        language: "en",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("validates language parameter", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "service",
            coreOffering: "car wash",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "local",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: true,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.8,
          business: 0.9,
          geo: 0.7,
          audience: 0.8,
          funnel: 0.8,
          priorities: 0.7,
          negatives: 0.8,
          specialModes: 0.9,
        },
        clarificationNeeded: [],
        error: null,
      });

      mockGenerateKeywords.mockResolvedValue([]);

      const result = await handleGenerateKeywords({
        businessDescription: "Test business",
        language: "lt", // Lithuanian
      });

      expect(result.success).toBe(true);
    });
  });

  describe("constraint extraction flow", () => {
    it("extracts business info from description via ConstraintExtractor", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "ecommerce",
            coreOffering: "organic skincare",
            problemsSolved: ["dry skin", "aging"],
            productCategories: ["moisturizers", "serums"],
          },
          geo: {
            scope: "city",
            includeCities: ["Vilnius"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: true,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.85,
          business: 0.9,
          geo: 0.8,
          audience: 0.8,
          funnel: 0.8,
          priorities: 0.7,
          negatives: 0.8,
          specialModes: 0.9,
        },
        clarificationNeeded: [],
        error: null,
      });

      mockGenerateKeywords.mockResolvedValue([
        { keyword: "organic moisturizer", category: "product" },
        { keyword: "natural skincare", category: "product" },
      ]);

      const result = await handleGenerateKeywords({
        businessDescription: "We sell organic skincare products in Vilnius",
        language: "en",
      });

      expect(mockExtractor.extract).toHaveBeenCalledWith(
        "We sell organic skincare products in Vilnius"
      );
      expect(result.success).toBe(true);
    });

    it("returns clarificationNeeded when extraction confidence < 0.5", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "service",
            coreOffering: "",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: true,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.3, // Low confidence
          business: 0.2,
          geo: 0.4,
          audience: 0.3,
          funnel: 0.3,
          priorities: 0.2,
          negatives: 0.5,
          specialModes: 0.5,
        },
        clarificationNeeded: ["business.type", "geo.scope"],
        error: null,
      });

      const result = await handleGenerateKeywords({
        businessDescription: "I need SEO",
        language: "en",
      });

      expect(result.success).toBe(true);
      expect(result.clarificationNeeded).toBeDefined();
      expect(result.clarificationNeeded!.length).toBeGreaterThan(0);
    });
  });

  describe("keyword generation", () => {
    it("maps extracted constraints to KeywordGenerator input", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "ecommerce",
            coreOffering: "skincare products",
            problemsSolved: ["dry skin"],
            productCategories: ["moisturizers", "serums"],
          },
          geo: {
            scope: "city",
            includeCities: ["Vilnius"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: false,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.85,
          business: 0.9,
          geo: 0.8,
          audience: 0.8,
          funnel: 0.8,
          priorities: 0.7,
          negatives: 0.8,
          specialModes: 0.9,
        },
        clarificationNeeded: [],
        error: null,
      });

      mockGenerateKeywords.mockResolvedValue([
        { keyword: "skincare Vilnius", category: "product" },
      ]);

      await handleGenerateKeywords({
        businessDescription: "Skincare shop in Vilnius",
        language: "lt",
      });

      expect(mockGenerateKeywords).toHaveBeenCalledWith(
        expect.objectContaining({
          products: expect.arrayContaining(["moisturizers", "serums"]),
          services: [],
          brands: [],
          location: "Vilnius",
          language: "lt",
        })
      );
    });

    it("returns generated keywords grouped by category", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "service",
            coreOffering: "car wash",
            problemsSolved: [],
            productCategories: ["fleet wash", "detailing"],
          },
          geo: {
            scope: "city",
            includeCities: ["Siauliai"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: true,
          },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.9,
          business: 0.95,
          geo: 0.9,
          audience: 0.85,
          funnel: 0.9,
          priorities: 0.8,
          negatives: 0.9,
          specialModes: 0.95,
        },
        clarificationNeeded: [],
        error: null,
      });

      mockGenerateKeywords.mockResolvedValue([
        { keyword: "automobiliu plovykla", category: "service" },
        { keyword: "fleet car wash", category: "commercial" },
        { keyword: "car detailing siauliai", category: "service" },
        { keyword: "how to wash car", category: "informational" },
        { keyword: "Karcher wash", category: "brand" },
      ]);

      const result = await handleGenerateKeywords({
        businessDescription: "B2B car wash in Siauliai",
        language: "lt",
      });

      expect(result.success).toBe(true);
      expect(result.keywords).toBeDefined();
      expect(result.keywords!.product).toBeDefined();
      expect(result.keywords!.service).toHaveLength(2);
      expect(result.keywords!.commercial).toHaveLength(1);
      expect(result.keywords!.informational).toHaveLength(1);
      expect(result.keywords!.brand).toHaveLength(1);
    });

    it("includes counts summary in response", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "service",
            coreOffering: "test",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: true,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.8,
          business: 0.8,
          geo: 0.8,
          audience: 0.8,
          funnel: 0.8,
          priorities: 0.8,
          negatives: 0.8,
          specialModes: 0.8,
        },
        clarificationNeeded: [],
        error: null,
      });

      mockGenerateKeywords.mockResolvedValue([
        { keyword: "kw1", category: "product" },
        { keyword: "kw2", category: "product" },
        { keyword: "kw3", category: "service" },
        { keyword: "kw4", category: "commercial" },
        { keyword: "kw5", category: "informational" },
      ]);

      const result = await handleGenerateKeywords({
        businessDescription: "Test business",
        language: "en",
      });

      expect(result.counts).toEqual({
        total: 5,
        product: 2,
        brand: 0,
        service: 1,
        commercial: 1,
        informational: 1,
      });
    });
  });

  describe("error handling", () => {
    it("handles extraction failure gracefully", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: false,
        constraints: null,
        confidence: null,
        clarificationNeeded: [],
        error: "Claude API error",
      });

      const result = await handleGenerateKeywords({
        businessDescription: "Test business",
        language: "en",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("extraction");
    });

    it("handles keyword generation failure gracefully", async () => {
      const { handleGenerateKeywords } = await import("./generate");

      mockExtractor.extract.mockResolvedValue({
        success: true,
        constraints: {
          business: {
            type: "service",
            coreOffering: "test",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: true,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 100 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.8,
          business: 0.8,
          geo: 0.8,
          audience: 0.8,
          funnel: 0.8,
          priorities: 0.8,
          negatives: 0.8,
          specialModes: 0.8,
        },
        clarificationNeeded: [],
        error: null,
      });

      mockGenerateKeywords.mockRejectedValue(new Error("API limit exceeded"));

      const result = await handleGenerateKeywords({
        businessDescription: "Test business",
        language: "en",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("generation");
    });
  });
});
