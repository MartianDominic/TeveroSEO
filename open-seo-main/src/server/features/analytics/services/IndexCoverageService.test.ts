/**
 * IndexCoverageService Tests
 * Phase 96-04: URL Inspection + Index Coverage
 *
 * TDD RED phase: Tests written first
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IndexCoverageService } from "./IndexCoverageService";

// Mock repository instance methods
const mockRepo = {
  findBySiteId: vi.fn(),
  findByUrl: vi.fn(),
  upsert: vi.fn(),
  getStats: vi.fn(),
  getPendingRequests: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  getQuotaUsage: vi.fn(),
  getHighPriorityUrls: vi.fn(),
  batchUpsert: vi.fn(),
};

// Mock the repository
vi.mock("../repositories/IndexCoverageRepository", () => ({
  IndexCoverageRepository: class {
    findBySiteId = mockRepo.findBySiteId;
    findByUrl = mockRepo.findByUrl;
    upsert = mockRepo.upsert;
    getStats = mockRepo.getStats;
    getPendingRequests = mockRepo.getPendingRequests;
    createRequest = mockRepo.createRequest;
    updateRequest = mockRepo.updateRequest;
    getQuotaUsage = mockRepo.getQuotaUsage;
    getHighPriorityUrls = mockRepo.getHighPriorityUrls;
    batchUpsert = mockRepo.batchUpsert;
  },
}));

// Mock GSC URL Inspection client
const mockGscClient = {
  inspectUrl: vi.fn(),
  submitIndexRequest: vi.fn(),
};

vi.mock("../clients/GscUrlInspectionClient", () => ({
  GscUrlInspectionClient: class {
    inspectUrl = mockGscClient.inspectUrl;
    submitIndexRequest = mockGscClient.submitIndexRequest;
  },
}));

describe("IndexCoverageService", () => {
  let service: IndexCoverageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IndexCoverageService();
  });

  describe("inspectUrl", () => {
    it("should call GSC URL Inspection API and store result", async () => {
      const siteId = "site-123";
      const siteUrl = "https://example.com";
      const pageUrl = "https://example.com/blog/post-1";

      const mockInspectionResult = {
        inspectionResult: {
          inspectionResultLink: "https://search.google.com/search-console/...",
          indexStatusResult: {
            coverageState: "Submitted and indexed",
            indexingState: "INDEXING_ALLOWED",
            lastCrawlTime: "2024-01-15T10:30:00Z",
            crawledAs: "DESKTOP",
            robotsTxtState: "ALLOWED",
            pageFetchState: "SUCCESSFUL",
          },
          mobileUsabilityResult: {
            verdict: "PASS",
          },
          richResultsResult: {
            detectedItems: [{ richResultType: "Article" }],
          },
        },
      };

      mockGscClient.inspectUrl.mockResolvedValue(mockInspectionResult);
      mockRepo.upsert.mockResolvedValue(undefined);

      const result = await service.inspectUrl(siteId, siteUrl, pageUrl);

      expect(mockGscClient.inspectUrl).toHaveBeenCalledWith(siteUrl, pageUrl);
      expect(mockRepo.upsert).toHaveBeenCalled();
      expect(result.coverageState).toBe("Submitted and indexed");
      expect(result.indexingState).toBe("INDEXING_ALLOWED");
    });

    it("should handle quota exceeded gracefully", async () => {
      const siteId = "site-123";
      const siteUrl = "https://example.com";
      const pageUrl = "https://example.com/blog/post-1";

      mockGscClient.inspectUrl.mockRejectedValue(
        new Error("Quota exceeded: 2000 inspections per day")
      );

      await expect(
        service.inspectUrl(siteId, siteUrl, pageUrl)
      ).rejects.toThrow("Quota exceeded");
    });
  });

  describe("getIndexCoverageStats", () => {
    it("should return aggregated stats by coverage state", async () => {
      const siteId = "site-123";

      mockRepo.getStats.mockResolvedValue({
        total: 500,
        indexed: 450,
        notIndexed: 50,
        byState: {
          "Submitted and indexed": 400,
          "Crawled - currently not indexed": 30,
          "Discovered - currently not indexed": 15,
          "Blocked by robots.txt": 5,
        },
        lastUpdated: new Date(),
      });

      const result = await service.getIndexCoverageStats(siteId);

      expect(result.total).toBe(500);
      expect(result.indexed).toBe(450);
      expect(result.notIndexed).toBe(50);
      expect(result.byState["Submitted and indexed"]).toBe(400);
    });
  });

  describe("requestIndexing", () => {
    it("should submit URL for indexing via GSC API", async () => {
      const siteId = "site-123";
      const pageUrl = "https://example.com/new-page";

      mockGscClient.submitIndexRequest.mockResolvedValue({
        urlNotificationMetadata: {
          url: pageUrl,
          latestUpdate: {
            type: "URL_UPDATED",
            notifyTime: "2024-01-15T10:30:00Z",
          },
        },
      });
      mockRepo.createRequest.mockResolvedValue({ id: "req-1" });
      mockRepo.updateRequest.mockResolvedValue(undefined);

      const result = await service.requestIndexing(siteId, pageUrl, "URL_UPDATED");

      expect(mockGscClient.submitIndexRequest).toHaveBeenCalledWith(
        pageUrl,
        "URL_UPDATED"
      );
      expect(result.success).toBe(true);
    });

    it("should queue request if quota exceeded", async () => {
      const siteId = "site-123";
      const pageUrl = "https://example.com/new-page";

      mockGscClient.submitIndexRequest.mockRejectedValue(
        new Error("Quota exceeded")
      );
      mockRepo.createRequest.mockResolvedValue({ id: "req-1" });
      mockRepo.updateRequest.mockResolvedValue(undefined);

      const result = await service.requestIndexing(siteId, pageUrl, "URL_UPDATED");

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
    });
  });

  describe("getPriorityUrls", () => {
    it("should return URLs prioritized for inspection", async () => {
      const siteId = "site-123";

      mockRepo.getHighPriorityUrls.mockResolvedValue([
        {
          pageUrl: "https://example.com/new-content",
          priority: 100,
          reason: "new_content",
        },
        {
          pageUrl: "https://example.com/decaying-page",
          priority: 80,
          reason: "decaying",
        },
        {
          pageUrl: "https://example.com/high-value",
          priority: 60,
          reason: "high_value",
        },
      ]);

      const result = await service.getPriorityUrls(siteId, 10);

      expect(result).toHaveLength(3);
      expect(result[0].reason).toBe("new_content");
      expect(result[0].priority).toBe(100);
    });
  });

  describe("batchInspect", () => {
    it("should inspect multiple URLs respecting daily quota", async () => {
      const siteId = "site-123";
      const siteUrl = "https://example.com";
      const urls = [
        "https://example.com/page-1",
        "https://example.com/page-2",
        "https://example.com/page-3",
      ];

      mockRepo.getQuotaUsage.mockResolvedValue({
        inspectionsUsed: 1990,
        inspectionsLimit: 2000,
        indexingRequestsUsed: 50,
        indexingRequestsLimit: 200,
        resetsAt: new Date(Date.now() + 86400000),
      });

      // Only 10 inspections remaining, should process only 3 URLs
      const mockResult = {
        inspectionResult: {
          indexStatusResult: {
            coverageState: "Submitted and indexed",
            indexingState: "INDEXING_ALLOWED",
          },
        },
      };
      mockGscClient.inspectUrl.mockResolvedValue(mockResult);
      mockRepo.upsert.mockResolvedValue(undefined);

      const result = await service.batchInspect(siteId, siteUrl, urls);

      expect(result.processed).toBe(3);
      expect(result.remaining).toBe(0);
    });
  });

  describe("getQuota", () => {
    it("should return current quota usage and limits", async () => {
      const siteId = "site-123";
      const resetDate = new Date(Date.now() + 86400000);

      mockRepo.getQuotaUsage.mockResolvedValue({
        inspectionsUsed: 500,
        inspectionsLimit: 2000,
        indexingRequestsUsed: 50,
        indexingRequestsLimit: 200,
        resetsAt: resetDate,
      });

      const result = await service.getQuota(siteId);

      expect(result.inspectionsUsed).toBe(500);
      expect(result.inspectionsLimit).toBe(2000);
      expect(result.indexingRequestsUsed).toBe(50);
      expect(result.indexingRequestsLimit).toBe(200);
    });
  });
});
