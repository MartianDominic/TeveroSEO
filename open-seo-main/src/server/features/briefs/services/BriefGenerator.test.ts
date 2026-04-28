/**
 * Tests for BriefGenerator service.
 * Phase 36: Content Brief Generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SerpAnalysisData, ContentBriefSelect } from "@/db/brief-schema";
import type { KeywordPageMappingSelect } from "@/db/mapping-schema";

// Mock dependencies
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("./SerpAnalyzer", () => ({
  analyzeSerpForKeyword: vi.fn(),
}));

// Create a mock repository factory for tests
const createMockRepo = (createFn: ReturnType<typeof vi.fn>) => ({
  create: createFn,
  findById: vi.fn(),
  findByProjectId: vi.fn(),
  findByMappingId: vi.fn(),
  updateStatus: vi.fn(),
  updateArticleId: vi.fn(),
  delete: vi.fn(),
});

describe("BriefGenerator", () => {
  const mockMapping: KeywordPageMappingSelect = {
    id: "mapping-123",
    projectId: "project-456",
    keyword: "seo tools",
    targetUrl: "https://example.com/seo-tools",
    action: "optimize",
    relevanceScore: 85,
    reason: "Best match (85% relevant)",
    searchVolume: 5000,
    difficulty: 45,
    currentPosition: 12,
    currentUrl: "https://example.com/seo-tools",
    isManualOverride: false,
    createdAt: new Date("2026-04-23T12:00:00Z"),
    updatedAt: new Date("2026-04-23T12:00:00Z"),
  };

  const mockSerpAnalysis: SerpAnalysisData = {
    commonH2s: [
      { heading: "What Are SEO Tools?", frequency: 5 },
      { heading: "Best SEO Tools for Agencies", frequency: 4 },
    ],
    paaQuestions: [
      "What are the best SEO tools?",
      "How do SEO tools work?",
    ],
    competitorWordCounts: [1500, 1800, 2000],
    metaLengths: { title: 60, description: 155 },
    analyzedAt: "2026-04-23T12:00:00Z",
    location: "United States",
  };

  const mockBrief: ContentBriefSelect = {
    id: "brief-abc",
    mappingId: "mapping-123",
    keyword: "seo tools",
    targetWordCount: 2120, // 1766 avg * 1.2
    voiceMode: "preservation",
    status: "draft",
    serpAnalysis: mockSerpAnalysis,
    articleId: null,
    createdAt: new Date("2026-04-23T12:00:00Z"),
    updatedAt: new Date("2026-04-23T12:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateMapping", () => {
    it("should return mapping when found", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { validateMapping } = await import("./BriefGenerator");
      const result = await validateMapping("mapping-123");

      expect(result).toEqual(mockMapping);
    });

    it("should throw NOT_FOUND when mapping not found", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { validateMapping } = await import("./BriefGenerator");

      await expect(validateMapping("nonexistent")).rejects.toThrow(
        "Keyword mapping nonexistent not found"
      );
    });
  });

  describe("previewSerp", () => {
    it("should return SERP analysis without creating brief", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(mockSerpAnalysis);

      const { previewSerp } = await import("./BriefGenerator");
      const result = await previewSerp("client-abc", "mapping-123");

      expect(result).toEqual(mockSerpAnalysis);
      expect(analyzeSerpForKeyword).toHaveBeenCalledWith(
        "client-abc",
        "mapping-123",
        "seo tools",
        2840
      );
    });

    it("should accept custom location code", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(mockSerpAnalysis);

      const { previewSerp } = await import("./BriefGenerator");
      await previewSerp("client-abc", "mapping-123", 2826); // UK

      expect(analyzeSerpForKeyword).toHaveBeenCalledWith(
        "client-abc",
        "mapping-123",
        "seo tools",
        2826
      );
    });
  });

  describe("generateBrief", () => {
    it("should throw if mapping not found", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { generateBrief } = await import("./BriefGenerator");
      const mockCreate = vi.fn();
      const mockRepo = createMockRepo(mockCreate);

      await expect(
        generateBrief(
          { mappingId: "nonexistent", voiceMode: "preservation", clientId: "client-abc" },
          mockRepo as never
        )
      ).rejects.toThrow("not found");
    });

    it("should call analyzeSerpForKeyword with correct params including clientId", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(mockSerpAnalysis);

      const mockCreate = vi.fn().mockResolvedValue(mockBrief);
      const mockRepo = createMockRepo(mockCreate);

      const { generateBrief } = await import("./BriefGenerator");
      await generateBrief(
        { mappingId: "mapping-123", voiceMode: "preservation", locationCode: 2826, clientId: "client-abc" },
        mockRepo as never
      );

      expect(analyzeSerpForKeyword).toHaveBeenCalledWith(
        "client-abc",
        "mapping-123",
        "seo tools",
        2826
      );
    });

    it("should calculate target word count as avg + 20%", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(mockSerpAnalysis);

      const mockCreate = vi.fn().mockResolvedValue(mockBrief);
      const mockRepo = createMockRepo(mockCreate);

      const { generateBrief } = await import("./BriefGenerator");
      const result = await generateBrief(
        { mappingId: "mapping-123", voiceMode: "preservation", clientId: "client-abc" },
        mockRepo as never
      );

      // avg = (1500 + 1800 + 2000) / 3 = 1766.67 → 1767
      // target = 1767 * 1.2 = 2120
      expect(result.competitorAvgWordCount).toBe(1767);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          targetWordCount: 2120,
        })
      );
    });

    it("should use default 1500 word count when no competitor data", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const emptyWordCountAnalysis = {
        ...mockSerpAnalysis,
        competitorWordCounts: [],
      };
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(emptyWordCountAnalysis);

      const mockCreate = vi.fn().mockResolvedValue({
        ...mockBrief,
        targetWordCount: 1800, // 1500 * 1.2
      });
      const mockRepo = createMockRepo(mockCreate);

      const { generateBrief } = await import("./BriefGenerator");
      const result = await generateBrief(
        { mappingId: "mapping-123", voiceMode: "preservation", clientId: "client-abc" },
        mockRepo as never
      );

      expect(result.competitorAvgWordCount).toBe(1500);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          targetWordCount: 1800, // 1500 * 1.2
        })
      );
    });

    it("should return brief with draft status", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(mockSerpAnalysis);

      const mockCreate = vi.fn().mockResolvedValue(mockBrief);
      const mockRepo = createMockRepo(mockCreate);

      const { generateBrief } = await import("./BriefGenerator");
      const result = await generateBrief(
        { mappingId: "mapping-123", voiceMode: "preservation", clientId: "client-abc" },
        mockRepo as never
      );

      expect(result.brief.status).toBe("draft");
    });

    it("should extract suggested H2s from SERP analysis", async () => {
      const { db } = await import("@/db");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const mockWhere = vi.fn().mockResolvedValue([mockMapping]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
      vi.mocked(analyzeSerpForKeyword).mockResolvedValue(mockSerpAnalysis);

      const mockCreate = vi.fn().mockResolvedValue(mockBrief);
      const mockRepo = createMockRepo(mockCreate);

      const { generateBrief } = await import("./BriefGenerator");
      const result = await generateBrief(
        { mappingId: "mapping-123", voiceMode: "preservation", clientId: "client-abc" },
        mockRepo as never
      );

      expect(result.suggestedH2s).toEqual([
        "What Are SEO Tools?",
        "Best SEO Tools for Agencies",
      ]);
      expect(result.paaQuestions).toEqual([
        "What are the best SEO tools?",
        "How do SEO tools work?",
      ]);
    });
  });
});
