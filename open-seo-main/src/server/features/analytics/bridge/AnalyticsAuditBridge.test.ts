/**
 * AnalyticsAuditBridge Tests
 * Phase 96: Comprehensive unit tests for the Analytics-Audit Bridge
 *
 * Coverage targets:
 * - All public methods (getTopicCoverageData, getHubSpokeLinkingData, etc.)
 * - Caching behavior (Redis and in-memory fallback)
 * - Error handling paths
 * - Data transformations
 * - Score calculations
 * - Recommendation generation
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// =============================================================================
// Mocks - Must be defined BEFORE imports
// =============================================================================

// Mock Redis
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    keys: vi.fn(),
    del: vi.fn(),
  },
  isCircuitBreakerClosed: vi.fn().mockReturnValue(true),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock cache constants
vi.mock("@/server/cache", () => ({
  ANALYTICS_CACHE_TTL_SECONDS: 300,
  registerInvalidationHandler: vi.fn(),
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  },
}));

// Mock GSC analytics schema
vi.mock("@/db/gsc-analytics-schema", () => ({
  seoGscQueryAnalytics: {},
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
}));

// Mock date-fns
vi.mock("date-fns", () => ({
  format: vi.fn().mockReturnValue("2024-01-01"),
  subDays: vi.fn().mockReturnValue(new Date()),
}));

// Mock the services that have database dependencies
vi.mock("../services/TopicClusterService", () => ({
  TopicClusterService: vi.fn().mockImplementation(() => ({
    getClusters: vi.fn(),
    getClusterWithPages: vi.fn(),
    createCluster: vi.fn(),
  })),
}));

vi.mock("../services/StrikingDistanceService", () => ({
  StrikingDistanceService: vi.fn().mockImplementation(() => ({
    getStrikingDistancePages: vi.fn(),
  })),
  getStrikingDistanceService: vi.fn().mockImplementation(() => ({
    getStrikingDistancePages: vi.fn(),
  })),
}));

vi.mock("../services/CannibalizationService", () => ({
  CannibalizationService: vi.fn().mockImplementation(() => ({
    detect: vi.fn(),
  })),
  getCannibalizationService: vi.fn().mockImplementation(() => ({
    detect: vi.fn(),
  })),
}));

vi.mock("../services/TrendDetectionService", () => ({
  TrendDetectionService: vi.fn().mockImplementation(() => ({
    analyzePageTrends: vi.fn(),
  })),
  getTrendDetectionService: vi.fn().mockImplementation(() => ({
    analyzePageTrends: vi.fn(),
  })),
}));

// Now import the module under test
import { AnalyticsAuditBridge, resetAnalyticsAuditBridge } from "./AnalyticsAuditBridge";
import type { TopicClusterWithPages, StrikingDistancePage, TrendAnalysis, StrikingDistanceResult, TrendResult } from "../types";

// Types for mocking - define inline to avoid import issues
interface CachedData<T> {
  data: T;
  metadata: {
    cachedAt: string;
    expiresAt: string;
    ttlSeconds: number;
    refreshAvailable: boolean;
    source: string;
  };
}

interface CannibalizationIssue {
  query: string;
  totalImpressions: number;
  totalClicks: number;
  pages: Array<{
    pageUrl: string;
    pageTitle: string;
    clicks: number;
    impressions: number;
    position: number;
    ctr: number;
  }>;
  severity: "critical" | "high" | "medium" | "low";
  impactEstimate: {
    monthlyLostClicks: number;
    estimatedLostTraffic: number;
    confidence: string;
  };
  recommendation: {
    action: string;
    primaryPage: string;
    reasoning: string;
    effort: string;
  };
}

interface DetectionResult {
  issues: CannibalizationIssue[];
  summary: {
    totalIssues: number;
    totalQueries: number;
    bySeverity: { critical: number; high: number; medium: number; low: number };
    totalMonthlyImpact: number;
  };
  metadata: {
    mode: string;
    dateRange: { start: string; end: string };
    queryCount: number;
    executionTimeMs: number;
  };
}

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockTopicCluster = (overrides: Partial<TopicClusterWithPages> = {}): TopicClusterWithPages => ({
  id: "cluster-1",
  siteId: "site-1",
  name: "SEO Best Practices",
  hubPage: {
    url: "https://example.com/seo-guide",
    topic: "SEO",
    title: "Complete SEO Guide",
    clicks: 500,
    impressions: 10000,
    position: 3.5,
    internalLinks: 15,
  },
  spokePages: [
    {
      url: "https://example.com/keyword-research",
      topic: "Keyword Research",
      title: "Keyword Research Guide",
      linksToHub: true,
      internalLinkCount: 5,
      clicks: 200,
      impressions: 4000,
      position: 5.2,
    },
    {
      url: "https://example.com/on-page-seo",
      topic: "On-Page SEO",
      title: "On-Page SEO Checklist",
      linksToHub: false,
      internalLinkCount: 3,
      clicks: 150,
      impressions: 3000,
      position: 6.8,
    },
    {
      url: "https://example.com/link-building",
      topic: "Link Building",
      title: "Link Building Strategies",
      linksToHub: true,
      internalLinkCount: 4,
      clicks: 180,
      impressions: 3500,
      position: 4.5,
    },
  ],
  coverage: 75,
  gaps: ["Technical SEO", "Local SEO"],
  totalClicks: 1030,
  totalImpressions: 20500,
  avgPosition: 5.0,
  lastAnalyzedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockStrikingDistancePage = (overrides: Partial<StrikingDistancePage> = {}): StrikingDistancePage => ({
  pageUrl: "https://example.com/page-1",
  pageTitle: "Test Page",
  avgPosition: 12.5,
  impressions: 1500,
  currentClicks: 45,
  potentialClicks: 200,
  clickGain: 155,
  difficulty: "easy",
  topQueries: [
    { query: "test keyword", position: 12, impressions: 500, clicks: 15 },
    { query: "another keyword", position: 13, impressions: 400, clicks: 12 },
  ],
  ...overrides,
});

const createMockCannibalizationIssue = (overrides: Partial<CannibalizationIssue> = {}): CannibalizationIssue => ({
  query: "test keyword",
  totalImpressions: 5000,
  totalClicks: 150,
  pages: [
    {
      pageUrl: "https://example.com/page-a",
      pageTitle: "Page A",
      clicks: 80,
      impressions: 2500,
      position: 5.2,
      ctr: 0.032,
    },
    {
      pageUrl: "https://example.com/page-b",
      pageTitle: "Page B",
      clicks: 70,
      impressions: 2500,
      position: 6.8,
      ctr: 0.028,
    },
  ],
  severity: "high",
  impactEstimate: {
    monthlyLostClicks: 50,
    estimatedLostTraffic: 1500,
    confidence: "high",
  },
  recommendation: {
    action: "consolidate",
    primaryPage: "https://example.com/page-a",
    reasoning: "Page A has better engagement metrics",
    effort: "medium",
  },
  ...overrides,
});

const createMockTrendAnalysis = (overrides: Partial<TrendAnalysis> = {}): TrendAnalysis => ({
  pageUrl: "https://example.com/trending-page",
  pageTitle: "Trending Page",
  currentClicks: 300,
  previousClicks: 200,
  currentImpressions: 5000,
  previousImpressions: 4000,
  currentPosition: 4.5,
  previousPosition: 6.0,
  changePercent: 50,
  trend: "growing",
  confidence: "high",
  topQueries: ["trending keyword 1", "trending keyword 2"],
  ...overrides,
});

// =============================================================================
// Mock Service Factories
// =============================================================================

const createMockTopicClusterService = () => ({
  getClusters: vi.fn(),
  getClusterWithPages: vi.fn(),
  createCluster: vi.fn(),
});

const createMockStrikingDistanceService = () => ({
  getStrikingDistancePages: vi.fn(),
});

const createMockCannibalizationService = () => ({
  detect: vi.fn(),
});

const createMockTrendDetectionService = () => ({
  analyzePageTrends: vi.fn(),
});

// =============================================================================
// Tests
// =============================================================================

describe("AnalyticsAuditBridge", () => {
  let bridge: AnalyticsAuditBridge;
  let mockTopicClusterService: ReturnType<typeof createMockTopicClusterService>;
  let mockStrikingDistanceService: ReturnType<typeof createMockStrikingDistanceService>;
  let mockCannibalizationService: ReturnType<typeof createMockCannibalizationService>;
  let mockTrendDetectionService: ReturnType<typeof createMockTrendDetectionService>;
  let mockRedis: { get: ReturnType<typeof vi.fn>; setex: ReturnType<typeof vi.fn>; keys: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAnalyticsAuditBridge();

    // Get the mocked redis
    const redisModule = await import("@/server/lib/redis");
    mockRedis = redisModule.redis as typeof mockRedis;

    // Create mock services
    mockTopicClusterService = createMockTopicClusterService();
    mockStrikingDistanceService = createMockStrikingDistanceService();
    mockCannibalizationService = createMockCannibalizationService();
    mockTrendDetectionService = createMockTrendDetectionService();

    // Create bridge with mock services
    bridge = new AnalyticsAuditBridge(
      mockTopicClusterService as any,
      mockStrikingDistanceService as any,
      mockCannibalizationService as any,
      mockTrendDetectionService as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // getTopicCoverageData Tests
  // ===========================================================================

  describe("getTopicCoverageData", () => {
    it("returns topic coverage data with cluster summaries", async () => {
      const mockClusters = [createMockTopicCluster()];
      mockTopicClusterService.getClusters.mockResolvedValue(mockClusters);

      const result = await bridge.getTopicCoverageData("site-1");

      expect(result.totalClusters).toBe(1);
      expect(result.coveredClusters).toBe(1);
      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].name).toBe("SEO Best Practices");
      expect(result.clusters[0].spokeCount).toBe(3);
    });

    it("identifies gap clusters with no spoke pages", async () => {
      const gapCluster = createMockTopicCluster({
        id: "gap-cluster",
        name: "Empty Cluster",
        spokePages: [],
      });
      mockTopicClusterService.getClusters.mockResolvedValue([gapCluster]);

      const result = await bridge.getTopicCoverageData("site-1");

      expect(result.gapClusters).toHaveLength(1);
      expect(result.gapClusters[0].spokeCount).toBe(0);
    });

    it("calculates correct coverage score", async () => {
      const covered = createMockTopicCluster({ id: "covered-1" });
      const gap = createMockTopicCluster({
        id: "gap-1",
        name: "Gap Cluster",
        spokePages: [],
      });
      mockTopicClusterService.getClusters.mockResolvedValue([covered, gap]);

      const result = await bridge.getTopicCoverageData("site-1");

      expect(result.coverageScore).toBe(50); // 1 of 2 covered
    });

    it("generates hub link recommendations for spokes without hub links", async () => {
      const mockCluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([mockCluster]);

      const result = await bridge.getTopicCoverageData("site-1");

      const linkRecs = result.recommendations.filter(
        (r) => r.category === "hub_spoke_linking"
      );
      expect(linkRecs.length).toBeGreaterThan(0);
      expect(linkRecs[0].affectedPages).toContain("https://example.com/on-page-seo");
    });

    it("generates content gap recommendations", async () => {
      const mockCluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([mockCluster]);

      const result = await bridge.getTopicCoverageData("site-1");

      const gapRecs = result.recommendations.filter(
        (r) => r.category === "topic_coverage"
      );
      expect(gapRecs.length).toBeGreaterThan(0);
      expect(gapRecs[0].affectedKeywords).toContain("Technical SEO");
    });

    it("returns cached data when available (Redis)", async () => {
      const cachedData = {
        totalClusters: 5,
        coveredClusters: 4,
        gapClusters: [],
        coverageScore: 80,
        clusters: [],
        recommendations: [],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await bridge.getTopicCoverageData("site-1", "audit-123");

      expect(mockRedis.get).toHaveBeenCalledWith("audit:audit-123:topic:site-1");
      expect(mockTopicClusterService.getClusters).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it("fetches fresh data on cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

      const result = await bridge.getTopicCoverageData("site-1", "audit-123");

      expect(mockTopicClusterService.getClusters).toHaveBeenCalledWith("site-1");
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(result.totalClusters).toBe(1);
    });

    it("returns empty data on service error", async () => {
      mockTopicClusterService.getClusters.mockRejectedValue(new Error("DB error"));

      const result = await bridge.getTopicCoverageData("site-1");

      expect(result.totalClusters).toBe(0);
      expect(result.coverageScore).toBe(100); // No clusters = nothing to penalize
      expect(result.recommendations).toHaveLength(0);
    });

    it("handles 100% coverage score with all clusters covered", async () => {
      const clusters = [
        createMockTopicCluster({ id: "c1" }),
        createMockTopicCluster({ id: "c2" }),
      ];
      mockTopicClusterService.getClusters.mockResolvedValue(clusters);

      const result = await bridge.getTopicCoverageData("site-1");

      expect(result.coverageScore).toBe(100);
    });
  });

  // ===========================================================================
  // getHubSpokeLinkingData Tests
  // ===========================================================================

  describe("getHubSpokeLinkingData", () => {
    it("identifies page as hub when it is a cluster hub", async () => {
      const cluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/seo-guide"
      );

      expect(result.isHub).toBe(true);
      expect(result.isSpoke).toBe(false);
      expect(result.clusterId).toBe("cluster-1");
      expect(result.linkedSpokes).toHaveLength(2); // Two spokes link to hub
      expect(result.missingSpokes).toHaveLength(1); // One spoke missing link
    });

    it("identifies page as spoke when it is a cluster spoke", async () => {
      const cluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/keyword-research"
      );

      expect(result.isHub).toBe(false);
      expect(result.isSpoke).toBe(true);
      expect(result.linksToHub).toBe(true);
      expect(result.hubPageUrl).toBe("https://example.com/seo-guide");
      expect(result.linkingScore).toBe(100);
    });

    it("returns 0 linking score for spoke not linking to hub", async () => {
      const cluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/on-page-seo"
      );

      expect(result.linksToHub).toBe(false);
      expect(result.linkingScore).toBe(0);
    });

    it("returns neutral score for page not in any cluster", async () => {
      mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/unrelated-page"
      );

      expect(result.isHub).toBe(false);
      expect(result.isSpoke).toBe(false);
      expect(result.linkingScore).toBe(100); // Don't penalize non-cluster pages
    });

    it("calculates hub linking score correctly", async () => {
      const cluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/seo-guide"
      );

      // 2 of 3 spokes link to hub = 67%
      expect(result.linkingScore).toBe(67);
    });

    it("returns cached data when available", async () => {
      const cachedData = {
        pageUrl: "https://example.com/test",
        isHub: true,
        isSpoke: false,
        linkingScore: 85,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/test",
        "audit-123"
      );

      expect(mockTopicClusterService.getClusters).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it("handles service error gracefully", async () => {
      mockTopicClusterService.getClusters.mockRejectedValue(new Error("Network error"));

      const result = await bridge.getHubSpokeLinkingData(
        "site-1",
        "https://example.com/page"
      );

      expect(result.isHub).toBe(false);
      expect(result.isSpoke).toBe(false);
      expect(result.linkingScore).toBe(100);
    });
  });

  // ===========================================================================
  // getClusterSizeData Tests
  // ===========================================================================

  describe("getClusterSizeData", () => {
    it("returns optimal when cluster is within target range", async () => {
      const cluster = createMockTopicCluster({
        spokePages: Array(18).fill(null).map((_, i) => ({
          url: `https://example.com/spoke-${i}`,
          topic: `Topic ${i}`,
          title: `Spoke ${i}`,
          linksToHub: true,
          internalLinkCount: 2,
          clicks: 50,
          impressions: 1000,
          position: 5,
        })),
      });
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getClusterSizeData(
        "site-1",
        "https://example.com/seo-guide"
      );

      expect(result).not.toBeNull();
      expect(result!.spokeCount).toBe(18);
      expect(result!.withinRange).toBe(true);
      expect(result!.suggestion).toBe("optimal");
      expect(result!.sizeScore).toBe(100);
    });

    it("suggests add_content for undersized clusters", async () => {
      const cluster = createMockTopicCluster({
        spokePages: Array(5).fill(null).map((_, i) => ({
          url: `https://example.com/spoke-${i}`,
          topic: `Topic ${i}`,
          title: `Spoke ${i}`,
          linksToHub: true,
          internalLinkCount: 2,
          clicks: 50,
          impressions: 1000,
          position: 5,
        })),
      });
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getClusterSizeData(
        "site-1",
        "https://example.com/seo-guide"
      );

      expect(result).not.toBeNull();
      expect(result!.spokeCount).toBe(5);
      expect(result!.withinRange).toBe(false);
      expect(result!.suggestion).toBe("add_content");
      expect(result!.sizeScore).toBeLessThan(100);
    });

    it("suggests consider_splitting for oversized clusters", async () => {
      const cluster = createMockTopicCluster({
        spokePages: Array(35).fill(null).map((_, i) => ({
          url: `https://example.com/spoke-${i}`,
          topic: `Topic ${i}`,
          title: `Spoke ${i}`,
          linksToHub: true,
          internalLinkCount: 2,
          clicks: 50,
          impressions: 1000,
          position: 5,
        })),
      });
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getClusterSizeData(
        "site-1",
        "https://example.com/seo-guide"
      );

      expect(result).not.toBeNull();
      expect(result!.spokeCount).toBe(35);
      expect(result!.withinRange).toBe(false);
      expect(result!.suggestion).toBe("consider_splitting");
    });

    it("returns null for page not in any cluster", async () => {
      mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

      const result = await bridge.getClusterSizeData(
        "site-1",
        "https://example.com/unrelated-page"
      );

      expect(result).toBeNull();
    });

    it("returns cluster size data for spoke pages", async () => {
      mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

      const result = await bridge.getClusterSizeData(
        "site-1",
        "https://example.com/keyword-research"
      );

      expect(result).not.toBeNull();
      expect(result!.clusterName).toBe("SEO Best Practices");
    });
  });

  // ===========================================================================
  // getContentGapData Tests
  // ===========================================================================

  describe("getContentGapData", () => {
    it("returns striking distance opportunities", async () => {
      const mockStrikingResult: StrikingDistanceResult = {
        pages: [
          createMockStrikingDistancePage(),
          createMockStrikingDistancePage({
            pageUrl: "https://example.com/page-2",
            impressions: 800,
            difficulty: "medium",
          }),
        ],
        meta: {
          totalPages: 2,
          totalPotentialClicks: 300,
          avgDifficulty: 1.5,
        },
      };

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: mockStrikingResult,
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getContentGapData("site-1");

      expect(result.strikingDistanceCount).toBe(2);
      expect(result.highValueOpportunities).toHaveLength(2); // Both have >500 impressions (1500 and 800)
      expect(result.totalPotentialClicks).toBe(300);
    });

    it("identifies quick wins correctly", async () => {
      const quickWinPage = createMockStrikingDistancePage({
        avgPosition: 12,
        difficulty: "easy",
      });

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: {
          pages: [quickWinPage],
          meta: { totalPages: 1, totalPotentialClicks: 155, avgDifficulty: 1 },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getContentGapData("site-1");

      expect(result.quickWins).toHaveLength(1);
    });

    it("calculates gap score based on opportunity count", async () => {
      const manyPages = Array(30).fill(null).map((_, i) =>
        createMockStrikingDistancePage({
          pageUrl: `https://example.com/page-${i}`,
          impressions: 200,
        })
      );

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: {
          pages: manyPages,
          meta: { totalPages: 30, totalPotentialClicks: 4500, avgDifficulty: 2 },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getContentGapData("site-1");

      expect(result.gapScore).toBe(60); // 26-50 pages = score 60
    });

    it("returns empty data on service error", async () => {
      mockStrikingDistanceService.getStrikingDistancePages.mockRejectedValue(
        new Error("API error")
      );

      const result = await bridge.getContentGapData("site-1");

      expect(result.strikingDistanceCount).toBe(0);
      expect(result.gapScore).toBe(100);
      expect(result.recommendations).toHaveLength(0);
    });

    it("generates quick win recommendations", async () => {
      const quickWins = Array(5).fill(null).map((_, i) =>
        createMockStrikingDistancePage({
          pageUrl: `https://example.com/quick-win-${i}`,
          difficulty: "easy",
          clickGain: 100,
          impressions: 1500,
        })
      );

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: {
          pages: quickWins,
          meta: { totalPages: 5, totalPotentialClicks: 500, avgDifficulty: 1 },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getContentGapData("site-1");

      const quickWinRecs = result.recommendations.filter(
        (r) => r.id === "striking-quick-wins"
      );
      expect(quickWinRecs).toHaveLength(1);
      expect(quickWinRecs[0].priority).toBe("high");
    });
  });

  // ===========================================================================
  // getTrendData Tests
  // ===========================================================================

  describe("getTrendData", () => {
    it("returns trend data with growing and decaying pages", async () => {
      const mockTrendResult: TrendResult = {
        pages: [
          createMockTrendAnalysis({ trend: "growing", changePercent: 30 }),
          createMockTrendAnalysis({
            pageUrl: "https://example.com/decaying-page",
            trend: "decaying",
            changePercent: -25,
            currentClicks: 100,
            previousClicks: 133,
          }),
        ],
        meta: {
          totalAnalyzed: 50,
          growingCount: 1,
          decayingCount: 1,
          stableCount: 48,
          periodDays: 21,
          threshold: 0.1,
        },
      };

      const cachedData: CachedData<TrendResult> = {
        data: mockTrendResult,
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockTrendDetectionService.analyzePageTrends.mockResolvedValue(cachedData);

      const result = await bridge.getTrendData("site-1");

      expect(result.growingPages).toHaveLength(1);
      expect(result.decayingPages).toHaveLength(1);
      expect(result.totalPagesAnalyzed).toBe(50);
      expect(result.periodDays).toBe(21);
    });

    it("calculates net trend score correctly", async () => {
      const cachedData: CachedData<TrendResult> = {
        data: {
          pages: [],
          meta: {
            totalAnalyzed: 100,
            growingCount: 30,
            decayingCount: 10,
            stableCount: 60,
            periodDays: 21,
            threshold: 0.1,
          },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockTrendDetectionService.analyzePageTrends.mockResolvedValue(cachedData);

      const result = await bridge.getTrendData("site-1");

      // Net = (30 - 10) / 100 * 100 = 20
      expect(result.netTrend).toBe(20);
    });

    it("generates recommendations for high-confidence decaying pages", async () => {
      const decayingPages = Array(5).fill(null).map((_, i) =>
        createMockTrendAnalysis({
          pageUrl: `https://example.com/decaying-${i}`,
          trend: "decaying",
          changePercent: -20,
          confidence: "high",
        })
      );

      const cachedData: CachedData<TrendResult> = {
        data: {
          pages: decayingPages,
          meta: {
            totalAnalyzed: 100,
            growingCount: 0,
            decayingCount: 5,
            stableCount: 95,
            periodDays: 21,
            threshold: 0.1,
          },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockTrendDetectionService.analyzePageTrends.mockResolvedValue(cachedData);

      const result = await bridge.getTrendData("site-1");

      const decayRecs = result.recommendations.filter(
        (r) => r.id === "trend-decay-critical"
      );
      expect(decayRecs).toHaveLength(1);
    });

    it("returns empty data on service error", async () => {
      mockTrendDetectionService.analyzePageTrends.mockRejectedValue(
        new Error("Timeout")
      );

      const result = await bridge.getTrendData("site-1");

      expect(result.decayingPages).toHaveLength(0);
      expect(result.growingPages).toHaveLength(0);
      expect(result.netTrend).toBe(0);
    });
  });

  // ===========================================================================
  // getStrikingDistanceData Tests
  // ===========================================================================

  describe("getStrikingDistanceData", () => {
    it("returns striking distance audit data", async () => {
      const mockResult: StrikingDistanceResult = {
        pages: [
          createMockStrikingDistancePage(),
          createMockStrikingDistancePage({
            pageUrl: "https://example.com/page-2",
            impressions: 600,
            difficulty: "medium",
          }),
        ],
        meta: {
          totalPages: 2,
          totalPotentialClicks: 350,
          avgDifficulty: 1.5,
        },
      };

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: mockResult,
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getStrikingDistanceData("site-1");

      expect(result.totalOpportunities).toBe(2);
      expect(result.estimatedTrafficGain).toBe(350);
      expect(result.highValueOpportunities).toHaveLength(2);
    });

    it("filters quick wins based on difficulty and impressions", async () => {
      const mockResult: StrikingDistanceResult = {
        pages: [
          createMockStrikingDistancePage({
            difficulty: "easy",
            impressions: 200,
          }), // quick win
          createMockStrikingDistancePage({
            pageUrl: "https://example.com/hard",
            difficulty: "hard",
            impressions: 200,
          }), // not quick win
        ],
        meta: { totalPages: 2, totalPotentialClicks: 300, avgDifficulty: 2 },
      };

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: mockResult,
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };

      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getStrikingDistanceData("site-1");

      expect(result.quickWins).toHaveLength(1);
      expect(result.quickWins[0].difficulty).toBe("easy");
    });
  });

  // ===========================================================================
  // getCannibalizationData Tests
  // ===========================================================================

  describe("getCannibalizationData", () => {
    it("returns cannibalization issues grouped by severity", async () => {
      const mockDetectionResult: DetectionResult = {
        issues: [
          createMockCannibalizationIssue({ severity: "critical" }),
          createMockCannibalizationIssue({
            query: "another keyword",
            severity: "high",
          }),
          createMockCannibalizationIssue({
            query: "third keyword",
            severity: "medium",
          }),
        ],
        summary: {
          totalIssues: 3,
          totalQueries: 3,
          bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
          totalMonthlyImpact: 150,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 250,
        },
      };

      mockCannibalizationService.detect.mockResolvedValue(mockDetectionResult);

      const result = await bridge.getCannibalizationData("site-1");

      expect(result.totalIssues).toBe(3);
      expect(result.criticalIssues).toHaveLength(1);
      expect(result.highIssues).toHaveLength(1);
      expect(result.moderateIssues).toHaveLength(1);
      expect(result.lowIssues).toHaveLength(0);
    });

    it("calculates cannibalization score with severity weighting", async () => {
      const mockDetectionResult: DetectionResult = {
        issues: [
          createMockCannibalizationIssue({ severity: "critical" }),
          createMockCannibalizationIssue({ query: "kw2", severity: "critical" }),
          createMockCannibalizationIssue({ query: "kw3", severity: "high" }),
        ],
        summary: {
          totalIssues: 3,
          totalQueries: 3,
          bySeverity: { critical: 2, high: 1, medium: 0, low: 0 },
          totalMonthlyImpact: 200,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 200,
        },
      };

      mockCannibalizationService.detect.mockResolvedValue(mockDetectionResult);

      const result = await bridge.getCannibalizationData("site-1");

      // Score = 100 - (2*15 + 1*8) = 100 - 38 = 62
      expect(result.cannibalizationScore).toBe(62);
    });

    it("returns 100 score when no cannibalization issues", async () => {
      const mockDetectionResult: DetectionResult = {
        issues: [],
        summary: {
          totalIssues: 0,
          totalQueries: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          totalMonthlyImpact: 0,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 100,
        },
      };

      mockCannibalizationService.detect.mockResolvedValue(mockDetectionResult);

      const result = await bridge.getCannibalizationData("site-1");

      expect(result.cannibalizationScore).toBe(100);
      expect(result.recommendations).toHaveLength(0);
    });

    it("generates critical cannibalization recommendations", async () => {
      const mockDetectionResult: DetectionResult = {
        issues: [
          createMockCannibalizationIssue({ severity: "critical" }),
        ],
        summary: {
          totalIssues: 1,
          totalQueries: 1,
          bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
          totalMonthlyImpact: 50,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 150,
        },
      };

      mockCannibalizationService.detect.mockResolvedValue(mockDetectionResult);

      const result = await bridge.getCannibalizationData("site-1");

      const criticalRecs = result.recommendations.filter(
        (r) => r.id === "cannibal-critical"
      );
      expect(criticalRecs).toHaveLength(1);
      expect(criticalRecs[0].priority).toBe("critical");
    });

    it("returns empty data on service error", async () => {
      mockCannibalizationService.detect.mockRejectedValue(new Error("DB timeout"));

      const result = await bridge.getCannibalizationData("site-1");

      expect(result.totalIssues).toBe(0);
      expect(result.cannibalizationScore).toBe(100);
    });
  });

  // ===========================================================================
  // getFullAuditContext Tests
  // ===========================================================================

  describe("getFullAuditContext", () => {
    beforeEach(() => {
      // Set up default mock responses
      mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

      const strikingCachedData: CachedData<StrikingDistanceResult> = {
        data: {
          pages: [createMockStrikingDistancePage()],
          meta: { totalPages: 1, totalPotentialClicks: 155, avgDifficulty: 1 },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };
      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(strikingCachedData);

      mockCannibalizationService.detect.mockResolvedValue({
        issues: [createMockCannibalizationIssue()],
        summary: {
          totalIssues: 1,
          totalQueries: 1,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
          totalMonthlyImpact: 50,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 200,
        },
      });
    });

    it("returns combined audit context with all data", async () => {
      const result = await bridge.getFullAuditContext("site-1");

      expect(result.topicCoverage).toBeDefined();
      expect(result.contentGaps).toBeDefined();
      expect(result.cannibalization).toBeDefined();
      expect(result.hasAnalyticsData).toBe(true);
      expect(result.lastSyncAt).toBeInstanceOf(Date);
    });

    it("includes hub-spoke data when pageUrl provided", async () => {
      const result = await bridge.getFullAuditContext(
        "site-1",
        "https://example.com/seo-guide"
      );

      expect(result.hubSpokeLinking).toBeDefined();
      expect(result.hubSpokeLinking?.isHub).toBe(true);
      expect(result.clusterSize).toBeDefined();
    });

    it("excludes page-specific data when no pageUrl", async () => {
      const result = await bridge.getFullAuditContext("site-1");

      expect(result.hubSpokeLinking).toBeUndefined();
      expect(result.clusterSize).toBeUndefined();
    });

    it("sets hasAnalyticsData to false when all sources empty", async () => {
      mockTopicClusterService.getClusters.mockResolvedValue([]);

      const emptyStriking: CachedData<StrikingDistanceResult> = {
        data: { pages: [], meta: { totalPages: 0, totalPotentialClicks: 0, avgDifficulty: 0 } },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };
      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(emptyStriking);

      mockCannibalizationService.detect.mockResolvedValue({
        issues: [],
        summary: {
          totalIssues: 0,
          totalQueries: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          totalMonthlyImpact: 0,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 0,
          executionTimeMs: 50,
        },
      });

      const result = await bridge.getFullAuditContext("site-1");

      expect(result.hasAnalyticsData).toBe(false);
    });
  });

  // ===========================================================================
  // generateRecommendations Tests
  // ===========================================================================

  describe("generateRecommendations", () => {
    it("combines and sorts recommendations by priority", async () => {
      mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

      const strikingCachedData: CachedData<StrikingDistanceResult> = {
        data: {
          pages: Array(15).fill(null).map((_, i) =>
            createMockStrikingDistancePage({
              pageUrl: `https://example.com/page-${i}`,
              difficulty: "easy",
              clickGain: 100,
              impressions: 1500,
            })
          ),
          meta: { totalPages: 15, totalPotentialClicks: 1500, avgDifficulty: 1 },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };
      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(strikingCachedData);

      mockCannibalizationService.detect.mockResolvedValue({
        issues: [
          createMockCannibalizationIssue({ severity: "critical" }),
        ],
        summary: {
          totalIssues: 1,
          totalQueries: 1,
          bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
          totalMonthlyImpact: 50,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 200,
        },
      });

      const result = await bridge.generateRecommendations("site-1");

      expect(result.length).toBeGreaterThan(0);
      // Critical should come first
      expect(result[0].priority).toBe("critical");

      // Verify sorting: critical < high < medium < low
      const priorities = result.map((r) => r.priority);
      const criticalIdx = priorities.indexOf("critical");
      const highIdx = priorities.indexOf("high");
      if (criticalIdx >= 0 && highIdx >= 0) {
        expect(criticalIdx).toBeLessThan(highIdx);
      }
    });
  });

  // ===========================================================================
  // Cache Management Tests
  // ===========================================================================

  describe("Cache Management", () => {
    describe("clearCache", () => {
      it("clears in-memory cache", async () => {
        // Populate cache via a call
        mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);
        await bridge.getTopicCoverageData("site-1"); // Uses in-memory cache (no auditId)

        bridge.clearCache();

        // Next call should fetch again
        await bridge.getTopicCoverageData("site-1");
        expect(mockTopicClusterService.getClusters).toHaveBeenCalledTimes(2);
      });
    });

    describe("cleanupAuditCache", () => {
      it("deletes Redis keys for specific audit", async () => {
        mockRedis.keys.mockResolvedValue([
          "audit:audit-123:topic:site-1",
          "audit:audit-123:gap:site-1",
        ]);
        mockRedis.del.mockResolvedValue(2);

        const deleted = await bridge.cleanupAuditCache("audit-123");

        expect(mockRedis.keys).toHaveBeenCalledWith("audit:audit-123:*");
        expect(mockRedis.del).toHaveBeenCalledWith(
          "audit:audit-123:topic:site-1",
          "audit:audit-123:gap:site-1"
        );
        expect(deleted).toBe(2);
      });

      it("returns 0 when no keys to delete", async () => {
        mockRedis.keys.mockResolvedValue([]);

        const deleted = await bridge.cleanupAuditCache("audit-456");

        expect(mockRedis.del).not.toHaveBeenCalled();
        expect(deleted).toBe(0);
      });

      it("returns 0 when auditId is empty", async () => {
        const deleted = await bridge.cleanupAuditCache("");

        expect(mockRedis.keys).not.toHaveBeenCalled();
        expect(deleted).toBe(0);
      });

      it("handles Redis errors gracefully", async () => {
        mockRedis.keys.mockRejectedValue(new Error("Connection refused"));

        const deleted = await bridge.cleanupAuditCache("audit-789");

        expect(deleted).toBe(0);
      });
    });

    describe("Redis fallback to in-memory", () => {
      it("falls back to in-memory when Redis get fails", async () => {
        mockRedis.get.mockRejectedValue(new Error("Redis unavailable"));
        mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

        const result = await bridge.getTopicCoverageData("site-1", "audit-123");

        expect(result.totalClusters).toBe(1);
        // Should have attempted Redis but fallen back
        expect(mockRedis.get).toHaveBeenCalled();
      });

      it("falls back to in-memory when Redis setex fails", async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockRejectedValue(new Error("Redis write error"));
        mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

        const result = await bridge.getTopicCoverageData("site-1", "audit-123");

        expect(result.totalClusters).toBe(1);
        // Data should still be returned despite cache failure
      });
    });

    describe("in-memory cache expiration", () => {
      it("uses in-memory cache when no auditId provided", async () => {
        mockTopicClusterService.getClusters.mockResolvedValue([createMockTopicCluster()]);

        // First call - populates cache
        await bridge.getTopicCoverageData("site-1");
        // Second call - should use cache
        await bridge.getTopicCoverageData("site-1");

        expect(mockTopicClusterService.getClusters).toHaveBeenCalledTimes(1);
        expect(mockRedis.get).not.toHaveBeenCalled(); // No Redis without auditId
      });
    });
  });

  // ===========================================================================
  // Score Calculation Tests (Edge Cases)
  // ===========================================================================

  describe("Score Calculations", () => {
    describe("calculateClusterSizeScore", () => {
      it("returns 100 for optimal cluster size (15-25)", async () => {
        const cluster = createMockTopicCluster({
          spokePages: Array(20).fill(null).map((_, i) => ({
            url: `https://example.com/spoke-${i}`,
            topic: `Topic ${i}`,
            title: `Spoke ${i}`,
            linksToHub: true,
            internalLinkCount: 2,
            clicks: 50,
            impressions: 1000,
            position: 5,
          })),
        });
        mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

        const result = await bridge.getClusterSizeData(
          "site-1",
          "https://example.com/seo-guide"
        );

        expect(result!.sizeScore).toBe(100);
      });

      it("penalizes undersized clusters (5 points per missing spoke)", async () => {
        const cluster = createMockTopicCluster({
          spokePages: Array(10).fill(null).map((_, i) => ({
            url: `https://example.com/spoke-${i}`,
            topic: `Topic ${i}`,
            title: `Spoke ${i}`,
            linksToHub: true,
            internalLinkCount: 2,
            clicks: 50,
            impressions: 1000,
            position: 5,
          })),
        });
        mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

        const result = await bridge.getClusterSizeData(
          "site-1",
          "https://example.com/seo-guide"
        );

        // 15 - 10 = 5 missing, 5 * 5 = 25 penalty, score = 75
        expect(result!.sizeScore).toBe(75);
      });

      it("penalizes oversized clusters (3 points per excess spoke)", async () => {
        const cluster = createMockTopicCluster({
          spokePages: Array(30).fill(null).map((_, i) => ({
            url: `https://example.com/spoke-${i}`,
            topic: `Topic ${i}`,
            title: `Spoke ${i}`,
            linksToHub: true,
            internalLinkCount: 2,
            clicks: 50,
            impressions: 1000,
            position: 5,
          })),
        });
        mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

        const result = await bridge.getClusterSizeData(
          "site-1",
          "https://example.com/seo-guide"
        );

        // 30 - 25 = 5 excess, 5 * 3 = 15 penalty, score = 85
        expect(result!.sizeScore).toBe(85);
      });
    });

    describe("calculateGapScore", () => {
      it("returns 100 when no striking distance pages", async () => {
        const cachedData: CachedData<StrikingDistanceResult> = {
          data: {
            pages: [],
            meta: { totalPages: 0, totalPotentialClicks: 0, avgDifficulty: 0 },
          },
          metadata: {
            cachedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            ttlSeconds: 300,
            refreshAvailable: false,
            source: "fresh",
          },
        };
        mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

        const result = await bridge.getContentGapData("site-1");

        expect(result.gapScore).toBe(100);
      });

      it("returns 20 for 100+ striking distance pages", async () => {
        const pages = Array(120).fill(null).map((_, i) =>
          createMockStrikingDistancePage({ pageUrl: `https://example.com/p-${i}` })
        );

        const cachedData: CachedData<StrikingDistanceResult> = {
          data: {
            pages,
            meta: { totalPages: 120, totalPotentialClicks: 18000, avgDifficulty: 2 },
          },
          metadata: {
            cachedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            ttlSeconds: 300,
            refreshAvailable: false,
            source: "fresh",
          },
        };
        mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

        const result = await bridge.getContentGapData("site-1");

        expect(result.gapScore).toBe(20);
      });
    });

    describe("calculateCannibalizationScore", () => {
      it("floors score at 0 (never negative)", async () => {
        // Create many critical issues to try to push score below 0
        const issues = Array(10).fill(null).map((_, i) =>
          createMockCannibalizationIssue({
            query: `keyword-${i}`,
            severity: "critical",
          })
        );

        mockCannibalizationService.detect.mockResolvedValue({
          issues,
          summary: {
            totalIssues: 10,
            totalQueries: 10,
            bySeverity: { critical: 10, high: 0, medium: 0, low: 0 },
            totalMonthlyImpact: 500,
          },
          metadata: {
            mode: "stored",
            dateRange: { start: "2024-01-01", end: "2024-01-31" },
            queryCount: 100,
            executionTimeMs: 300,
          },
        });

        const result = await bridge.getCannibalizationData("site-1");

        // 10 * 15 = 150 deduction, but floor at 0
        expect(result.cannibalizationScore).toBe(0);
      });
    });
  });

  // ===========================================================================
  // Data Transformation Tests
  // ===========================================================================

  describe("Data Transformations", () => {
    it("transforms cluster data correctly", async () => {
      const cluster = createMockTopicCluster();
      mockTopicClusterService.getClusters.mockResolvedValue([cluster]);

      const result = await bridge.getTopicCoverageData("site-1");

      const summary = result.clusters[0];
      expect(summary.id).toBe("cluster-1");
      expect(summary.name).toBe("SEO Best Practices");
      expect(summary.hubPageUrl).toBe("https://example.com/seo-guide");
      expect(summary.spokeCount).toBe(3);
      expect(summary.hubLinkCoverage).toBe(67); // 2/3 linked
      expect(summary.spokesWithoutHubLink).toContain("https://example.com/on-page-seo");
      expect(summary.gaps).toContain("Technical SEO");
    });

    it("transforms cannibalization issue correctly", async () => {
      const issue = createMockCannibalizationIssue();
      mockCannibalizationService.detect.mockResolvedValue({
        issues: [issue],
        summary: {
          totalIssues: 1,
          totalQueries: 1,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
          totalMonthlyImpact: 50,
        },
        metadata: {
          mode: "stored",
          dateRange: { start: "2024-01-01", end: "2024-01-31" },
          queryCount: 100,
          executionTimeMs: 150,
        },
      });

      const result = await bridge.getCannibalizationData("site-1");

      const summary = result.highIssues[0];
      expect(summary.keyword).toBe("test keyword");
      expect(summary.competingPageCount).toBe(2);
      expect(summary.competingUrls).toHaveLength(2);
      expect(summary.severity).toBe("high");
      expect(summary.monthlyLostClicks).toBe(50);
      expect(summary.recommendedAction).toBe("consolidate");
    });

    it("transforms trend data correctly", async () => {
      const trendAnalysis = createMockTrendAnalysis();
      const cachedData: CachedData<TrendResult> = {
        data: {
          pages: [trendAnalysis],
          meta: {
            totalAnalyzed: 1,
            growingCount: 1,
            decayingCount: 0,
            stableCount: 0,
            periodDays: 21,
            threshold: 0.1,
          },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };
      mockTrendDetectionService.analyzePageTrends.mockResolvedValue(cachedData);

      const result = await bridge.getTrendData("site-1");

      const summary = result.growingPages[0];
      expect(summary.pageUrl).toBe("https://example.com/trending-page");
      expect(summary.changePercent).toBe(50);
      expect(summary.currentClicks).toBe(300);
      expect(summary.positionChange).toBe(-1.5); // 4.5 - 6.0
      expect(summary.confidence).toBe("high");
    });

    it("limits top keywords to 5", async () => {
      const pageWithManyQueries = createMockStrikingDistancePage({
        topQueries: Array(10).fill(null).map((_, i) => ({
          query: `keyword-${i}`,
          position: 12,
          impressions: 100,
          clicks: 5,
        })),
      });

      const cachedData: CachedData<StrikingDistanceResult> = {
        data: {
          pages: [pageWithManyQueries],
          meta: { totalPages: 1, totalPotentialClicks: 155, avgDifficulty: 1 },
        },
        metadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          ttlSeconds: 300,
          refreshAvailable: false,
          source: "fresh",
        },
      };
      mockStrikingDistanceService.getStrikingDistancePages.mockResolvedValue(cachedData);

      const result = await bridge.getContentGapData("site-1");

      expect(result.quickWins[0]?.topKeywords.length).toBeLessThanOrEqual(5);
    });
  });

  // ===========================================================================
  // getGscDataStatus Tests (OPS-005)
  // ===========================================================================

  describe("getGscDataStatus", () => {
    let mockDb: { execute: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      const dbModule = await import("@/db");
      mockDb = dbModule.db as typeof mockDb;
    });

    it("returns available status with fresh data", async () => {
      const lastSync = new Date().toISOString();
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ last_sync: lastSync, row_count: 100 }],
      });

      const result = await bridge.getGscDataStatus("site-1");

      expect(result.available).toBe(true);
      expect(result.usingFallback).toBe(false);
      expect(result.dataSource).toBe("fresh");
    });

    it("returns available status with historical fallback data", async () => {
      const oldSync = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      // First call: no recent data
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ last_sync: null, row_count: 0 }],
      });
      // Second call: historical data exists
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ last_sync: oldSync }],
      });

      const result = await bridge.getGscDataStatus("site-1");

      expect(result.available).toBe(true);
      expect(result.usingFallback).toBe(true);
      expect(result.dataSource).toBe("historical");
    });

    it("returns unavailable when no data exists", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ last_sync: null, row_count: 0 }],
      });
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ last_sync: null }],
      });

      const result = await bridge.getGscDataStatus("site-1");

      expect(result.available).toBe(false);
      expect(result.unavailableReason).toBe("no_connection");
    });

    it("returns unavailable on database error", async () => {
      mockDb.execute.mockRejectedValue(new Error("Connection timeout"));

      const result = await bridge.getGscDataStatus("site-1");

      expect(result.available).toBe(false);
      expect(result.unavailableReason).toBe("sync_failed");
    });
  });

  // ===========================================================================
  // getPositionHistory Tests (OPS-006)
  // ===========================================================================

  describe("getPositionHistory", () => {
    let mockDb: { execute: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      const dbModule = await import("@/db");
      mockDb = dbModule.db as typeof mockDb;
    });

    it("returns position history data from database", async () => {
      const mockRows = [
        { query_date: "2024-01-01", avg_position: 5.0, total_clicks: 100, total_impressions: 2000, avg_ctr: 0.05 },
        { query_date: "2024-01-02", avg_position: 4.5, total_clicks: 120, total_impressions: 2200, avg_ctr: 0.055 },
        { query_date: "2024-01-03", avg_position: 4.2, total_clicks: 130, total_impressions: 2300, avg_ctr: 0.057 },
        { query_date: "2024-01-04", avg_position: 4.0, total_clicks: 140, total_impressions: 2400, avg_ctr: 0.058 },
        { query_date: "2024-01-05", avg_position: 3.8, total_clicks: 150, total_impressions: 2500, avg_ctr: 0.06 },
        { query_date: "2024-01-06", avg_position: 3.5, total_clicks: 160, total_impressions: 2600, avg_ctr: 0.062 },
        { query_date: "2024-01-07", avg_position: 3.2, total_clicks: 170, total_impressions: 2700, avg_ctr: 0.063 },
      ];
      mockDb.execute.mockResolvedValue({ rows: mockRows });

      const result = await bridge.getPositionHistory(
        "site-1",
        "https://example.com/page",
        30
      );

      expect(result).not.toBeNull();
      expect(result!.dataPoints).toHaveLength(7);
      expect(result!.url).toBe("https://example.com/page");
      expect(result!.periodDays).toBe(30);
    });

    it("returns null when no data found", async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      const result = await bridge.getPositionHistory(
        "site-1",
        "https://example.com/new-page",
        30
      );

      expect(result).toBeNull();
    });

    it("handles database errors gracefully", async () => {
      mockDb.execute.mockRejectedValue(new Error("Query timeout"));

      const result = await bridge.getPositionHistory(
        "site-1",
        "https://example.com/page",
        30
      );

      expect(result).toBeNull();
    });
  });
});
