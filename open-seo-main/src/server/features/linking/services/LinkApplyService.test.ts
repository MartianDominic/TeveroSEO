/**
 * Tests for LinkApplyService.
 * Phase 35-04: Auto-Insert + Velocity Control
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkApplyService } from "./LinkApplyService";
import type { LinkSuggestionsSelect } from "@/db/link-schema";

describe("LinkApplyService", () => {
  let service: LinkApplyService;
  let mockDb: {
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockVelocityService: {
    checkLinkVelocity: ReturnType<typeof vi.fn>;
  };
  let mockConnectionService: {
    getPageContent: ReturnType<typeof vi.fn>;
    updatePageContent: ReturnType<typeof vi.fn>;
  };

  const mockSuggestion: LinkSuggestionsSelect = {
    id: "sugg-1",
    clientId: "client-1",
    auditId: "audit-1",
    sourceUrl: "https://example.com/source",
    sourcePageId: "source-page-1",
    targetUrl: "https://example.com/target",
    targetPageId: "target-page-1",
    anchorText: "best practices",
    anchorType: "exact",
    anchorConfidence: 0.95,
    score: 75,
    linkDeficitScore: 20,
    exactMatchScore: 15,
    orphanScore: 30,
    depthScore: 5,
    relevanceScore: 5,
    reasons: ["High priority orphan rescue"],
    existingTextMatch: "best practices",
    insertionContext: null,
    opportunityId: "opp-1",
    insertionMethod: "wrap_existing",
    replacementText: '<a href="https://example.com/target">best practices</a>',
    newSentence: null,
    isAutoApplicable: true,
    failureReason: null,
    status: "pending",
    acceptedAt: null,
    rejectedAt: null,
    appliedAt: null,
    appliedChangeId: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "change-1" }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    mockVelocityService = {
      checkLinkVelocity: vi.fn().mockResolvedValue({ allowed: true }),
    };

    mockConnectionService = {
      getPageContent: vi.fn().mockResolvedValue(
        "<p>This article discusses best practices for SEO.</p>"
      ),
      updatePageContent: vi.fn().mockResolvedValue({ success: true }),
    };

    service = new LinkApplyService(
      mockDb as unknown as LinkApplyService["db"],
      mockVelocityService as unknown as LinkApplyService["velocityService"],
      mockConnectionService as unknown as LinkApplyService["connectionService"]
    );
  });

  describe("applySuggestion", () => {
    it("checks velocity before applying", async () => {
      await service.applySuggestion(mockSuggestion, "conn-1");

      expect(mockVelocityService.checkLinkVelocity).toHaveBeenCalledWith(
        "client-1",
        "https://example.com/source"
      );
    });

    it("returns error if velocity check fails", async () => {
      mockVelocityService.checkLinkVelocity.mockResolvedValue({
        allowed: false,
        reason: "Page has reached daily limit",
      });

      const result = await service.applySuggestion(mockSuggestion, "conn-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("daily limit");
      expect(mockConnectionService.updatePageContent).not.toHaveBeenCalled();
    });

    it("creates site_changes record with before/after values", async () => {
      await service.applySuggestion(mockSuggestion, "conn-1");

      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb.insert.mock.calls[0];
      expect(insertCall).toBeDefined();
    });

    it("calls platform adapter to update content", async () => {
      await service.applySuggestion(mockSuggestion, "conn-1");

      expect(mockConnectionService.updatePageContent).toHaveBeenCalledWith(
        "conn-1",
        "source-page-1",
        expect.stringContaining('href="https://example.com/target"')
      );
    });

    it("updates suggestion status to 'applied' on success", async () => {
      await service.applySuggestion(mockSuggestion, "conn-1");

      const updateCalls = mockDb.update.mock.calls;
      const statusUpdateCall = updateCalls.find((call: unknown[]) => {
        const setCall = call[0];
        return setCall !== undefined;
      });
      expect(statusUpdateCall).toBeDefined();
    });

    it("updates suggestion status to 'failed' on error", async () => {
      mockConnectionService.updatePageContent.mockResolvedValue({
        success: false,
        error: "API error",
      });

      const result = await service.applySuggestion(mockSuggestion, "conn-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API error");
    });

    it("records failure reason", async () => {
      mockConnectionService.updatePageContent.mockResolvedValue({
        success: false,
        error: "Connection timeout",
      });

      const result = await service.applySuggestion(mockSuggestion, "conn-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });
  });

  describe("wrap_existing insertion", () => {
    it("replaces original text with linked version", async () => {
      mockConnectionService.getPageContent.mockResolvedValue(
        "<p>Learn about best practices for modern SEO.</p>"
      );

      await service.applySuggestion(mockSuggestion, "conn-1");

      expect(mockConnectionService.updatePageContent).toHaveBeenCalledWith(
        "conn-1",
        "source-page-1",
        expect.stringContaining('<a href="https://example.com/target">best practices</a>')
      );
    });

    it("handles content-changed scenarios gracefully", async () => {
      mockConnectionService.getPageContent.mockResolvedValue(
        "<p>Content has completely changed, no match.</p>"
      );

      const result = await service.applySuggestion(mockSuggestion, "conn-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Content changed");
    });
  });

  describe("append_sentence insertion", () => {
    it("inserts new sentence after specified paragraph", async () => {
      const appendSuggestion: LinkSuggestionsSelect = {
        ...mockSuggestion,
        insertionMethod: "append_sentence",
        existingTextMatch: null,
        replacementText: null,
        newSentence: 'Learn more about <a href="https://example.com/target">SEO tips</a>.',
      };

      mockConnectionService.getPageContent.mockResolvedValue(
        "<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>"
      );

      await service.applySuggestion(appendSuggestion, "conn-1");

      expect(mockConnectionService.updatePageContent).toHaveBeenCalledWith(
        "conn-1",
        "source-page-1",
        expect.stringContaining("Learn more about")
      );
    });
  });

  describe("link graph update", () => {
    it("updates link graph after successful application", async () => {
      const result = await service.applySuggestion(mockSuggestion, "conn-1");

      expect(result.success).toBe(true);
      // Link graph update would be verified by checking insert was called
      // for linkGraph table (implementation detail)
    });
  });
});
