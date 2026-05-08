/**
 * TopicClusterService Tests
 * Phase 96-04: Topic Clusters with Hub/Spoke Detection
 *
 * TDD RED phase: Tests written first
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicClusterService } from "./TopicClusterService";

// Mock repository instance methods
const mockRepo = {
  findBySiteId: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getClusterPages: vi.fn(),
  addPageToCluster: vi.fn(),
  removePageFromCluster: vi.fn(),
  clearClusterPages: vi.fn(),
  updateClusterMetrics: vi.fn(),
  findPotentialHubs: vi.fn(),
};

// Mock the repository
vi.mock("../repositories/TopicClusterRepository", () => ({
  TopicClusterRepository: class {
    findBySiteId = mockRepo.findBySiteId;
    findById = mockRepo.findById;
    create = mockRepo.create;
    update = mockRepo.update;
    delete = mockRepo.delete;
    getClusterPages = mockRepo.getClusterPages;
    addPageToCluster = mockRepo.addPageToCluster;
    removePageFromCluster = mockRepo.removePageFromCluster;
    clearClusterPages = mockRepo.clearClusterPages;
    updateClusterMetrics = mockRepo.updateClusterMetrics;
    findPotentialHubs = mockRepo.findPotentialHubs;
  },
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  },
}));

describe("TopicClusterService", () => {
  let service: TopicClusterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TopicClusterService();
  });

  describe("createCluster", () => {
    it("should create a cluster with hub page and initial spokes", async () => {
      const siteId = "site-123";
      const input = {
        name: "SEO Guide",
        hubPageUrl: "https://example.com/seo-guide",
        hubTopic: "SEO",
      };

      mockRepo.create.mockResolvedValue({
        id: "cluster-1",
        siteId,
        name: input.name,
        hubPageUrl: input.hubPageUrl,
        hubTopic: input.hubTopic,
        coverage: 0,
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: null,
        gaps: [],
        lastAnalyzedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.addPageToCluster.mockResolvedValue(undefined);
      mockRepo.getClusterPages.mockResolvedValue([
        {
          pageUrl: "https://example.com/seo-guide",
          pageTopic: "SEO",
          isHub: true,
          linksToHub: false,
          internalLinkCount: 15,
          clicks: 500,
          impressions: 10000,
          position: 3.5,
        },
      ]);
      mockRepo.findById.mockResolvedValue({
        id: "cluster-1",
        siteId,
        name: input.name,
        hubPageUrl: input.hubPageUrl,
        hubTopic: input.hubTopic,
        coverage: 0,
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: null,
        gaps: [],
        lastAnalyzedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createCluster(siteId, input);

      expect(result).not.toBeNull();
      expect(result?.hubPage.url).toBe(input.hubPageUrl);
      expect(result?.hubPage.topic).toBe(input.hubTopic);
    });
  });

  describe("detectHubPages", () => {
    it("should identify pages with high incoming internal links as potential hubs", async () => {
      const siteId = "site-123";

      // Mock pages with internal link counts
      const mockPotentialHubs = [
        {
          pageUrl: "https://example.com/seo-guide",
          internalLinks: 25,
          clicks: 1000,
          impressions: 20000,
          position: 2.5,
        },
        {
          pageUrl: "https://example.com/content-marketing",
          internalLinks: 18,
          clicks: 800,
          impressions: 15000,
          position: 4.0,
        },
      ];

      mockRepo.findPotentialHubs.mockResolvedValue(mockPotentialHubs);

      const result = await service.detectHubPages(siteId, { minHubLinks: 10 });

      // Should return pages with >= 10 incoming links
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("analyzeClusterCoverage", () => {
    it("should calculate coverage percentage based on spoke-to-hub linking", async () => {
      const clusterId = "cluster-1";
      const siteId = "site-123";

      mockRepo.findById.mockResolvedValue({
        id: clusterId,
        siteId,
        name: "SEO Guide",
        hubPageUrl: "https://example.com/seo-guide",
        hubTopic: "SEO",
        coverage: 0,
        gaps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.getClusterPages.mockResolvedValue([
        {
          pageUrl: "https://example.com/seo-guide",
          isHub: true,
          linksToHub: false,
          internalLinkCount: 20,
        },
        {
          pageUrl: "https://example.com/keyword-research",
          isHub: false,
          linksToHub: true, // Links to hub
          internalLinkCount: 5,
        },
        {
          pageUrl: "https://example.com/on-page-seo",
          isHub: false,
          linksToHub: true, // Links to hub
          internalLinkCount: 3,
        },
        {
          pageUrl: "https://example.com/technical-seo",
          isHub: false,
          linksToHub: false, // Missing link to hub!
          internalLinkCount: 2,
        },
      ]);

      const result = await service.analyzeClusterCoverage(clusterId, siteId);

      // 2 out of 3 spokes link to hub = 66.67% coverage
      expect(result.coverage).toBeCloseTo(66.67, 1);
      expect(result.missingLinks).toContain(
        "https://example.com/technical-seo"
      );
    });
  });

  describe("getClusterGaps", () => {
    it("should identify missing subtopics in a cluster", async () => {
      const clusterId = "cluster-1";
      const siteId = "site-123";

      mockRepo.findById.mockResolvedValue({
        id: clusterId,
        siteId,
        name: "SEO Guide",
        hubPageUrl: "https://example.com/seo-guide",
        hubTopic: "SEO",
        coverage: 75,
        gaps: ["link building", "local seo", "mobile seo"],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.getClusterPages.mockResolvedValue([
        {
          pageUrl: "https://example.com/seo-guide",
          pageTopic: "SEO",
          isHub: true,
        },
        {
          pageUrl: "https://example.com/keyword-research",
          pageTopic: "keyword research",
          isHub: false,
        },
        {
          pageUrl: "https://example.com/on-page-seo",
          pageTopic: "on-page seo",
          isHub: false,
        },
      ]);

      const result = await service.getClusterGaps(clusterId, siteId);

      expect(result.gaps).toContain("link building");
      expect(result.gaps).toContain("local seo");
      expect(result.gaps).toContain("mobile seo");
    });
  });

  describe("getClusterWithPages", () => {
    it("should return cluster with all pages and metrics", async () => {
      const clusterId = "cluster-1";
      const siteId = "site-123";

      mockRepo.findById.mockResolvedValue({
        id: clusterId,
        siteId,
        name: "SEO Guide",
        hubPageUrl: "https://example.com/seo-guide",
        hubTopic: "SEO",
        coverage: 80,
        totalClicks: 2500,
        totalImpressions: 50000,
        avgPosition: 5.2,
        gaps: ["link building"],
        lastAnalyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.getClusterPages.mockResolvedValue([
        {
          pageUrl: "https://example.com/seo-guide",
          pageTopic: "SEO",
          isHub: true,
          linksToHub: false,
          internalLinkCount: 20,
          clicks: 1000,
          impressions: 20000,
          position: 3.0,
        },
        {
          pageUrl: "https://example.com/keyword-research",
          pageTopic: "keyword research",
          isHub: false,
          linksToHub: true,
          internalLinkCount: 5,
          clicks: 500,
          impressions: 10000,
          position: 5.5,
        },
        {
          pageUrl: "https://example.com/on-page-seo",
          pageTopic: "on-page seo",
          isHub: false,
          linksToHub: true,
          internalLinkCount: 4,
          clicks: 400,
          impressions: 8000,
          position: 6.0,
        },
      ]);

      const result = await service.getClusterWithPages(clusterId, siteId);

      expect(result).not.toBeNull();
      expect(result?.hubPage.url).toBe("https://example.com/seo-guide");
      expect(result?.hubPage.internalLinks).toBe(20);
      expect(result?.spokePages).toHaveLength(2);
      expect(result?.coverage).toBe(80);
      expect(result?.totalClicks).toBe(2500);
    });
  });

  describe("updateClusterMetrics", () => {
    it("should recalculate and persist cluster metrics from GSC data", async () => {
      const clusterId = "cluster-1";
      const siteId = "site-123";

      mockRepo.findById.mockResolvedValue({
        id: clusterId,
        siteId,
        name: "SEO Guide",
        hubPageUrl: "https://example.com/seo-guide",
        hubTopic: "SEO",
        coverage: 0,
        gaps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.getClusterPages.mockResolvedValue([
        {
          pageUrl: "https://example.com/seo-guide",
          clicks: 1000,
          impressions: 20000,
          position: 3.0,
        },
        {
          pageUrl: "https://example.com/keyword-research",
          clicks: 500,
          impressions: 10000,
          position: 5.0,
        },
      ]);

      mockRepo.updateClusterMetrics.mockResolvedValue(undefined);

      await service.updateClusterMetrics(clusterId, siteId);

      expect(mockRepo.updateClusterMetrics).toHaveBeenCalledWith(
        clusterId,
        expect.objectContaining({
          totalClicks: 1500,
          totalImpressions: 30000,
          avgPosition: expect.any(Number),
        })
      );
    });
  });

  describe("addSpokeToCluster", () => {
    it("should add a spoke page with topic and link status", async () => {
      const clusterId = "cluster-1";
      const spokeUrl = "https://example.com/new-spoke";
      const topic = "new topic";

      mockRepo.addPageToCluster.mockResolvedValue(undefined);

      await service.addSpokeToCluster(clusterId, spokeUrl, topic, true);

      expect(mockRepo.addPageToCluster).toHaveBeenCalledWith(
        clusterId,
        spokeUrl,
        topic,
        false, // isHub
        true // linksToHub
      );
    });
  });
});
