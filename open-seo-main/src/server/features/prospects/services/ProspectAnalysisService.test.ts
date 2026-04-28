/**
 * Tests for ProspectAnalysisService.
 * Phase 28: Keyword Gap Analysis - Task 28-02
 *
 * Test strategy:
 * - Mock DataForSEO API client responses
 * - Test competitor discovery with filtering logic
 * - Test keyword gap analysis with deduplication
 * - Test end-to-end workflow orchestration
 * - Test error handling and edge cases
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before any imports
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  },
  createRedisConnection: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
  })),
  getSharedBullMQConnection: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
  })),
  closeRedis: vi.fn(),
}));

// Mock the database
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockWhere,
      })),
    })),
  },
}));

// Mock the DataForSEO client
const mockCompetitorsDomain = vi.fn();
const mockDomainIntersection = vi.fn();

vi.mock("@/server/lib/dataforseoClient", () => ({
  createDataforseoClient: () => ({
    prospect: {
      competitorsDomain: mockCompetitorsDomain,
      domainIntersection: mockDomainIntersection,
    },
  }),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Helper to create mock billing context
const mockBillingContext = {
  organizationId: "org-123",
  userId: "user-456",
  userEmail: "test@example.com",
  projectId: "project-789",
};

describe("ProspectAnalysisService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverCompetitors", () => {
    it("should discover and filter competitors by relevance score", async () => {
      // Mock prospect exists
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Mock analysis exists
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      // Mock competitors API response
      mockCompetitorsDomain.mockResolvedValue([
        {
          domain: "competitor1.com",
          avg_position: 5.2,
          intersections: 150, // meets threshold
          full_domain_metrics: { organic: { etv: 0.85 } },
        },
        {
          domain: "competitor2.com",
          avg_position: 8.1,
          intersections: 8, // low intersections - should be filtered out
          full_domain_metrics: { organic: { etv: 0.45 } },
        },
        {
          domain: "competitor3.com",
          avg_position: 3.7,
          intersections: 220, // high intersections - good competitor
          full_domain_metrics: { organic: { etv: 0.92 } },
        },
      ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.discoverCompetitors(
        "workspace-456",
        "prospect-123",
        mockBillingContext,
        3,
      );

      expect(result.competitors).toHaveLength(2);
      expect(result.competitors[0].domain).toBe("competitor3.com");
      expect(result.competitors[1].domain).toBe("competitor1.com");
      expect(mockCompetitorsDomain).toHaveBeenCalledWith({
        target: "example.com",
        locationCode: 2840, // US location code
        languageCode: "en",
        limit: 10,
      });
    });

    it("should throw FORBIDDEN when workspace does not own prospect", async () => {
      // Mock prospect exists but belongs to different workspace
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456", // Belongs to workspace-456
        },
      ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      await expect(
        ProspectAnalysisService.discoverCompetitors(
          "wrong-workspace", // Caller passes different workspace
          "prospect-123",
          mockBillingContext,
          3,
        ),
      ).rejects.toThrow("Access denied to this prospect");
    });

    it("should limit competitors to specified count", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      mockCompetitorsDomain.mockResolvedValue([
        { domain: "competitor1.com", avg_position: 5, intersections: 100, full_domain_metrics: { organic: { etv: 0.9 } } },
        { domain: "competitor2.com", avg_position: 6, intersections: 95, full_domain_metrics: { organic: { etv: 0.88 } } },
        { domain: "competitor3.com", avg_position: 7, intersections: 90, full_domain_metrics: { organic: { etv: 0.85 } } },
        { domain: "competitor4.com", avg_position: 8, intersections: 85, full_domain_metrics: { organic: { etv: 0.82 } } },
      ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.discoverCompetitors(
        "workspace-456",
        "prospect-123",
        mockBillingContext,
        2,
      );

      expect(result.competitors).toHaveLength(2);
    });

    it("should throw NOT_FOUND when prospect doesn't exist", async () => {
      mockLimit.mockResolvedValueOnce([]); // No prospect found

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      await expect(
        ProspectAnalysisService.discoverCompetitors(
          "workspace-456",
          "nonexistent-prospect",
          mockBillingContext,
          3,
        ),
      ).rejects.toThrow("Prospect not found");
    });

    it("should handle empty competitor results", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      mockCompetitorsDomain.mockResolvedValue([]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.discoverCompetitors(
        "workspace-456",
        "prospect-123",
        mockBillingContext,
        3,
      );

      expect(result.competitors).toHaveLength(0);
    });
  });

  describe("analyzeKeywordGaps", () => {
    it("should aggregate and deduplicate keyword gaps from multiple competitors", async () => {
      // Mock analysis exists
      mockLimit.mockResolvedValue([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
        },
      ]);

      // Mock prospect exists
      mockLimit.mockResolvedValue([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Mock domain intersection calls
      mockDomainIntersection
        .mockResolvedValueOnce([
          {
            keyword: "seo tools",
            competitorDomain: "competitor1.com",
            competitorPosition: 3,
            searchVolume: 5000,
            cpc: 2.5,
            difficulty: 45,
            trafficPotential: 6875,
          },
          {
            keyword: "keyword research",
            competitorDomain: "competitor1.com",
            competitorPosition: 5,
            searchVolume: 3000,
            cpc: 3.0,
            difficulty: 50,
            trafficPotential: 4500,
          },
        ])
        .mockResolvedValueOnce([
          {
            keyword: "seo tools", // Duplicate - should be deduped
            competitorDomain: "competitor2.com",
            competitorPosition: 2,
            searchVolume: 5000,
            cpc: 2.5,
            difficulty: 45,
            trafficPotential: 6875,
          },
          {
            keyword: "backlink checker",
            competitorDomain: "competitor2.com",
            competitorPosition: 4,
            searchVolume: 2000,
            cpc: 4.0,
            difficulty: 40,
            trafficPotential: 4800,
          },
        ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.analyzeKeywordGaps(
        "workspace-456",
        "analysis-789",
        ["competitor1.com", "competitor2.com"],
        mockBillingContext,
        2840,
        "en",
      );

      expect(result.gaps).toHaveLength(3); // Deduplicated
      expect(result.gaps[0].keyword).toBe("seo tools"); // Highest opportunity score
      expect(result.gaps[0].trafficPotential).toBe(6875);
      expect(mockDomainIntersection).toHaveBeenCalledTimes(2);
    });

    it("should throw FORBIDDEN when workspace does not own prospect via analysis", async () => {
      // Mock analysis exists
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
        },
      ]);

      // Mock prospect exists but belongs to different workspace
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456", // Belongs to workspace-456
        },
      ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      await expect(
        ProspectAnalysisService.analyzeKeywordGaps(
          "wrong-workspace", // Caller passes different workspace
          "analysis-789",
          ["competitor.com"],
          mockBillingContext,
          2840,
          "en",
        ),
      ).rejects.toThrow("Access denied to this prospect");
    });

    it("should sort gaps by opportunity score descending", async () => {
      mockLimit.mockResolvedValue([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
        },
      ]);

      mockLimit.mockResolvedValue([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockDomainIntersection.mockResolvedValue([
        {
          keyword: "low score",
          competitorDomain: "competitor.com",
          competitorPosition: 10,
          searchVolume: 100,
          cpc: 0.5,
          difficulty: 80,
          trafficPotential: 10,
        },
        {
          keyword: "high score",
          competitorDomain: "competitor.com",
          competitorPosition: 2,
          searchVolume: 10000,
          cpc: 5.0,
          difficulty: 30,
          trafficPotential: 35000,
        },
        {
          keyword: "medium score",
          competitorDomain: "competitor.com",
          competitorPosition: 5,
          searchVolume: 1000,
          cpc: 2.0,
          difficulty: 50,
          trafficPotential: 1000,
        },
      ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.analyzeKeywordGaps(
        "workspace-456",
        "analysis-789",
        ["competitor.com"],
        mockBillingContext,
        2840,
        "en",
      );

      expect(result.gaps[0].keyword).toBe("high score");
      expect(result.gaps[1].keyword).toBe("medium score");
      expect(result.gaps[2].keyword).toBe("low score");
    });

    it("should throw NOT_FOUND when analysis doesn't exist", async () => {
      mockLimit.mockResolvedValueOnce([]); // No analysis found

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      await expect(
        ProspectAnalysisService.analyzeKeywordGaps(
          "workspace-456",
          "nonexistent-analysis",
          ["competitor.com"],
          mockBillingContext,
          2840,
          "en",
        ),
      ).rejects.toThrow("Analysis not found");
    });

    it("should handle API errors gracefully", async () => {
      mockLimit.mockResolvedValue([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
        },
      ]);

      mockLimit.mockResolvedValue([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockDomainIntersection.mockRejectedValue(
        new Error("DataForSEO API error"),
      );

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      await expect(
        ProspectAnalysisService.analyzeKeywordGaps(
          "workspace-456",
          "analysis-789",
          ["competitor.com"],
          mockBillingContext,
          2840,
          "en",
        ),
      ).rejects.toThrow("All domain intersection calls failed");
    });
  });

  describe("runGapAnalysis", () => {
    it("should execute full workflow: discover competitors and analyze gaps", async () => {
      // Mock prospect lookup
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Mock analysis lookup (for competitor discovery)
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      // Mock prospect lookup in discoverCompetitors
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Mock analysis lookup in discoverCompetitors
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      // Mock competitors API
      mockCompetitorsDomain.mockResolvedValue([
        { domain: "competitor1.com", avg_position: 3, intersections: 150, full_domain_metrics: { organic: { etv: 0.9 } } },
        { domain: "competitor2.com", avg_position: 5, intersections: 120, full_domain_metrics: { organic: { etv: 0.85 } } },
        { domain: "competitor3.com", avg_position: 7, intersections: 100, full_domain_metrics: { organic: { etv: 0.80 } } },
      ]);

      // Mock analysis lookup in analyzeKeywordGaps
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
        },
      ]);

      // Mock prospect lookup in analyzeKeywordGaps
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Mock domain intersection calls
      mockDomainIntersection
        .mockResolvedValueOnce([
          {
            keyword: "keyword1",
            competitorDomain: "competitor1.com",
            competitorPosition: 3,
            searchVolume: 5000,
            cpc: 2.5,
            difficulty: 45,
            trafficPotential: 6875,
          },
        ])
        .mockResolvedValueOnce([
          {
            keyword: "keyword2",
            competitorDomain: "competitor2.com",
            competitorPosition: 4,
            searchVolume: 3000,
            cpc: 3.0,
            difficulty: 50,
            trafficPotential: 4500,
          },
        ])
        .mockResolvedValueOnce([
          {
            keyword: "keyword3",
            competitorDomain: "competitor3.com",
            competitorPosition: 5,
            searchVolume: 2000,
            cpc: 4.0,
            difficulty: 40,
            trafficPotential: 4800,
          },
        ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.runGapAnalysis(
        "workspace-456",
        "prospect-123",
        mockBillingContext,
      );

      expect(result.totalGaps).toBe(3);
      expect(result.competitorsAnalyzed).toBe(3);
      expect(result.avgOpportunityScore).toBeGreaterThan(0);
      expect(mockCompetitorsDomain).toHaveBeenCalledTimes(1);
      expect(mockDomainIntersection).toHaveBeenCalledTimes(3);
    });

    it("should throw FORBIDDEN when workspace does not own prospect", async () => {
      // Mock prospect exists but belongs to different workspace
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456", // Belongs to workspace-456
        },
      ]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      await expect(
        ProspectAnalysisService.runGapAnalysis(
          "wrong-workspace", // Caller passes different workspace
          "prospect-123",
          mockBillingContext,
        ),
      ).rejects.toThrow("Access denied to this prospect");
    });

    it("should handle no competitors found", async () => {
      // First call in runGapAnalysis - get prospect
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Second call in runGapAnalysis - get analysis
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      // Third call in discoverCompetitors - get prospect again
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      // Fourth call in discoverCompetitors - get analysis again
      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      mockCompetitorsDomain.mockResolvedValue([]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.runGapAnalysis(
        "workspace-456",
        "prospect-123",
        mockBillingContext,
      );

      expect(result.totalGaps).toBe(0);
      expect(result.competitorsAnalyzed).toBe(0);
      expect(result.avgOpportunityScore).toBe(0);
    });

    it("should limit competitors to top 3 by default", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      // Mock for discoverCompetitors
      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
          targetRegion: "US",
          targetLanguage: "en",
        },
      ]);

      // Return 5 competitors
      mockCompetitorsDomain.mockResolvedValue([
        { domain: "c1.com", avg_position: 1, intersections: 200, full_domain_metrics: { organic: { etv: 0.95 } } },
        { domain: "c2.com", avg_position: 2, intersections: 180, full_domain_metrics: { organic: { etv: 0.9 } } },
        { domain: "c3.com", avg_position: 3, intersections: 160, full_domain_metrics: { organic: { etv: 0.85 } } },
        { domain: "c4.com", avg_position: 4, intersections: 140, full_domain_metrics: { organic: { etv: 0.8 } } },
        { domain: "c5.com", avg_position: 5, intersections: 120, full_domain_metrics: { organic: { etv: 0.75 } } },
      ]);

      mockLimit.mockResolvedValueOnce([
        {
          id: "analysis-789",
          prospectId: "prospect-123",
        },
      ]);

      mockLimit.mockResolvedValueOnce([
        {
          id: "prospect-123",
          domain: "example.com",
          workspaceId: "workspace-456",
        },
      ]);

      mockDomainIntersection.mockResolvedValue([]);

      const { ProspectAnalysisService } = await import(
        "./ProspectAnalysisService"
      );

      const result = await ProspectAnalysisService.runGapAnalysis(
        "workspace-456",
        "prospect-123",
        mockBillingContext,
      );

      expect(result.competitorsAnalyzed).toBe(3); // Limited to 3
      expect(mockDomainIntersection).toHaveBeenCalledTimes(3);
    });
  });
});
