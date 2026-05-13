/**
 * ContentLibraryService unit tests
 * Phase 101-04: Content Library
 *
 * TDD: Write tests first (RED), then implement (GREEN)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/ContentBlockRepository", () => ({
  ContentBlockRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByWorkspace: vi.fn(),
    search: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    recordUsage: vi.fn(),
    incrementUsage: vi.fn(),
    getUsageStats: vi.fn(),
  },
}));

import { ContentLibraryService } from "./ContentLibraryService";
import { ContentBlockRepository } from "../repositories/ContentBlockRepository";

describe("ContentLibraryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a content block with category and tags", async () => {
      const mockBlock = {
        id: "block_1",
        workspaceId: "ws_1",
        name: "Client Testimonial - ACME",
        category: "testimonial",
        content: "Great results!",
        tags: ["premium", "tech"],
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user_1",
      };
      vi.mocked(ContentBlockRepository.create).mockResolvedValue(mockBlock as never);

      const result = await ContentLibraryService.create(
        {
          name: "Client Testimonial - ACME",
          category: "testimonial",
          content: "Great results!",
          tags: ["premium", "tech"],
        },
        "ws_1",
        "user_1"
      );

      expect(ContentBlockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws_1",
          name: "Client Testimonial - ACME",
          category: "testimonial",
          content: "Great results!",
          tags: ["premium", "tech"],
          createdBy: "user_1",
        })
      );
      expect(result.id).toBe("block_1");
    });

    it("should default tags to empty array if not provided", async () => {
      const mockBlock = {
        id: "block_2",
        workspaceId: "ws_1",
        name: "Legal Clause",
        category: "legal_clause",
        content: "Terms and conditions...",
        tags: [],
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user_1",
      };
      vi.mocked(ContentBlockRepository.create).mockResolvedValue(mockBlock as never);

      await ContentLibraryService.create(
        {
          name: "Legal Clause",
          category: "legal_clause",
          content: "Terms and conditions...",
        },
        "ws_1",
        "user_1"
      );

      expect(ContentBlockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [],
        })
      );
    });
  });

  describe("search", () => {
    it("should search blocks by category", async () => {
      const mockBlocks = [
        { id: "block_1", name: "Case Study 1", category: "case_study" },
        { id: "block_2", name: "Case Study 2", category: "case_study" },
      ];
      vi.mocked(ContentBlockRepository.search).mockResolvedValue(mockBlocks as never);

      const result = await ContentLibraryService.search("ws_1", { category: "case_study" });

      expect(ContentBlockRepository.search).toHaveBeenCalledWith("ws_1", { category: "case_study" });
      expect(result).toHaveLength(2);
    });

    it("should search blocks by query and tags", async () => {
      vi.mocked(ContentBlockRepository.search).mockResolvedValue([]);

      await ContentLibraryService.search("ws_1", { query: "premium", tags: ["tech", "saas"] });

      expect(ContentBlockRepository.search).toHaveBeenCalledWith("ws_1", {
        query: "premium",
        tags: ["tech", "saas"],
      });
    });

    it("should pass limit option to repository", async () => {
      vi.mocked(ContentBlockRepository.search).mockResolvedValue([]);

      await ContentLibraryService.search("ws_1", { limit: 25 });

      expect(ContentBlockRepository.search).toHaveBeenCalledWith("ws_1", { limit: 25 });
    });
  });

  describe("getById", () => {
    it("should return block when found", async () => {
      const mockBlock = { id: "block_1", name: "Test Block" };
      vi.mocked(ContentBlockRepository.findById).mockResolvedValue(mockBlock as never);

      const result = await ContentLibraryService.getById("block_1", "ws_1");

      expect(result).toEqual(mockBlock);
      expect(ContentBlockRepository.findById).toHaveBeenCalledWith("block_1", "ws_1");
    });

    it("should return null when block not found", async () => {
      vi.mocked(ContentBlockRepository.findById).mockResolvedValue(null);

      const result = await ContentLibraryService.getById("nonexistent", "ws_1");

      expect(result).toBeNull();
    });
  });

  describe("recordUsage", () => {
    it("should record usage and increment counter for existing block", async () => {
      vi.mocked(ContentBlockRepository.findById).mockResolvedValue({ id: "block_1" } as never);

      await ContentLibraryService.recordUsage("block_1", "ws_1", "proposal", "prop_123", "user_1");

      expect(ContentBlockRepository.recordUsage).toHaveBeenCalledWith("block_1", "proposal", "prop_123", "user_1");
      expect(ContentBlockRepository.incrementUsage).toHaveBeenCalledWith("block_1", "ws_1");
    });

    it("should not record usage for non-existent block", async () => {
      vi.mocked(ContentBlockRepository.findById).mockResolvedValue(null);

      await ContentLibraryService.recordUsage("missing_block", "ws_1", "proposal", "prop_123");

      expect(ContentBlockRepository.recordUsage).not.toHaveBeenCalled();
      expect(ContentBlockRepository.incrementUsage).not.toHaveBeenCalled();
    });

    it("should handle contract entity type", async () => {
      vi.mocked(ContentBlockRepository.findById).mockResolvedValue({ id: "block_1" } as never);

      await ContentLibraryService.recordUsage("block_1", "ws_1", "contract", "contract_456");

      expect(ContentBlockRepository.recordUsage).toHaveBeenCalledWith("block_1", "contract", "contract_456", undefined);
    });
  });

  describe("getPopularBlocks", () => {
    it("should return most used blocks with default limit", async () => {
      const mockStats = [
        { blockId: "block_1", name: "Top Case Study", usageCount: 42 },
        { blockId: "block_2", name: "Legal Clause", usageCount: 28 },
      ];
      vi.mocked(ContentBlockRepository.getUsageStats).mockResolvedValue(mockStats);

      const result = await ContentLibraryService.getPopularBlocks("ws_1");

      expect(ContentBlockRepository.getUsageStats).toHaveBeenCalledWith("ws_1", 10);
      expect(result[0].usageCount).toBe(42);
    });

    it("should respect custom limit", async () => {
      vi.mocked(ContentBlockRepository.getUsageStats).mockResolvedValue([]);

      await ContentLibraryService.getPopularBlocks("ws_1", 5);

      expect(ContentBlockRepository.getUsageStats).toHaveBeenCalledWith("ws_1", 5);
    });
  });

  describe("update", () => {
    it("should update block and return updated data", async () => {
      const mockUpdated = { id: "block_1", name: "Updated Name" };
      vi.mocked(ContentBlockRepository.update).mockResolvedValue(mockUpdated as never);

      const result = await ContentLibraryService.update("block_1", "ws_1", { name: "Updated Name" });

      expect(ContentBlockRepository.update).toHaveBeenCalledWith("block_1", "ws_1", { name: "Updated Name" });
      expect(result).toEqual(mockUpdated);
    });

    it("should return null when block not found", async () => {
      vi.mocked(ContentBlockRepository.update).mockResolvedValue(null);

      const result = await ContentLibraryService.update("nonexistent", "ws_1", { name: "Test" });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should soft delete block", async () => {
      await ContentLibraryService.delete("block_1", "ws_1", "user_1");

      expect(ContentBlockRepository.softDelete).toHaveBeenCalledWith("block_1", "ws_1", "user_1");
    });
  });

  describe("getCategories", () => {
    it("should return all available categories", () => {
      const categories = ContentLibraryService.getCategories();

      expect(categories).toContain("case_study");
      expect(categories).toContain("testimonial");
      expect(categories).toContain("pricing_table");
      expect(categories).toContain("legal_clause");
      expect(categories).toContain("team_bio");
      expect(categories).toContain("methodology");
      expect(categories).toContain("faq");
      expect(categories).toContain("custom");
      expect(categories).toHaveLength(8);
    });
  });
});
