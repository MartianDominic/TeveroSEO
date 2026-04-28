/**
 * Tests for BriefRepository CRUD operations.
 * Phase 36: Content Brief Generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentBriefSelect, SerpAnalysisData } from "@/db/brief-schema";

// Mock db
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-brief-id"),
}));

describe("BriefRepository", () => {
  const mockSerpAnalysis: SerpAnalysisData = {
    commonH2s: [{ heading: "Test H2", frequency: 5 }],
    paaQuestions: ["What is test?"],
    competitorWordCounts: [1500, 1800],
    metaLengths: { title: 60, description: 155 },
    analyzedAt: "2026-04-23T12:00:00Z",
    location: "United States",
  };

  const mockBrief: ContentBriefSelect = {
    id: "test-brief-id",
    mappingId: "mapping-123",
    keyword: "seo tools",
    targetWordCount: 1800,
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

  describe("create", () => {
    it("should insert brief and return with generated ID", async () => {
      const { db } = await import("@/db");
      const mockReturning = vi.fn().mockResolvedValue([mockBrief]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.create({
        mappingId: "mapping-123",
        keyword: "seo tools",
        targetWordCount: 1800,
        voiceMode: "preservation",
        serpAnalysis: mockSerpAnalysis,
      });

      expect(result).toEqual(mockBrief);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("should return brief when found", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([mockBrief]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.findById("test-brief-id");

      expect(result).toEqual(mockBrief);
    });

    it("should return null when not found", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByProjectId", () => {
    it("should return briefs filtered by project", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([mockBrief]);
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.findByProjectId("project-123");

      expect(result).toEqual([mockBrief]);
    });
  });

  describe("findByMappingId", () => {
    it("should return brief for specific keyword mapping", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue([mockBrief]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.findByMappingId("mapping-123");

      expect(result).toEqual(mockBrief);
    });
  });

  describe("updateStatus", () => {
    it("should change status and update timestamp", async () => {
      const updatedBrief = { ...mockBrief, status: "ready" as const };
      const { db } = await import("@/db");
      const mockReturning = vi.fn().mockResolvedValue([updatedBrief]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.updateStatus("test-brief-id", "ready");

      expect(result?.status).toBe("ready");
    });
  });

  describe("updateArticleId", () => {
    it("should update article reference", async () => {
      const updatedBrief = { ...mockBrief, articleId: "article-456" };
      const { db } = await import("@/db");
      const mockReturning = vi.fn().mockResolvedValue([updatedBrief]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.updateArticleId("test-brief-id", "article-456");

      expect(result?.articleId).toBe("article-456");
    });
  });

  describe("delete", () => {
    it("should remove brief and return true", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
      vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.delete("test-brief-id");

      expect(result).toBe(true);
    });

    it("should return false when brief not found", async () => {
      const { db } = await import("@/db");
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
      vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as never);

      const { BriefRepository } = await import("./BriefRepository");
      const repo = new BriefRepository();

      const result = await repo.delete("nonexistent");

      expect(result).toBe(false);
    });
  });
});
