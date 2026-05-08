/**
 * Tests for ClientVisibilityService
 * Phase 96-05: Client Portal Visibility Controls
 *
 * Tests for visibility filtering (no db mocking needed for pure functions)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientVisibilityService } from "./ClientVisibilityService";
import { DEFAULT_VISIBILITY, type VisibilityConfig } from "@/db/analytics-extended-schema";

// Mock database for constructor injection
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  execute: vi.fn(),
};

describe("ClientVisibilityService", () => {
  let service: ClientVisibilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use direct injection, avoiding the singleton that imports db
    service = new ClientVisibilityService(mockDb as any);
  });

  describe("getVisibilityConfig", () => {
    it("should return default config when no custom config exists", async () => {
      mockDb.where.mockResolvedValueOnce([]);

      const config = await service.getVisibilityConfig("client-123", "workspace-456");

      expect(config).toEqual(DEFAULT_VISIBILITY);
    });

    it("should return stored config when it exists", async () => {
      const customConfig: VisibilityConfig = {
        ...DEFAULT_VISIBILITY,
        showQueries: true,
        canExport: true,
      };
      mockDb.where.mockResolvedValueOnce([{
        id: "config-1",
        clientId: "client-123",
        workspaceId: "workspace-456",
        ...customConfig,
      }]);

      const config = await service.getVisibilityConfig("client-123", "workspace-456");

      expect(config.showQueries).toBe(true);
      expect(config.canExport).toBe(true);
    });
  });

  describe("updateVisibilityConfig", () => {
    it("should upsert config and return updated values", async () => {
      const updates = { showQueries: true, canExport: true };
      mockDb.returning.mockResolvedValueOnce([{
        id: "config-1",
        clientId: "client-123",
        workspaceId: "workspace-456",
        ...DEFAULT_VISIBILITY,
        ...updates,
      }]);

      const result = await service.updateVisibilityConfig(
        "client-123",
        "workspace-456",
        updates
      );

      expect(result.showQueries).toBe(true);
      expect(result.canExport).toBe(true);
    });

    it("should persist changes after update", async () => {
      const updates = { showCompetitors: true };
      mockDb.returning.mockResolvedValueOnce([{
        ...DEFAULT_VISIBILITY,
        ...updates,
      }]);

      const result = await service.updateVisibilityConfig(
        "client-123",
        "workspace-456",
        updates
      );

      expect(result.showCompetitors).toBe(true);
    });
  });

  describe("filterByVisibility", () => {
    it("should remove clicks when showClicks is false", () => {
      const data = { clicks: 100, impressions: 1000, position: 5 };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showClicks: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.clicks).toBeUndefined();
      expect(filtered.impressions).toBe(1000);
      expect(filtered.position).toBe(5);
    });

    it("should remove impressions when showImpressions is false", () => {
      const data = { clicks: 100, impressions: 1000, ctr: 0.1 };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showImpressions: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.impressions).toBeUndefined();
      expect(filtered.clicks).toBe(100);
    });

    it("should remove position when showPosition is false", () => {
      const data = { clicks: 100, position: 5, avgPosition: 3.5 };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showPosition: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.position).toBeUndefined();
      expect(filtered.avgPosition).toBeUndefined();
    });

    it("should remove CTR when showCtr is false", () => {
      const data = { clicks: 100, ctr: 0.1, ctrChange: 0.05 };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showCtr: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.ctr).toBeUndefined();
      expect(filtered.ctrChange).toBeUndefined();
    });

    it("should remove queries when showQueries is false", () => {
      const data = { clicks: 100, query: "test query", queries: ["q1", "q2"], topQueries: ["q3"] };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showQueries: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.query).toBeUndefined();
      expect(filtered.queries).toBeUndefined();
      expect(filtered.topQueries).toBeUndefined();
      expect(filtered.clicks).toBe(100);
    });

    it("should keep queries when showQueries is true", () => {
      const data = { clicks: 100, query: "test query" };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showQueries: true };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.query).toBe("test query");
    });

    it("should handle nested objects", () => {
      const data = {
        metrics: { clicks: 100, impressions: 1000 },
        comparison: { clicksChange: 10, impressionsChange: -5 },
      };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showClicks: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.metrics?.clicks).toBeUndefined();
      expect(filtered.metrics?.impressions).toBe(1000);
      expect(filtered.comparison?.clicksChange).toBeUndefined();
    });

    it("should handle arrays of objects", () => {
      const data = {
        pages: [
          { url: "/page1", clicks: 50 },
          { url: "/page2", clicks: 30 },
        ],
      };
      const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showClicks: false };

      const filtered = service.filterByVisibility(data, config);

      expect(filtered.pages?.[0]?.clicks).toBeUndefined();
      expect(filtered.pages?.[0]?.url).toBe("/page1");
    });
  });

  describe("validateWorkspaceAccess", () => {
    it("should return true when client belongs to workspace", async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const hasAccess = await service.validateWorkspaceAccess("client-123", "workspace-456");

      expect(hasAccess).toBe(true);
    });

    it("should return false when client does not belong to workspace", async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const hasAccess = await service.validateWorkspaceAccess("client-123", "wrong-workspace");

      expect(hasAccess).toBe(false);
    });
  });

  // Note: Singleton tests omitted - they require real db connection
  // Use integration tests for singleton behavior validation
});
