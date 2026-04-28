/**
 * Tests for the Opportunity Discovery Service.
 * Phase 29: AI Opportunity Discovery
 *
 * Orchestrates AI keyword generation, volume validation, and scoring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpportunityDiscoveryService } from "./OpportunityDiscoveryService";
import type { BusinessInfo } from "@/server/lib/scraper/businessExtractor";

// Mock the keyword generator
const { mockGenerateKeywordOpportunities } = vi.hoisted(() => ({
  mockGenerateKeywordOpportunities: vi.fn(),
}));
vi.mock("./keywordGenerator", () => ({
  generateKeywordOpportunities: mockGenerateKeywordOpportunities,
}));

// Mock the volume validator
const { mockValidateKeywordVolumes, mockEnrichKeywordsWithMetrics } = vi.hoisted(() => ({
  mockValidateKeywordVolumes: vi.fn(),
  mockEnrichKeywordsWithMetrics: vi.fn(),
}));
vi.mock("./volumeValidator", () => ({
  validateKeywordVolumes: mockValidateKeywordVolumes,
  enrichKeywordsWithMetrics: mockEnrichKeywordsWithMetrics,
  calculateOpportunityScore: vi.fn((v, c, d) => Math.round(v * c * (100 - d) / 100)),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("OpportunityDiscoveryService", () => {
  const mockBusinessInfo: BusinessInfo = {
    products: ["barrel sauna", "outdoor sauna"],
    brands: ["Harvia", "Huum"],
    services: ["sauna installation", "sauna maintenance"],
    location: "Helsinki, Finland",
    targetMarket: "both",
    summary: "Premium sauna company",
    confidence: 0.85,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverOpportunities", () => {
    it("should generate and validate keywords from business info", async () => {
      const generatedKeywords = [
        { keyword: "barrel sauna price", category: "product" as const },
        { keyword: "Harvia heater", category: "brand" as const },
      ];

      const volumeData = [
        { keyword: "barrel sauna price", searchVolume: 1000, cpc: 2.0, difficulty: 40 },
        { keyword: "Harvia heater", searchVolume: 500, cpc: 1.5, difficulty: 35 },
      ];

      const enrichedKeywords = [
        {
          keyword: "barrel sauna price",
          category: "product" as const,
          searchVolume: 1000,
          cpc: 2.0,
          difficulty: 40,
          opportunityScore: 1200,
          source: "ai_generated" as const,
        },
        {
          keyword: "Harvia heater",
          category: "brand" as const,
          searchVolume: 500,
          cpc: 1.5,
          difficulty: 35,
          opportunityScore: 488,
          source: "ai_generated" as const,
        },
      ];

      mockGenerateKeywordOpportunities.mockResolvedValue(generatedKeywords);
      mockValidateKeywordVolumes.mockResolvedValue({
        volumeData,
        costUsd: 0.05,
      });
      mockEnrichKeywordsWithMetrics.mockReturnValue(enrichedKeywords);

      const result = await OpportunityDiscoveryService.discoverOpportunities({
        businessInfo: mockBusinessInfo,
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.keywords).toHaveLength(2);
      expect(result.keywords[0].keyword).toBe("barrel sauna price");
      expect(result.costUsd).toBe(0.05);
    });

    it("should pass business info to keyword generator", async () => {
      mockGenerateKeywordOpportunities.mockResolvedValue([]);
      mockValidateKeywordVolumes.mockResolvedValue({ volumeData: [], costUsd: 0 });
      mockEnrichKeywordsWithMetrics.mockReturnValue([]);

      await OpportunityDiscoveryService.discoverOpportunities({
        businessInfo: mockBusinessInfo,
        locationCode: 2840,
        languageCode: "en",
      });

      expect(mockGenerateKeywordOpportunities).toHaveBeenCalledWith({
        products: mockBusinessInfo.products,
        brands: mockBusinessInfo.brands,
        services: mockBusinessInfo.services,
        location: mockBusinessInfo.location,
        targetMarket: mockBusinessInfo.targetMarket,
        language: "en",
      });
    });

    it("should return empty array when no business info", async () => {
      const result = await OpportunityDiscoveryService.discoverOpportunities({
        businessInfo: null,
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.keywords).toEqual([]);
      expect(result.costUsd).toBe(0);
      expect(mockGenerateKeywordOpportunities).not.toHaveBeenCalled();
    });

    it("should return empty array when business info has no data", async () => {
      const emptyBusinessInfo: BusinessInfo = {
        products: [],
        brands: [],
        services: [],
        location: null,
        targetMarket: null,
        summary: "",
        confidence: 0,
      };

      const result = await OpportunityDiscoveryService.discoverOpportunities({
        businessInfo: emptyBusinessInfo,
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.keywords).toEqual([]);
    });

    it("should skip volume validation when no keywords generated", async () => {
      mockGenerateKeywordOpportunities.mockResolvedValue([]);

      await OpportunityDiscoveryService.discoverOpportunities({
        businessInfo: mockBusinessInfo,
        locationCode: 2840,
        languageCode: "en",
      });

      expect(mockValidateKeywordVolumes).not.toHaveBeenCalled();
    });

    it("should calculate summary statistics", async () => {
      const enrichedKeywords = [
        {
          keyword: "keyword1",
          category: "product" as const,
          searchVolume: 1000,
          cpc: 2.0,
          difficulty: 40,
          opportunityScore: 1200,
          source: "ai_generated" as const,
        },
        {
          keyword: "keyword2",
          category: "brand" as const,
          searchVolume: 500,
          cpc: 1.5,
          difficulty: 35,
          opportunityScore: 488,
          source: "ai_generated" as const,
        },
        {
          keyword: "keyword3",
          category: "product" as const,
          searchVolume: 800,
          cpc: 1.0,
          difficulty: 50,
          opportunityScore: 400,
          source: "ai_generated" as const,
        },
      ];

      mockGenerateKeywordOpportunities.mockResolvedValue([
        { keyword: "keyword1", category: "product" },
        { keyword: "keyword2", category: "brand" },
        { keyword: "keyword3", category: "product" },
      ]);
      mockValidateKeywordVolumes.mockResolvedValue({ volumeData: [], costUsd: 0.05 });
      mockEnrichKeywordsWithMetrics.mockReturnValue(enrichedKeywords);

      const result = await OpportunityDiscoveryService.discoverOpportunities({
        businessInfo: mockBusinessInfo,
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.summary.totalKeywords).toBe(3);
      expect(result.summary.byCategory.product).toBe(2);
      expect(result.summary.byCategory.brand).toBe(1);
      expect(result.summary.totalVolume).toBe(2300);
      expect(result.summary.avgOpportunityScore).toBeGreaterThan(0);
    });
  });

  describe("getCategorySummary", () => {
    it("should count keywords by category", () => {
      const keywords = [
        { keyword: "a", category: "product" as const, searchVolume: 100, cpc: 1, difficulty: 30, opportunityScore: 70, source: "ai_generated" as const },
        { keyword: "b", category: "product" as const, searchVolume: 200, cpc: 1, difficulty: 30, opportunityScore: 140, source: "ai_generated" as const },
        { keyword: "c", category: "brand" as const, searchVolume: 150, cpc: 1, difficulty: 30, opportunityScore: 105, source: "ai_generated" as const },
        { keyword: "d", category: "service" as const, searchVolume: 50, cpc: 1, difficulty: 30, opportunityScore: 35, source: "ai_generated" as const },
        { keyword: "e", category: "commercial" as const, searchVolume: 300, cpc: 1, difficulty: 30, opportunityScore: 210, source: "ai_generated" as const },
        { keyword: "f", category: "informational" as const, searchVolume: 400, cpc: 1, difficulty: 30, opportunityScore: 280, source: "ai_generated" as const },
      ];

      const summary = OpportunityDiscoveryService.getCategorySummary(keywords);

      expect(summary.product).toBe(2);
      expect(summary.brand).toBe(1);
      expect(summary.service).toBe(1);
      expect(summary.commercial).toBe(1);
      expect(summary.informational).toBe(1);
    });

    it("should return zeros for empty array", () => {
      const summary = OpportunityDiscoveryService.getCategorySummary([]);

      expect(summary.product).toBe(0);
      expect(summary.brand).toBe(0);
      expect(summary.service).toBe(0);
      expect(summary.commercial).toBe(0);
      expect(summary.informational).toBe(0);
    });
  });
});
