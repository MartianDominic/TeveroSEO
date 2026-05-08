/**
 * ContentGroupService Tests
 * Phase 96-04: Content Groups with Auto-Grouping
 *
 * TDD RED phase: Tests written first
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentGroupService } from "./ContentGroupService";

// Mock repository instance methods
const mockRepo = {
  findBySiteId: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getGroupPages: vi.fn(),
  addPageToGroup: vi.fn(),
  removePageFromGroup: vi.fn(),
  clearGroupPages: vi.fn(),
  getDistinctFolders: vi.fn(),
  getPagesMatchingFolder: vi.fn(),
  getPagesMatchingRegex: vi.fn(),
  getGroupMetrics: vi.fn(),
};

// Mock the repository
vi.mock("../repositories/ContentGroupRepository", () => ({
  ContentGroupRepository: class {
    findBySiteId = mockRepo.findBySiteId;
    findById = mockRepo.findById;
    create = mockRepo.create;
    update = mockRepo.update;
    delete = mockRepo.delete;
    getGroupPages = mockRepo.getGroupPages;
    addPageToGroup = mockRepo.addPageToGroup;
    removePageFromGroup = mockRepo.removePageFromGroup;
    clearGroupPages = mockRepo.clearGroupPages;
    getDistinctFolders = mockRepo.getDistinctFolders;
    getPagesMatchingFolder = mockRepo.getPagesMatchingFolder;
    getPagesMatchingRegex = mockRepo.getPagesMatchingRegex;
    getGroupMetrics = mockRepo.getGroupMetrics;
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

describe("ContentGroupService", () => {
  let service: ContentGroupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContentGroupService();
  });

  describe("autoGenerateGroups", () => {
    it("should detect /blog/, /products/, /services/ folder patterns", async () => {
      const siteId = "site-123";

      // Mock distinct folders found in pages
      mockRepo.getDistinctFolders.mockResolvedValue([
        { folder: "/blog/", pageCount: 25 },
        { folder: "/products/", pageCount: 50 },
        { folder: "/services/", pageCount: 10 },
      ]);

      // Mock no existing groups
      mockRepo.findBySiteId.mockResolvedValue([]);

      // Mock group creation
      mockRepo.create.mockImplementation((data: any) =>
        Promise.resolve({
          id: `group-${data.name}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      mockRepo.getGroupPages.mockResolvedValue([]);
      mockRepo.getPagesMatchingFolder.mockResolvedValue([]);
      mockRepo.clearGroupPages.mockResolvedValue(undefined);
      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 100,
        totalImpressions: 1000,
        avgPosition: 5,
        prevClicks: 90,
        prevImpressions: 900,
      });
      mockRepo.findById.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          siteId,
          name: id.replace("group-", ""),
          matchType: "folder",
          matchPattern: `/${id.replace("group-", "").toLowerCase()}/`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const result = await service.autoGenerateGroups(siteId);

      expect(result.created).toHaveLength(3);
      expect(result.created.map((g) => g.matchPattern)).toEqual(
        expect.arrayContaining(["/blog/", "/products/", "/services/"])
      );
    });

    it("should skip folders with <3 pages", async () => {
      const siteId = "site-123";

      // getDistinctFolders already filters by minPages=3, so /tiny/ won't be returned
      mockRepo.getDistinctFolders.mockResolvedValue([
        { folder: "/blog/", pageCount: 25 },
        // /tiny/ with pageCount 2 would NOT be returned by the repository
      ]);

      mockRepo.findBySiteId.mockResolvedValue([]);
      mockRepo.create.mockImplementation((data: any) =>
        Promise.resolve({
          id: `group-${data.name}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
      mockRepo.getGroupPages.mockResolvedValue([]);
      mockRepo.getPagesMatchingFolder.mockResolvedValue([]);
      mockRepo.clearGroupPages.mockResolvedValue(undefined);
      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 100,
        totalImpressions: 1000,
        avgPosition: 5,
        prevClicks: 90,
        prevImpressions: 900,
      });
      mockRepo.findById.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          siteId,
          name: "Blog",
          matchType: "folder",
          matchPattern: "/blog/",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const result = await service.autoGenerateGroups(siteId);

      // Only blog should be created (tiny has <3 pages)
      expect(result.created).toHaveLength(1);
      expect(result.created[0].matchPattern).toBe("/blog/");
    });
  });

  describe("createGroup", () => {
    it("should auto-populate pages matching folder pattern", async () => {
      const siteId = "site-123";
      const input = {
        name: "Blog Posts",
        matchType: "folder" as const,
        matchPattern: "/blog/",
      };

      mockRepo.create.mockResolvedValue({
        id: "group-1",
        siteId,
        ...input,
        isAutoGenerated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock page population - clearGroupPages and addPageToGroup will be called
      mockRepo.clearGroupPages.mockResolvedValue(undefined);
      mockRepo.addPageToGroup.mockResolvedValue(undefined);
      mockRepo.getPagesMatchingFolder.mockResolvedValue([
        "https://example.com/blog/post-1",
        "https://example.com/blog/post-2",
      ]);
      mockRepo.getGroupPages.mockResolvedValue([
        { pageUrl: "https://example.com/blog/post-1", manuallyAdded: false },
        { pageUrl: "https://example.com/blog/post-2", manuallyAdded: false },
      ]);
      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 100,
        totalImpressions: 1000,
        avgPosition: 5,
        prevClicks: 90,
        prevImpressions: 900,
      });
      mockRepo.findById.mockResolvedValue({
        id: "group-1",
        siteId,
        ...input,
        isAutoGenerated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createGroup(siteId, input);

      expect(result).not.toBeNull();
      expect(result?.matchType).toBe("folder");
      expect(result?.matchPattern).toBe("/blog/");
      expect(mockRepo.clearGroupPages).toHaveBeenCalledWith("group-1", true);
    });

    it("should apply regex pattern to populate pages", async () => {
      const siteId = "site-123";
      const input = {
        name: "Product Pages",
        matchType: "regex" as const,
        matchPattern: "^/products/[a-z]+$",
      };

      mockRepo.create.mockResolvedValue({
        id: "group-2",
        siteId,
        ...input,
        isAutoGenerated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.clearGroupPages.mockResolvedValue(undefined);
      mockRepo.addPageToGroup.mockResolvedValue(undefined);
      mockRepo.getPagesMatchingRegex.mockResolvedValue([
        "https://example.com/products/shoes",
      ]);
      mockRepo.getGroupPages.mockResolvedValue([
        { pageUrl: "https://example.com/products/shoes", manuallyAdded: false },
      ]);
      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 100,
        totalImpressions: 1000,
        avgPosition: 5,
        prevClicks: 90,
        prevImpressions: 900,
      });
      mockRepo.findById.mockResolvedValue({
        id: "group-2",
        siteId,
        ...input,
        isAutoGenerated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createGroup(siteId, input);

      expect(result).not.toBeNull();
      expect(result?.matchType).toBe("regex");
    });
  });

  describe("addPageToGroup", () => {
    it("should add page with manually_added=true", async () => {
      const groupId = "group-1";
      const pageUrl = "https://example.com/custom-page";

      mockRepo.addPageToGroup.mockResolvedValue(undefined);

      await service.addPageToGroup(groupId, pageUrl);

      expect(mockRepo.addPageToGroup).toHaveBeenCalledWith(
        groupId,
        pageUrl,
        true
      );
    });
  });

  describe("getGroupMetrics", () => {
    it("should return aggregated clicks/impressions/position from GSC data", async () => {
      const groupId = "group-1";
      const siteId = "site-123";

      mockRepo.findById.mockResolvedValue({
        id: groupId,
        siteId,
        name: "Blog",
        matchType: "folder",
        matchPattern: "/blog/",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.getGroupPages.mockResolvedValue([
        { pageUrl: "https://example.com/blog/post-1", manuallyAdded: false },
        { pageUrl: "https://example.com/blog/post-2", manuallyAdded: false },
      ]);

      // Mock the repository getGroupMetrics
      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 1500,
        totalImpressions: 50000,
        avgPosition: 8.5,
        prevClicks: 1200,
        prevImpressions: 45000,
      });

      const result = await service.getGroupWithMetrics(groupId, siteId);

      expect(result).not.toBeNull();
      expect(result?.metrics.totalClicks).toBe(1500);
      expect(result?.metrics.totalImpressions).toBe(50000);
      expect(result?.metrics.avgPosition).toBe(8.5);
      expect(result?.metrics.clicksChange).toBeCloseTo(25); // (1500-1200)/1200 * 100
    });
  });

  describe("overlapping patterns", () => {
    it("should correctly assign pages to most specific match", async () => {
      const siteId = "site-123";

      // Group 1: /blog/ (broader)
      // Group 2: /blog/tutorials/ (more specific)
      mockRepo.findBySiteId.mockResolvedValue([
        {
          id: "group-1",
          siteId,
          name: "Blog",
          matchType: "folder",
          matchPattern: "/blog/",
        },
        {
          id: "group-2",
          siteId,
          name: "Tutorials",
          matchType: "folder",
          matchPattern: "/blog/tutorials/",
        },
      ]);

      mockRepo.getGroupPages.mockImplementation((groupId: string) => {
        if (groupId === "group-2") {
          // More specific group should have tutorial pages
          return Promise.resolve([
            {
              pageUrl: "https://example.com/blog/tutorials/lesson-1",
              manuallyAdded: false,
            },
          ]);
        }
        // Broader group should have other blog pages
        return Promise.resolve([
          {
            pageUrl: "https://example.com/blog/news-post",
            manuallyAdded: false,
          },
        ]);
      });

      mockRepo.findById.mockImplementation((id: string) => {
        const groups = {
          "group-1": {
            id: "group-1",
            siteId,
            name: "Blog",
            matchType: "folder",
            matchPattern: "/blog/",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          "group-2": {
            id: "group-2",
            siteId,
            name: "Tutorials",
            matchType: "folder",
            matchPattern: "/blog/tutorials/",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        };
        return Promise.resolve(groups[id as keyof typeof groups]);
      });

      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 100,
        totalImpressions: 1000,
        avgPosition: 5,
        prevClicks: 90,
        prevImpressions: 900,
      });

      const groups = await service.getGroups(siteId);

      expect(groups).toHaveLength(2);
      // Both groups should exist with their respective pages
      const blogGroup = groups.find((g) => g.name === "Blog");
      const tutorialGroup = groups.find((g) => g.name === "Tutorials");
      expect(blogGroup).toBeDefined();
      expect(tutorialGroup).toBeDefined();
    });
  });

  describe("updateGroup", () => {
    it("should re-evaluate and re-populate pages when pattern changes", async () => {
      const groupId = "group-1";
      const siteId = "site-123";
      const newPattern = "/articles/";

      mockRepo.findById.mockResolvedValue({
        id: groupId,
        siteId,
        name: "Blog",
        matchType: "folder",
        matchPattern: "/blog/",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.update.mockResolvedValue({
        id: groupId,
        siteId,
        name: "Blog",
        matchType: "folder",
        matchPattern: newPattern,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepo.clearGroupPages.mockResolvedValue(undefined);
      mockRepo.addPageToGroup.mockResolvedValue(undefined);
      mockRepo.getPagesMatchingFolder.mockResolvedValue([]);
      mockRepo.getGroupPages.mockResolvedValue([]);
      mockRepo.getGroupMetrics.mockResolvedValue({
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: 0,
        prevClicks: 0,
        prevImpressions: 0,
      });

      await service.updateGroup(groupId, siteId, { matchPattern: newPattern });

      // Should clear and re-populate pages
      expect(mockRepo.clearGroupPages).toHaveBeenCalledWith(groupId, true);
    });
  });
});
