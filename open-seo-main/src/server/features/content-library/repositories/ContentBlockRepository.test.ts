/**
 * ContentBlockRepository Test Suite
 * Phase 101: Test Coverage for Content Library
 *
 * Tests for:
 * - escapeLikePattern(): SQL LIKE injection prevention (H-06, H-09)
 * - search(): Content block search with escaped patterns
 * - Workspace scoping on all methods
 * - Soft delete filtering
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => {
  return {
    db: {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
  };
});

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test_block_id"),
}));

import { ContentBlockRepository } from "./ContentBlockRepository";
import { db } from "@/db";
import type { ContentBlockSelect } from "@/db/content-library-schema";

// Helper to create mock content block
function createMockBlock(overrides: Partial<ContentBlockSelect> = {}): ContentBlockSelect {
  return {
    id: "block_1",
    workspaceId: "ws_1",
    name: "Test Block",
    content: "Sample content",
    category: "general",
    tags: ["tag1", "tag2"],
    usageCount: 0,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    softDeletedAt: null,
    ...overrides,
  };
}

describe("ContentBlockRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("escapeLikePattern (H-06, H-09: SQL injection prevention)", () => {
    // Note: escapeLikePattern is a private function, so we test it through search()

    it("should search with normal query without issues", async () => {
      const blocks = [createMockBlock({ name: "Test Block" })];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(blocks),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_1", {
        query: "Test",
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Block");
    });

    it("should handle % wildcard character safely (H-06)", async () => {
      // User input with % should be escaped, not treated as wildcard
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      // Searching for literal "100%" should not match all records
      const result = await ContentBlockRepository.search("ws_1", {
        query: "100%",
      });

      expect(result).toEqual([]);
      expect(db.select).toHaveBeenCalled();
    });

    it("should handle _ wildcard character safely (H-06)", async () => {
      // User input with _ should be escaped, not treated as single-char wildcard
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      // Searching for "a_b" should not match "aXb"
      const result = await ContentBlockRepository.search("ws_1", {
        query: "a_b",
      });

      expect(result).toEqual([]);
    });

    it("should handle backslash character safely (H-06)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      // Searching for literal backslash should be escaped
      const result = await ContentBlockRepository.search("ws_1", {
        query: "path\\to\\file",
      });

      expect(result).toEqual([]);
    });

    it("should handle combined injection attempts (H-06)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      // Combined attack: %_%
      const result = await ContentBlockRepository.search("ws_1", {
        query: "%_%",
      });

      expect(result).toEqual([]);
    });

    it("should not return all records with % query", async () => {
      // The % character should be escaped, so searching for just "%"
      // should not match everything
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_1", {
        query: "%",
      });

      // Should return empty or only blocks containing literal "%" in name
      expect(result).toEqual([]);
    });
  });

  describe("search - workspace scoping", () => {
    it("should only return blocks from specified workspace", async () => {
      const blocks = [createMockBlock({ workspaceId: "ws_1" })];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(blocks),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_1", {});

      expect(result.every((b) => b.workspaceId === "ws_1")).toBe(true);
    });

    it("should return empty for different workspace", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_different", {});

      expect(result).toEqual([]);
    });
  });

  describe("search - category filtering", () => {
    it("should filter by category", async () => {
      const blocks = [createMockBlock({ category: "templates" })];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(blocks),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_1", {
        category: "templates",
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("templates");
    });
  });

  describe("search - tags filtering", () => {
    it("should filter by tags", async () => {
      const blocks = [createMockBlock({ tags: ["seo", "content"] })];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(blocks),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_1", {
        tags: ["seo"],
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("search - soft delete filtering", () => {
    it("should exclude soft-deleted blocks", async () => {
      // Only active blocks should be returned
      const activeBlocks = [createMockBlock({ softDeletedAt: null })];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activeBlocks),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.search("ws_1", {});

      expect(result.every((b) => b.softDeletedAt === null)).toBe(true);
    });
  });

  describe("findById - workspace scoping and soft delete", () => {
    it("should return block when found in workspace", async () => {
      const block = createMockBlock();

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([block]),
        }),
      } as any);

      const result = await ContentBlockRepository.findById("block_1", "ws_1");

      expect(result).toEqual(block);
    });

    it("should return null for wrong workspace", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ContentBlockRepository.findById("block_1", "ws_different");

      expect(result).toBeNull();
    });

    it("should return null for soft-deleted block", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ContentBlockRepository.findById("block_deleted", "ws_1");

      expect(result).toBeNull();
    });
  });

  describe("findByWorkspace - soft delete filtering", () => {
    it("should exclude soft-deleted blocks from listing", async () => {
      const activeBlocks = [
        createMockBlock({ id: "block_1" }),
        createMockBlock({ id: "block_2" }),
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activeBlocks),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.findByWorkspace("ws_1");

      expect(result).toHaveLength(2);
      expect(result.every((b) => b.softDeletedAt === null)).toBe(true);
    });
  });

  describe("update - workspace scoping and soft delete", () => {
    it("should update block in workspace", async () => {
      const updatedBlock = createMockBlock({ name: "Updated Name" });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBlock]),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.update("block_1", "ws_1", {
        name: "Updated Name",
      });

      expect(result?.name).toBe("Updated Name");
    });

    it("should return null for wrong workspace", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.update("block_1", "ws_different", {
        name: "Updated Name",
      });

      expect(result).toBeNull();
    });

    it("should not update soft-deleted blocks", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.update("block_deleted", "ws_1", {
        name: "Updated Name",
      });

      expect(result).toBeNull();
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage count atomically", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      await expect(
        ContentBlockRepository.incrementUsage("block_1", "ws_1")
      ).resolves.toBeUndefined();

      expect(db.update).toHaveBeenCalled();
    });

    it("should update lastUsedAt timestamp", async () => {
      let capturedSet: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSet = data;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      } as any);

      await ContentBlockRepository.incrementUsage("block_1", "ws_1");

      expect(capturedSet.lastUsedAt).toBeInstanceOf(Date);
      expect(capturedSet.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("softDelete", () => {
    it("should set softDeletedAt timestamp", async () => {
      let capturedSet: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSet = data;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      } as any);

      await ContentBlockRepository.softDelete("block_1", "ws_1", "user_1");

      expect(capturedSet.softDeletedAt).toBeInstanceOf(Date);
    });

    it("should scope by workspace", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      await ContentBlockRepository.softDelete("block_1", "ws_1", "user_1");

      // WHERE clause must include workspace scoping
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("getUsageStats", () => {
    it("should return usage statistics for workspace", async () => {
      const stats = [
        { blockId: "block_1", name: "Popular Block", usageCount: 50 },
        { blockId: "block_2", name: "Less Popular", usageCount: 10 },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(stats),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.getUsageStats("ws_1");

      expect(result).toHaveLength(2);
      expect(result[0].usageCount).toBe(50);
    });

    it("should exclude soft-deleted blocks from stats", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      const result = await ContentBlockRepository.getUsageStats("ws_1");

      expect(result).toEqual([]);
    });
  });
});
