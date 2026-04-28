/**
 * Tests for LinkSuggestionService.
 * Phase 35-04: Auto-Insert + Velocity Control
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkSuggestionService } from "./LinkSuggestionService";
import type { LinkOpportunitiesSelect } from "@/db/link-schema";
import type { AnchorSelection } from "@/server/lib/linking/types";

describe("LinkSuggestionService", () => {
  let service: LinkSuggestionService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
  let mockAnchorSelector: ReturnType<typeof vi.fn>;

  const mockOpportunity: LinkOpportunitiesSelect = {
    id: "opp-1",
    clientId: "client-1",
    auditId: "audit-1",
    pageId: "page-1",
    pageUrl: "https://example.com/target",
    opportunityType: "link_velocity",
    urgency: 0.7,
    currentDepth: null,
    targetDepth: null,
    currentInboundCount: 5,
    currentExactMatchCount: 0,
    suggestedSourcePages: null,
    suggestedAnchorText: null,
    reason: "Low inbound links",
    status: "pending",
    implementedAt: null,
    implementedByChangeId: null,
    detectedAt: new Date(),
  };

  const mockAnchorSelection: AnchorSelection = {
    anchorText: "best seo practices",
    anchorType: "exact",
    confidence: 0.95,
    existingTextMatch: "best SEO practices",
    insertionContext: null,
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    mockAnchorSelector = vi.fn().mockReturnValue(mockAnchorSelection);
    service = new LinkSuggestionService(
      mockDb as unknown as LinkSuggestionService["db"],
      mockAnchorSelector
    );
  });

  describe("generateSuggestion", () => {
    it("creates linkSuggestion from opportunity", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 5 }]),
        }),
      });

      const suggestion = await service.generateSuggestion({
        opportunity: mockOpportunity,
        sourcePageId: "source-page-1",
        sourceUrl: "https://example.com/source",
        sourceContent: "This article covers best SEO practices for beginners.",
        targetKeyword: "best seo practices",
        targetTitle: "SEO Best Practices Guide",
        brandName: "SEOCorp",
        currentDistribution: { exact: 2, branded: 1, misc: 1 },
      });

      expect(suggestion).toBeDefined();
      expect(suggestion.opportunityId).toBe("opp-1");
      expect(suggestion.sourceUrl).toBe("https://example.com/source");
      expect(suggestion.targetUrl).toBe("https://example.com/target");
      expect(suggestion.anchorText).toBe("best seo practices");
    });

    it("populates all insertion instructions", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 3 }]),
        }),
      });

      const suggestion = await service.generateSuggestion({
        opportunity: mockOpportunity,
        sourcePageId: "source-page-1",
        sourceUrl: "https://example.com/source",
        sourceContent: "Some content about best SEO practices here.",
        targetKeyword: "best seo practices",
        targetTitle: "SEO Guide",
        brandName: "SEOCorp",
        currentDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      expect(suggestion.anchorText).toBeDefined();
      expect(suggestion.anchorType).toBeDefined();
      expect(suggestion.anchorConfidence).toBeGreaterThan(0);
      expect(suggestion.insertionMethod).toBeDefined();
    });
  });

  describe("isAutoApplicable", () => {
    it("returns true when: wrap_existing, confidence >= 0.85, < 10 links on page", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 5 }]),
        }),
      });

      const result = await service.isAutoApplicable({
        insertionMethod: "wrap_existing",
        confidence: 0.90,
        sourceUrl: "https://example.com/source",
        targetUrl: "https://example.com/target",
        clientId: "client-1",
      });

      expect(result).toBe(true);
    });

    it("returns false when content insertion required", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 5 }]),
        }),
      });

      const result = await service.isAutoApplicable({
        insertionMethod: "append_sentence",
        confidence: 0.95,
        sourceUrl: "https://example.com/source",
        targetUrl: "https://example.com/target",
        clientId: "client-1",
      });

      expect(result).toBe(false);
    });

    it("returns false when confidence < 0.85", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 5 }]),
        }),
      });

      const result = await service.isAutoApplicable({
        insertionMethod: "wrap_existing",
        confidence: 0.80,
        sourceUrl: "https://example.com/source",
        targetUrl: "https://example.com/target",
        clientId: "client-1",
      });

      expect(result).toBe(false);
    });

    it("returns false when page has 10+ links", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 10 }]),
        }),
      });

      const result = await service.isAutoApplicable({
        insertionMethod: "wrap_existing",
        confidence: 0.95,
        sourceUrl: "https://example.com/source",
        targetUrl: "https://example.com/target",
        clientId: "client-1",
      });

      expect(result).toBe(false);
    });

    it.skip("returns false when target in cannibalization set (Phase 35-05)", async () => {
      // Cannibalization detection is implemented in Phase 35-05
      // This test will be unskipped when that phase is complete
      let callCount = 0;
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ count: 5 }]);
            }
            return Promise.resolve([{ id: "cannib-1" }]);
          },
        }),
      });

      const result = await service.isAutoApplicable({
        insertionMethod: "wrap_existing",
        confidence: 0.95,
        sourceUrl: "https://example.com/source",
        targetUrl: "https://example.com/target",
        clientId: "client-1",
      });

      expect(result).toBe(false);
    });
  });

  describe("insertion method detection", () => {
    it("uses wrap_existing when anchor selector finds existing text", async () => {
      mockAnchorSelector.mockReturnValue({
        ...mockAnchorSelection,
        existingTextMatch: "existing text found",
      });

      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 3 }]),
        }),
      });

      const suggestion = await service.generateSuggestion({
        opportunity: mockOpportunity,
        sourcePageId: "source-page-1",
        sourceUrl: "https://example.com/source",
        sourceContent: "Content with existing text found inside.",
        targetKeyword: "existing text",
        targetTitle: "Target Page",
        brandName: "Brand",
        currentDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      expect(suggestion.insertionMethod).toBe("wrap_existing");
      expect(suggestion.existingTextMatch).toBe("existing text found");
    });

    it("uses append_sentence when no existing text match", async () => {
      mockAnchorSelector.mockReturnValue({
        ...mockAnchorSelection,
        existingTextMatch: null,
        insertionContext: "After paragraph 2...",
      });

      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 3 }]),
        }),
      });

      const suggestion = await service.generateSuggestion({
        opportunity: mockOpportunity,
        sourcePageId: "source-page-1",
        sourceUrl: "https://example.com/source",
        sourceContent: "Content without matching keyword.",
        targetKeyword: "different keyword",
        targetTitle: "Target Page",
        brandName: "Brand",
        currentDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      expect(suggestion.insertionMethod).toBe("append_sentence");
      expect(suggestion.insertionContext).toBe("After paragraph 2...");
    });
  });
});
