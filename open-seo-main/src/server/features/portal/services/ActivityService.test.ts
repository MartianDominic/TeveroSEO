/**
 * ActivityService tests - Portal activity tracking.
 * Phase 90-01: Trust Foundation
 *
 * Tests activity CRUD operations for client portal.
 * Activities track work done for clients (content, technical, links, etc.).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActivityService } from "./ActivityService";
import type { PortalActivitySelect, PortalActivityInsert } from "@/db";

// Track mock call responses for sequential db calls
let mockCallResponses: unknown[] = [];
let mockCallIndex = 0;

// Mock the database module
vi.mock("@/db", () => {
  const chainMock = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
    groupBy: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
  };

  return {
    db: {
      select: vi.fn().mockReturnValue(chainMock),
      insert: vi.fn().mockReturnValue(chainMock),
    },
    portalActivities: {
      id: Symbol("id"),
      clientId: Symbol("clientId"),
      category: Symbol("category"),
      title: Symbol("title"),
      description: Symbol("description"),
      artifacts: Symbol("artifacts"),
      createdAt: Symbol("createdAt"),
      createdBy: Symbol("createdBy"),
      contractId: Symbol("contractId"),
    },
    ACTIVITY_CATEGORIES: ["content", "technical", "links", "tracking", "analytics", "communication"],
  };
});

// Import mocked module after vi.mock
import { db } from "@/db";

// Helper to set mock responses for sequential db calls
function setMockResponses(...responses: unknown[]) {
  mockCallResponses = responses;
  mockCallIndex = 0;
}

describe("ActivityService", () => {
  const testClientId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallResponses = [];
    mockCallIndex = 0;
  });

  describe("getClientActivities", () => {
    it("returns activities sorted by createdAt desc", async () => {
      const mockActivities: Partial<PortalActivitySelect>[] = [
        {
          id: "activity-1",
          clientId: testClientId,
          category: "content",
          title: "Published blog post",
          description: "Published SEO guide",
          artifacts: [{ label: "Blog post", url: "https://example.com/blog/seo-guide" }],
          createdAt: new Date("2026-05-01"),
        },
        {
          id: "activity-2",
          clientId: testClientId,
          category: "technical",
          title: "Fixed meta tags",
          description: "Updated title tags for 10 pages",
          artifacts: [],
          createdAt: new Date("2026-04-28"),
        },
      ];

      setMockResponses(mockActivities);

      const result = await ActivityService.getClientActivities(testClientId);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Published blog post");
      expect(result[1].title).toBe("Fixed meta tags");
    });

    it("filters by category when provided", async () => {
      const mockActivities: Partial<PortalActivitySelect>[] = [
        {
          id: "activity-1",
          clientId: testClientId,
          category: "content",
          title: "Published blog post",
          createdAt: new Date("2026-05-01"),
        },
      ];

      setMockResponses(mockActivities);

      const result = await ActivityService.getClientActivities(testClientId, {
        category: "content",
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("content");
    });

    it("supports pagination (limit, offset)", async () => {
      const mockActivities: Partial<PortalActivitySelect>[] = [
        {
          id: "activity-3",
          clientId: testClientId,
          category: "links",
          title: "Built 5 backlinks",
          createdAt: new Date("2026-04-25"),
        },
      ];

      setMockResponses(mockActivities);

      const result = await ActivityService.getClientActivities(testClientId, {
        limit: 10,
        offset: 20,
      });

      // Should return results (mock doesn't actually paginate, but API supports it)
      expect(result).toHaveLength(1);
    });
  });

  describe("createActivity", () => {
    it("inserts new activity with all required fields", async () => {
      const newActivity: PortalActivityInsert = {
        clientId: testClientId,
        category: "content",
        title: "Created new landing page",
        description: "Designed and published product landing page",
        artifacts: [{ label: "Landing page", url: "https://example.com/products/new" }],
        createdBy: "user-123",
      };

      const insertedActivity: Partial<PortalActivitySelect> = {
        id: "new-activity-id",
        ...newActivity,
        createdAt: new Date("2026-05-05"),
      };

      setMockResponses([insertedActivity]);

      const result = await ActivityService.createActivity(newActivity);

      expect(result.id).toBe("new-activity-id");
      expect(result.category).toBe("content");
      expect(result.title).toBe("Created new landing page");
      expect(result.artifacts).toHaveLength(1);
    });
  });

  describe("getActivityStats", () => {
    it("returns counts by category for date range", async () => {
      // Mock raw SQL count results
      const mockStatsResult = [
        { category: "content", count: 5 },
        { category: "technical", count: 3 },
        { category: "links", count: 8 },
      ];

      setMockResponses(mockStatsResult);

      const result = await ActivityService.getActivityStats(
        testClientId,
        new Date("2026-04-01"),
        new Date("2026-05-01")
      );

      expect(result).toHaveLength(3);
      expect(result.find((s) => s.category === "content")?.count).toBe(5);
      expect(result.find((s) => s.category === "links")?.count).toBe(8);
    });
  });
});
