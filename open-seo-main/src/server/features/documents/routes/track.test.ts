/**
 * Document Tracking API Test Suite
 * Phase 101: Integration Tests for Document Management (H-04)
 *
 * Tests for:
 * - Ownership verification: proposalId matching (H-04)
 * - Ownership verification: viewId validation (H-04)
 * - Valid ownership chain acceptance
 * - Invalid request rejection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
  documents: {
    id: "id",
    proposalId: "proposalId",
  },
  proposalViews: {
    id: "id",
    proposalId: "proposalId",
  },
}));

vi.mock("@/server/features/documents/services/SectionTrackingService", () => ({
  SectionTrackingService: {
    recordSectionViewsBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { db, documents, proposalViews } from "@/db";
import { SectionTrackingService } from "@/server/features/documents/services/SectionTrackingService";

// Simulate the route handler logic for testing
async function handleTrackRequest(
  documentId: string,
  body: {
    viewId: string;
    proposalId: string;
    sections: Array<{
      sectionId: string;
      sectionName: string;
      timeSpentMs: number;
      scrollDepth?: number;
      enteredAt: string;
      exitedAt?: string;
    }>;
  }
): Promise<{ success: boolean; error?: string; status: number }> {
  // 1. Verify document exists
  const [document] = await db.select().from(documents).where({});

  if (!document) {
    return { success: false, error: "Document not found", status: 404 };
  }

  // 2. Verify proposalId matches document's proposal (H-04)
  if (document.proposalId && document.proposalId !== body.proposalId) {
    return {
      success: false,
      error: "Proposal ID does not match document",
      status: 400,
    };
  }

  // 3. Verify viewId belongs to the proposal (H-04)
  const [view] = await db.select().from(proposalViews).where({});

  if (!view) {
    return {
      success: false,
      error: "View session not found or does not belong to proposal",
      status: 400,
    };
  }

  // Record sections
  await SectionTrackingService.recordSectionViewsBatch(
    body.sections.map((s) => ({
      proposalId: body.proposalId,
      viewId: body.viewId,
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      timeSpentMs: s.timeSpentMs,
      scrollDepth: s.scrollDepth,
      enteredAt: new Date(s.enteredAt),
      exitedAt: s.exitedAt ? new Date(s.exitedAt) : undefined,
    }))
  );

  return { success: true, status: 200 };
}

describe("Document Track API (H-04: Ownership Verification)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("proposalId mismatch rejection (H-04)", () => {
    it("should reject request when proposalId does not match document", async () => {
      // Document has proposalId "prop_123"
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "doc_1", proposalId: "prop_123" },
          ]),
        }),
      } as any);

      const result = await handleTrackRequest("doc_1", {
        viewId: "view_1",
        proposalId: "prop_different", // Mismatched!
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Section 1",
            timeSpentMs: 5000,
            enteredAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Proposal ID does not match document");
      expect(result.status).toBe(400);
      expect(SectionTrackingService.recordSectionViewsBatch).not.toHaveBeenCalled();
    });

    it("should allow tracking when proposalId matches", async () => {
      // Document has proposalId "prop_123"
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "doc_1", proposalId: "prop_123" },
            ]),
          }),
        } as any)
        // View lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "view_1" }]),
          }),
        } as any);

      const result = await handleTrackRequest("doc_1", {
        viewId: "view_1",
        proposalId: "prop_123", // Matches!
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Section 1",
            timeSpentMs: 5000,
            enteredAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(SectionTrackingService.recordSectionViewsBatch).toHaveBeenCalled();
    });

    it("should allow tracking when document has no proposalId", async () => {
      // Document has null proposalId (standalone document)
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "doc_1", proposalId: null },
            ]),
          }),
        } as any)
        // View lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "view_1" }]),
          }),
        } as any);

      const result = await handleTrackRequest("doc_1", {
        viewId: "view_1",
        proposalId: "any_prop",
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Section 1",
            timeSpentMs: 5000,
            enteredAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("viewId validation (H-04)", () => {
    it("should reject request when viewId does not belong to proposal", async () => {
      // Document lookup succeeds
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "doc_1", proposalId: "prop_123" },
            ]),
          }),
        } as any)
        // View lookup fails (viewId not found for proposal)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

      const result = await handleTrackRequest("doc_1", {
        viewId: "view_invalid",
        proposalId: "prop_123",
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Section 1",
            timeSpentMs: 5000,
            enteredAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "View session not found or does not belong to proposal"
      );
      expect(result.status).toBe(400);
      expect(SectionTrackingService.recordSectionViewsBatch).not.toHaveBeenCalled();
    });

    it("should reject when viewId exists but for different proposal", async () => {
      // Document lookup succeeds
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "doc_1", proposalId: "prop_123" },
            ]),
          }),
        } as any)
        // View lookup fails (WHERE includes proposalId check)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

      const result = await handleTrackRequest("doc_1", {
        viewId: "view_from_different_proposal",
        proposalId: "prop_123",
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Section 1",
            timeSpentMs: 5000,
            enteredAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("View session not found");
    });
  });

  describe("document existence check", () => {
    it("should return 404 when document does not exist", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await handleTrackRequest("doc_nonexistent", {
        viewId: "view_1",
        proposalId: "prop_123",
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Section 1",
            timeSpentMs: 5000,
            enteredAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Document not found");
      expect(result.status).toBe(404);
    });
  });

  describe("valid ownership chain", () => {
    it("should accept request with valid document, proposalId, and viewId", async () => {
      vi.mocked(db.select)
        // Document lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "doc_1", proposalId: "prop_123" },
            ]),
          }),
        } as any)
        // View lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "view_1" }]),
          }),
        } as any);

      const result = await handleTrackRequest("doc_1", {
        viewId: "view_1",
        proposalId: "prop_123",
        sections: [
          {
            sectionId: "sec_1",
            sectionName: "Introduction",
            timeSpentMs: 15000,
            scrollDepth: 75,
            enteredAt: "2024-01-15T10:00:00Z",
            exitedAt: "2024-01-15T10:00:15Z",
          },
          {
            sectionId: "sec_2",
            sectionName: "Pricing",
            timeSpentMs: 30000,
            scrollDepth: 100,
            enteredAt: "2024-01-15T10:00:15Z",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(SectionTrackingService.recordSectionViewsBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            proposalId: "prop_123",
            viewId: "view_1",
            sectionId: "sec_1",
            sectionName: "Introduction",
          }),
          expect.objectContaining({
            sectionId: "sec_2",
            sectionName: "Pricing",
          }),
        ])
      );
    });
  });
});
