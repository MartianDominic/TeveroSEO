/**
 * Tests for PixelAnalyticsService
 * Phase 66-08: Pixel Analytics Dashboard
 *
 * TDD: RED phase - write failing tests first
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Use vi.hoisted to ensure mocks are hoisted to top
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/db/pixel-schema", () => ({
  pixelInstallations: { id: "id", siteId: "siteId", workspaceId: "workspaceId" },
  pixelAnalyticsDaily: {
    id: "id",
    installationId: "installationId",
    date: "date",
    pageviews: "pageviews",
    sessions: "sessions",
    uniqueVisitors: "uniqueVisitors",
    avgTimeOnPage: "avgTimeOnPage",
    bounceRate: "bounceRate",
    lcpP75: "lcpP75",
    clsP75: "clsP75",
    inpP75: "inpP75",
    topPages: "topPages",
  },
}));

import {
  PixelAnalyticsService,
  type AnalyticsQuery,
  type AnalyticsResponse,
  type CwvRating,
  type TopPage,
} from "./pixel-analytics.service";

describe("PixelAnalyticsService", () => {
  let service: PixelAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PixelAnalyticsService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAnalytics", () => {
    const mockQuery: AnalyticsQuery = {
      siteId: "site_abc123",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    };

    it("should return summary for date range", async () => {
      // Mock database chain - innerJoin -> where -> orderBy
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "2400.00",
                  clsP75: "0.0800",
                  inpP75: "180.00",
                  topPages: [],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      expect(result.summary).toBeDefined();
      expect(result.summary).toHaveProperty("totalPageviews");
      expect(result.summary).toHaveProperty("totalSessions");
      expect(result.summary).toHaveProperty("totalUniqueVisitors");
      expect(result.summary).toHaveProperty("avgTimeOnPage");
      expect(result.summary).toHaveProperty("bounceRate");
    });

    it("should aggregate daily data correctly", async () => {
      // Mock database chain - innerJoin -> where -> orderBy
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "2400.00",
                  clsP75: "0.0800",
                  inpP75: "180.00",
                  topPages: [{ url: "/page1", pageviews: 30, uniqueVisitors: 20 }],
                },
                {
                  id: "a2",
                  installationId: "inst_123",
                  date: new Date("2026-04-02"),
                  pageviews: 150,
                  sessions: 75,
                  uniqueVisitors: 60,
                  avgTimeOnPage: "100.00",
                  bounceRate: "40.00",
                  lcpP75: "2200.00",
                  clsP75: "0.0600",
                  inpP75: "150.00",
                  topPages: [{ url: "/page2", pageviews: 50, uniqueVisitors: 35 }],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      // Should sum pageviews, sessions, uniqueVisitors
      expect(result.summary.totalPageviews).toBe(250);
      expect(result.summary.totalSessions).toBe(125);
      expect(result.summary.totalUniqueVisitors).toBe(100);
      // Should average timeOnPage and bounceRate
      expect(result.summary.avgTimeOnPage).toBeCloseTo(110, 0);
      expect(result.summary.bounceRate).toBeCloseTo(42.75, 1);
    });

    it("should return CWV ratings using Google thresholds", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "2400.00", // good (< 2500ms)
                  clsP75: "0.0800", // good (< 0.1)
                  inpP75: "180.00", // good (< 200ms)
                  topPages: [],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      expect(result.cwv.lcp.rating).toBe("good");
      expect(result.cwv.cls.rating).toBe("good");
      expect(result.cwv.inp.rating).toBe("good");
    });

    it("should rate LCP as needs-improvement when between 2500-4000ms", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "3200.00", // needs-improvement (>= 2500, < 4000)
                  clsP75: "0.1500", // needs-improvement (>= 0.1, < 0.25)
                  inpP75: "350.00", // needs-improvement (>= 200, < 500)
                  topPages: [],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      expect(result.cwv.lcp.rating).toBe("needs-improvement");
      expect(result.cwv.cls.rating).toBe("needs-improvement");
      expect(result.cwv.inp.rating).toBe("needs-improvement");
    });

    it("should rate CWV as poor when exceeding thresholds", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "4500.00", // poor (>= 4000)
                  clsP75: "0.3000", // poor (>= 0.25)
                  inpP75: "550.00", // poor (>= 500)
                  topPages: [],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      expect(result.cwv.lcp.rating).toBe("poor");
      expect(result.cwv.cls.rating).toBe("poor");
      expect(result.cwv.inp.rating).toBe("poor");
    });

    it("should return timeseries with data points for each day", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "2400.00",
                  clsP75: "0.0800",
                  inpP75: "180.00",
                  topPages: [],
                },
                {
                  id: "a2",
                  installationId: "inst_123",
                  date: new Date("2026-04-02"),
                  pageviews: 150,
                  sessions: 75,
                  uniqueVisitors: 60,
                  avgTimeOnPage: "100.00",
                  bounceRate: "40.00",
                  lcpP75: "2200.00",
                  clsP75: "0.0600",
                  inpP75: "150.00",
                  topPages: [],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      expect(result.timeseries).toHaveLength(2);
      expect(result.timeseries[0]).toEqual({
        date: "2026-04-01",
        pageviews: 100,
        sessions: 50,
        uniqueVisitors: 40,
      });
      expect(result.timeseries[1]).toEqual({
        date: "2026-04-02",
        pageviews: 150,
        sessions: 75,
        uniqueVisitors: 60,
      });
    });

    it("should return top 10 pages by views", async () => {
      const topPagesDay1 = [
        { url: "/page1", pageviews: 30, uniqueVisitors: 20 },
        { url: "/page2", pageviews: 25, uniqueVisitors: 18 },
      ];
      const topPagesDay2 = [
        { url: "/page1", pageviews: 40, uniqueVisitors: 28 },
        { url: "/page3", pageviews: 35, uniqueVisitors: 25 },
      ];

      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  pageviews: 100,
                  sessions: 50,
                  uniqueVisitors: 40,
                  avgTimeOnPage: "120.00",
                  bounceRate: "45.50",
                  lcpP75: "2400.00",
                  clsP75: "0.0800",
                  inpP75: "180.00",
                  topPages: topPagesDay1,
                },
                {
                  id: "a2",
                  installationId: "inst_123",
                  date: new Date("2026-04-02"),
                  pageviews: 150,
                  sessions: 75,
                  uniqueVisitors: 60,
                  avgTimeOnPage: "100.00",
                  bounceRate: "40.00",
                  lcpP75: "2200.00",
                  clsP75: "0.0600",
                  inpP75: "150.00",
                  topPages: topPagesDay2,
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      // Should merge topPages arrays, sum views per URL
      expect(result.topPages).toHaveLength(3);
      // /page1 should have 70 views (30 + 40)
      const page1 = result.topPages.find((p) => p.url === "/page1");
      expect(page1?.views).toBe(70);
      // /page3 should have 35 views
      const page3 = result.topPages.find((p) => p.url === "/page3");
      expect(page3?.views).toBe(35);
      // /page2 should have 25 views
      const page2 = result.topPages.find((p) => p.url === "/page2");
      expect(page2?.views).toBe(25);
      // Results should be sorted by views descending
      expect(result.topPages[0].url).toBe("/page1");
    });

    it("should return zeros for empty date range", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(mockQuery);

      expect(result.summary.totalPageviews).toBe(0);
      expect(result.summary.totalSessions).toBe(0);
      expect(result.summary.totalUniqueVisitors).toBe(0);
      expect(result.summary.avgTimeOnPage).toBe(0);
      expect(result.summary.bounceRate).toBe(0);
      expect(result.cwv.lcp.p75).toBe(0);
      expect(result.cwv.cls.p75).toBe(0);
      expect(result.cwv.inp.p75).toBe(0);
      expect(result.timeseries).toHaveLength(0);
      expect(result.topPages).toHaveLength(0);
    });

    it("should handle weekly granularity aggregation", async () => {
      // Use dates that fall on clean week boundaries
      // 2026-04-06 is a Monday, 2026-04-19 is a Sunday (2 full weeks)
      const weeklyQuery: AnalyticsQuery = {
        siteId: "site_abc123",
        startDate: "2026-04-06",
        endDate: "2026-04-19",
        granularity: "weekly",
      };

      // Return 14 days of data starting from Monday Apr 6
      const dailyData = Array.from({ length: 14 }, (_, i) => ({
        id: `a${i}`,
        installationId: "inst_123",
        date: new Date(`2026-04-${String(i + 6).padStart(2, "0")}`),
        pageviews: 100,
        sessions: 50,
        uniqueVisitors: 40,
        avgTimeOnPage: "120.00",
        bounceRate: "45.50",
        lcpP75: "2400.00",
        clsP75: "0.0800",
        inpP75: "180.00",
        topPages: [],
      }));

      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(dailyData),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(weeklyQuery);

      // Should aggregate into 2 weeks
      expect(result.timeseries).toHaveLength(2);
      // First week should have 7 days summed
      expect(result.timeseries[0].pageviews).toBe(700);
    });

    it("should handle monthly granularity aggregation", async () => {
      const monthlyQuery: AnalyticsQuery = {
        siteId: "site_abc123",
        startDate: "2026-04-01",
        endDate: "2026-05-31",
        granularity: "monthly",
      };

      // Return data for April (30 days) and May (31 days)
      const aprilData = Array.from({ length: 30 }, (_, i) => ({
        id: `apr${i}`,
        installationId: "inst_123",
        date: new Date(`2026-04-${String(i + 1).padStart(2, "0")}`),
        pageviews: 100,
        sessions: 50,
        uniqueVisitors: 40,
        avgTimeOnPage: "120.00",
        bounceRate: "45.50",
        lcpP75: "2400.00",
        clsP75: "0.0800",
        inpP75: "180.00",
        topPages: [],
      }));

      const mayData = Array.from({ length: 31 }, (_, i) => ({
        id: `may${i}`,
        installationId: "inst_123",
        date: new Date(`2026-05-${String(i + 1).padStart(2, "0")}`),
        pageviews: 150,
        sessions: 75,
        uniqueVisitors: 60,
        avgTimeOnPage: "100.00",
        bounceRate: "40.00",
        lcpP75: "2200.00",
        clsP75: "0.0600",
        inpP75: "150.00",
        topPages: [],
      }));

      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([...aprilData, ...mayData]),
            }),
          }),
        })),
      }));

      const result = await service.getAnalytics(monthlyQuery);

      // Should aggregate into 2 months
      expect(result.timeseries).toHaveLength(2);
      // April should have 3000 pageviews (30 * 100)
      expect(result.timeseries[0].pageviews).toBe(3000);
      // May should have 4650 pageviews (31 * 150)
      expect(result.timeseries[1].pageviews).toBe(4650);
    });
  });

  describe("getTopPages", () => {
    it("should return top pages for a date range with default limit 10", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  topPages: [
                    { url: "/page1", pageviews: 100, uniqueVisitors: 80 },
                    { url: "/page2", pageviews: 90, uniqueVisitors: 70 },
                  ],
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getTopPages(
        "site_abc123",
        "2026-04-01",
        "2026-04-30"
      );

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe("/page1");
      expect(result[0].views).toBe(100);
    });

    it("should respect custom limit", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  topPages: Array.from({ length: 20 }, (_, i) => ({
                    url: `/page${i}`,
                    pageviews: 100 - i,
                    uniqueVisitors: 80 - i,
                  })),
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getTopPages(
        "site_abc123",
        "2026-04-01",
        "2026-04-30",
        5
      );

      expect(result).toHaveLength(5);
    });
  });

  describe("getCwvTrend", () => {
    it("should return CWV trend over time", async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "a1",
                  installationId: "inst_123",
                  date: new Date("2026-04-01"),
                  lcpP75: "2800.00",
                  clsP75: "0.0800",
                  inpP75: "180.00",
                },
                {
                  id: "a2",
                  installationId: "inst_123",
                  date: new Date("2026-04-02"),
                  lcpP75: "2400.00",
                  clsP75: "0.0600",
                  inpP75: "150.00",
                },
              ]),
            }),
          }),
        })),
      }));

      const result = await service.getCwvTrend(
        "site_abc123",
        "2026-04-01",
        "2026-04-02"
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: "2026-04-01",
        lcp: 2800,
        cls: 0.08,
        inp: 180,
      });
      expect(result[1]).toEqual({
        date: "2026-04-02",
        lcp: 2400,
        cls: 0.06,
        inp: 150,
      });
    });
  });

  describe("getCwvRating", () => {
    it("should rate LCP correctly using Google thresholds", () => {
      // Good: < 2500ms
      expect(service.getCwvRating("lcp", 2000)).toBe("good");
      expect(service.getCwvRating("lcp", 2499)).toBe("good");
      // Needs improvement: 2500-4000ms
      expect(service.getCwvRating("lcp", 2500)).toBe("needs-improvement");
      expect(service.getCwvRating("lcp", 3999)).toBe("needs-improvement");
      // Poor: >= 4000ms
      expect(service.getCwvRating("lcp", 4000)).toBe("poor");
      expect(service.getCwvRating("lcp", 5000)).toBe("poor");
    });

    it("should rate CLS correctly using Google thresholds", () => {
      // Good: < 0.1
      expect(service.getCwvRating("cls", 0.05)).toBe("good");
      expect(service.getCwvRating("cls", 0.099)).toBe("good");
      // Needs improvement: 0.1-0.25
      expect(service.getCwvRating("cls", 0.1)).toBe("needs-improvement");
      expect(service.getCwvRating("cls", 0.249)).toBe("needs-improvement");
      // Poor: >= 0.25
      expect(service.getCwvRating("cls", 0.25)).toBe("poor");
      expect(service.getCwvRating("cls", 0.5)).toBe("poor");
    });

    it("should rate INP correctly using Google thresholds", () => {
      // Good: < 200ms
      expect(service.getCwvRating("inp", 100)).toBe("good");
      expect(service.getCwvRating("inp", 199)).toBe("good");
      // Needs improvement: 200-500ms
      expect(service.getCwvRating("inp", 200)).toBe("needs-improvement");
      expect(service.getCwvRating("inp", 499)).toBe("needs-improvement");
      // Poor: >= 500ms
      expect(service.getCwvRating("inp", 500)).toBe("poor");
      expect(service.getCwvRating("inp", 800)).toBe("poor");
    });
  });
});
