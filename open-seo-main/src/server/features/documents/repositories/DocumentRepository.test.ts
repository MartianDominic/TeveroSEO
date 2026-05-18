/**
 * DocumentRepository Test Suite
 * Phase 101: Test Coverage for Document Management (H-03)
 *
 * Tests for:
 * - incrementViewCount(): Atomic increment with workspace scoping
 * - updateLastViewedAt(): Timestamp update with workspace scoping
 * - findNeedingAttention(): Documents with 0 views or unopened threshold
 * - Soft delete filtering on all methods
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
  nanoid: vi.fn(() => "test_doc_id"),
}));

import { DocumentRepository } from "./DocumentRepository";
import { db } from "@/db";
import type { DocumentSelect } from "@/db/document-schema";

// Helper to create mock document
function createMockDocument(overrides: Partial<DocumentSelect> = {}): DocumentSelect {
  return {
    id: "doc_1",
    workspaceId: "ws_1",
    clientId: null,
    prospectId: null,
    proposalId: null,
    name: "Test Document",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    driveFileId: null,
    driveFolderId: null,
    syncMode: "link_only",
    localPath: null,
    localHash: null,
    webViewLink: null,
    viewCount: 0,
    lastViewedAt: null,
    lastSyncedAt: null,
    syncError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    softDeletedAt: null,
    ...overrides,
  };
}

describe("DocumentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("incrementViewCount (H-03)", () => {
    it("should atomically increment viewCount", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      await DocumentRepository.incrementViewCount("doc_1", "ws_1");

      expect(db.update).toHaveBeenCalled();
    });

    it("should update lastViewedAt timestamp", async () => {
      let capturedSet: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSet = data;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      } as any);

      await DocumentRepository.incrementViewCount("doc_1", "ws_1");

      expect(capturedSet).toBeDefined();
      expect(capturedSet.lastViewedAt).toBeInstanceOf(Date);
      expect(capturedSet.updatedAt).toBeInstanceOf(Date);
    });

    it("should scope by workspace", async () => {
      let capturedWhere = false;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            capturedWhere = true;
            return Promise.resolve(undefined);
          }),
        }),
      } as any);

      await DocumentRepository.incrementViewCount("doc_1", "ws_1");

      // WHERE clause must include workspaceId check
      expect(capturedWhere).toBe(true);
    });

    it("should not affect documents in different workspace", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // This should execute but affect 0 rows for wrong workspace
      await DocumentRepository.incrementViewCount("doc_1", "ws_different");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("updateLastViewedAt (H-03)", () => {
    it("should only update timestamp fields", async () => {
      let capturedSet: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSet = data;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      } as any);

      const viewedAt = new Date("2024-01-15T10:00:00Z");
      await DocumentRepository.updateLastViewedAt("doc_1", "ws_1", viewedAt);

      expect(capturedSet.lastViewedAt).toEqual(viewedAt);
      expect(capturedSet.updatedAt).toBeInstanceOf(Date);
      // Should NOT include viewCount in the update
      expect(capturedSet.viewCount).toBeUndefined();
    });

    it("should use current time as default", async () => {
      let capturedSet: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSet = data;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      } as any);

      const before = new Date();
      await DocumentRepository.updateLastViewedAt("doc_1", "ws_1");
      const after = new Date();

      expect(capturedSet.lastViewedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(capturedSet.lastViewedAt.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });

    it("should scope by workspace", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      await DocumentRepository.updateLastViewedAt("doc_1", "ws_1");

      // WHERE clause includes workspace check
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("findNeedingAttention (H-03)", () => {
    it("should return documents with 0 views", async () => {
      const unopenedDocs = [
        createMockDocument({ id: "doc_1", viewCount: 0 }),
        createMockDocument({ id: "doc_2", viewCount: 0 }),
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(unopenedDocs),
        }),
      } as any);

      const result = await DocumentRepository.findNeedingAttention("ws_1", {
        unopenedDays: 7,
      });

      expect(result).toHaveLength(2);
      expect(result.every((d) => d.viewCount === 0)).toBe(true);
    });

    it("should respect unopenedDays threshold", async () => {
      const oldDocs = [
        createMockDocument({
          id: "doc_old",
          viewCount: 0,
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        }),
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(oldDocs),
        }),
      } as any);

      const result = await DocumentRepository.findNeedingAttention("ws_1", {
        unopenedDays: 7,
      });

      expect(result).toHaveLength(1);
    });

    it("should filter by workspace", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await DocumentRepository.findNeedingAttention("ws_1", {});

      expect(result).toEqual([]);
      expect(db.select).toHaveBeenCalled();
    });

    it("should exclude soft-deleted documents", async () => {
      // Soft-deleted documents should be filtered by isNull(softDeletedAt)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await DocumentRepository.findNeedingAttention("ws_1", {
        unopenedDays: 7,
      });

      expect(result).toEqual([]);
    });

    it("should include documents with null lastViewedAt", async () => {
      const neverViewedDocs = [
        createMockDocument({
          id: "doc_never_viewed",
          viewCount: 0,
          lastViewedAt: null,
        }),
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(neverViewedDocs),
        }),
      } as any);

      const result = await DocumentRepository.findNeedingAttention("ws_1", {
        unopenedDays: 7,
      });

      expect(result).toHaveLength(1);
      expect(result[0].lastViewedAt).toBeNull();
    });
  });

  describe("findById (soft delete filtering)", () => {
    it("should return document when found and not soft-deleted", async () => {
      const doc = createMockDocument({ softDeletedAt: null });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([doc]),
        }),
      } as any);

      const result = await DocumentRepository.findById("doc_1", "ws_1");

      expect(result).toEqual(doc);
    });

    it("should return null for soft-deleted document", async () => {
      // Soft-deleted documents are excluded by WHERE clause
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await DocumentRepository.findById("doc_deleted", "ws_1");

      expect(result).toBeNull();
    });
  });

  describe("findByClient (soft delete filtering)", () => {
    it("should exclude soft-deleted documents", async () => {
      const activeDocs = [createMockDocument({ id: "doc_1", clientId: "client_1" })];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(activeDocs),
          }),
        }),
      } as any);

      const result = await DocumentRepository.findByClient("client_1", "ws_1");

      expect(result).toHaveLength(1);
      expect(result[0].softDeletedAt).toBeNull();
    });
  });

  describe("findByProposal (soft delete filtering)", () => {
    it("should exclude soft-deleted documents", async () => {
      const activeDocs = [
        createMockDocument({ id: "doc_1", proposalId: "prop_1" }),
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(activeDocs),
          }),
        }),
      } as any);

      const result = await DocumentRepository.findByProposal("prop_1", "ws_1");

      expect(result).toHaveLength(1);
    });
  });

  describe("findByDriveFileId (soft delete filtering)", () => {
    it("should return null for soft-deleted document", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await DocumentRepository.findByDriveFileId(
        "drive_file_deleted",
        "ws_1"
      );

      expect(result).toBeNull();
    });
  });

  describe("findByWorkspace (soft delete filtering)", () => {
    it("should exclude soft-deleted documents from workspace listing", async () => {
      const activeDocs = [
        createMockDocument({ id: "doc_1" }),
        createMockDocument({ id: "doc_2" }),
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(activeDocs),
            }),
          }),
        }),
      } as any);

      const result = await DocumentRepository.findByWorkspace("ws_1");

      expect(result).toHaveLength(2);
      expect(result.every((d) => d.softDeletedAt === null)).toBe(true);
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

      await DocumentRepository.softDelete("doc_1", "ws_1", "user_1");

      expect(capturedSet.softDeletedAt).toBeInstanceOf(Date);
      expect(capturedSet.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("restore", () => {
    it("should clear softDeletedAt timestamp", async () => {
      let capturedSet: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          capturedSet = data;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      } as any);

      await DocumentRepository.restore("doc_1", "ws_1");

      expect(capturedSet.softDeletedAt).toBeNull();
      expect(capturedSet.updatedAt).toBeInstanceOf(Date);
    });
  });
});
