/**
 * Tests for CannibalizationService.
 * Phase 35-05: Cannibalization Detection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CannibalizationService } from "./CannibalizationService";

describe("CannibalizationService", () => {
  let service: CannibalizationService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    service = new CannibalizationService(
      mockDb as unknown as CannibalizationService["db"]
    );
  });

  describe("detectKeywordCannibalization", () => {
    it("finds pages competing for same keyword", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () =>
            Promise.resolve([
              { keyword: "seo tips", pageUrl: "https://example.com/page1", position: 5, clicks: 100 },
              { keyword: "seo tips", pageUrl: "https://example.com/page2", position: 8, clicks: 50 },
              { keyword: "different keyword", pageUrl: "https://example.com/page3", position: 3, clicks: 200 },
            ]),
        }),
      });

      const result = await service.detectKeywordCannibalization("client-1");

      expect(result.detected).toHaveLength(1);
      expect(result.detected[0].keyword).toBe("seo tips");
      expect(result.detected[0].competingPages).toHaveLength(2);
    });

    it("does not flag keywords with single ranking page", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () =>
            Promise.resolve([
              { keyword: "unique keyword", pageUrl: "https://example.com/page1", position: 5, clicks: 100 },
            ]),
        }),
      });

      const result = await service.detectKeywordCannibalization("client-1");

      expect(result.detected).toHaveLength(0);
    });
  });

  describe("severity calculation", () => {
    it("returns severity='critical' when position gap < 5", async () => {
      const severity = service.calculateSeverity(5, 8); // gap = 3
      expect(severity).toBe("critical");
    });

    it("returns severity='high' when position gap < 10", async () => {
      const severity = service.calculateSeverity(5, 12); // gap = 7
      expect(severity).toBe("high");
    });

    it("returns severity='medium' when position gap < 20", async () => {
      const severity = service.calculateSeverity(5, 20); // gap = 15
      expect(severity).toBe("medium");
    });

    it("returns severity='low' when position gap >= 20", async () => {
      const severity = service.calculateSeverity(5, 30); // gap = 25
      expect(severity).toBe("low");
    });
  });

  describe("recommendedPrimary selection", () => {
    it("sets recommendedPrimary to page with most clicks", async () => {
      const pages = [
        { url: "https://example.com/page1", position: 5, clicks: 100 },
        { url: "https://example.com/page2", position: 3, clicks: 200 },
        { url: "https://example.com/page3", position: 8, clicks: 50 },
      ];

      const recommended = service.selectRecommendedPrimary(pages);

      expect(recommended).toBe("https://example.com/page2");
    });

    it("uses position as tiebreaker when clicks are equal", async () => {
      const pages = [
        { url: "https://example.com/page1", position: 5, clicks: 100 },
        { url: "https://example.com/page2", position: 3, clicks: 100 },
      ];

      const recommended = service.selectRecommendedPrimary(pages);

      expect(recommended).toBe("https://example.com/page2"); // Better position
    });
  });

  describe("competingPages data", () => {
    it("includes GSC position and link counts", async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: () => ({
            where: () =>
              Promise.resolve([
                { keyword: "seo tips", pageUrl: "https://example.com/page1", position: 5, clicks: 100 },
                { keyword: "seo tips", pageUrl: "https://example.com/page2", position: 8, clicks: 50 },
              ]),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () =>
              Promise.resolve([
                { pageUrl: "https://example.com/page1", inboundTotal: 25, inboundExactMatch: 3 },
                { pageUrl: "https://example.com/page2", inboundTotal: 15, inboundExactMatch: 0 },
              ]),
          }),
        });

      const result = await service.detectKeywordCannibalization("client-1");

      const page1 = result.detected[0].competingPages.find(
        (p) => p.url === "https://example.com/page1"
      );
      expect(page1?.gscPosition).toBe(5);
      expect(page1?.gscClicks).toBe(100);
      expect(page1?.inboundLinks).toBe(25);
      expect(page1?.hasExactMatchAnchor).toBe(true);

      const page2 = result.detected[0].competingPages.find(
        (p) => p.url === "https://example.com/page2"
      );
      expect(page2?.gscPosition).toBe(8);
      expect(page2?.hasExactMatchAnchor).toBe(false);
    });
  });

  describe("isTargetCannibalized", () => {
    it("returns true when target is in an active cannibalization set", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () =>
            Promise.resolve([
              {
                id: "cannib-1",
                keyword: "seo tips",
                competingPages: [
                  { url: "https://example.com/target" },
                  { url: "https://example.com/other" },
                ],
              },
            ]),
        }),
      });

      const result = await service.isTargetCannibalized(
        "https://example.com/target",
        "client-1"
      );

      expect(result).toBe(true);
    });

    it("returns false when target is not in any cannibalization set", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      });

      const result = await service.isTargetCannibalized(
        "https://example.com/safe-page",
        "client-1"
      );

      expect(result).toBe(false);
    });
  });
});
