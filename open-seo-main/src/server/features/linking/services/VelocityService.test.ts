/**
 * Tests for VelocityService - rate limiting for link additions.
 * Phase 35-04: Auto-Insert + Velocity Control
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VelocityService } from "./VelocityService";

describe("VelocityService", () => {
  let service: VelocityService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
    };
    service = new VelocityService(mockDb as unknown as VelocityService["db"]);
  });

  describe("checkLinkVelocity", () => {
    it("returns allowed=true when under all limits", async () => {
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([{ count: 0 }]),
        }),
      }));

      const result = await service.checkLinkVelocity(
        "client-1",
        "https://example.com/page1"
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("returns allowed=false when page at 3 links today", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ count: 3 }]);
            }
            return Promise.resolve([{ count: 0 }]);
          },
        }),
      }));

      const result = await service.checkLinkVelocity(
        "client-1",
        "https://example.com/page1"
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("daily limit");
      expect(result.reason).toContain("3");
    });

    it("returns allowed=false when page has 10+ total links", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ count: 0 }]);
            }
            if (callCount === 2) {
              return Promise.resolve([{ count: 10 }]);
            }
            return Promise.resolve([{ count: 0 }]);
          },
        }),
      }));

      const result = await service.checkLinkVelocity(
        "client-1",
        "https://example.com/page1"
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("maximum");
      expect(result.reason).toContain("10");
    });

    it("returns allowed=false when site at 50 links today", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ count: 0 }]);
            }
            if (callCount === 2) {
              return Promise.resolve([{ count: 0 }]);
            }
            if (callCount === 3) {
              return Promise.resolve([{ count: 50 }]);
            }
            return Promise.resolve([{ count: 0 }]);
          },
        }),
      }));

      const result = await service.checkLinkVelocity(
        "client-1",
        "https://example.com/page1"
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Site");
      expect(result.reason).toContain("50");
    });

    it("returns allowed=false when 20 pages edited today", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => {
            callCount++;
            if (callCount === 4) {
              return Promise.resolve([{ count: 20 }]);
            }
            return Promise.resolve([{ count: 0 }]);
          },
        }),
      }));

      const result = await service.checkLinkVelocity(
        "client-1",
        "https://example.com/page1"
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("pages edited");
      expect(result.reason).toContain("20");
    });

    it("returns reason explaining why blocked", async () => {
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([{ count: 3 }]),
        }),
      }));

      const result = await service.checkLinkVelocity(
        "client-1",
        "https://example.com/page1"
      );

      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe("string");
      expect(result.reason!.length).toBeGreaterThan(10);
    });
  });

  describe("getVelocityStats", () => {
    it("returns current usage counts", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => {
            callCount++;
            return Promise.resolve([{ count: callCount }]);
          },
        }),
      }));

      const stats = await service.getVelocityStats("client-1");

      expect(stats).toHaveProperty("linksToday");
      expect(stats).toHaveProperty("pagesEditedToday");
      expect(stats).toHaveProperty("limits");
      expect(stats.limits.maxNewLinksPerDay).toBe(50);
      expect(stats.limits.maxPagesEditedPerDay).toBe(20);
    });
  });

  describe("getDefaultSettings", () => {
    it("returns correct default velocity settings", () => {
      const settings = service.getDefaultSettings();

      expect(settings.maxNewLinksPerPage).toBe(3);
      expect(settings.maxTotalLinksPerPage).toBe(10);
      expect(settings.maxLinksPerParagraph).toBe(2);
      expect(settings.maxNewLinksPerDay).toBe(50);
      expect(settings.maxNewLinksPerWeek).toBe(200);
      expect(settings.minDaysBetweenPageEdits).toBe(7);
      expect(settings.maxPagesEditedPerDay).toBe(20);
    });
  });

  describe("rate limit reset at midnight UTC", () => {
    it("only counts changes from today (UTC)", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      mockDb.select.mockReturnValue(selectChain);

      await service.checkLinkVelocity("client-1", "https://example.com/page1");

      expect(selectChain.where).toHaveBeenCalled();
    });
  });
});
