/**
 * Tests for visibilityMiddleware
 * Phase 96-05: API-layer visibility enforcement
 *
 * TDD RED phase - tests for middleware enforcement
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { visibilityMiddleware, applyVisibilityFilter } from "./visibilityMiddleware";
import { DEFAULT_VISIBILITY, type VisibilityConfig } from "@/db/analytics-extended-schema";

// Mock ClientVisibilityService - async getter
vi.mock("../services/ClientVisibilityService", () => {
  const mockConfig = {
    showClicks: true,
    showImpressions: true,
    showPosition: true,
    showCtr: true,
    showQueries: false,
    showPages: true,
    showCompetitors: false,
    canViewGrowing: true,
    canViewDecaying: true,
    canViewCannibalization: false,
    canExport: false,
  };

  return {
    getClientVisibilityService: vi.fn().mockResolvedValue({
      getVisibilityConfig: vi.fn().mockResolvedValue(mockConfig),
      validateWorkspaceAccess: vi.fn().mockResolvedValue(true),
      filterByVisibility: vi.fn((data: unknown, config: Record<string, boolean>) => {
        // Simple implementation for testing
        if (data === null || data === undefined) return data;
        const result = { ...(data as Record<string, unknown>) };
        if (!config.showClicks) delete result.clicks;
        if (!config.showQueries) delete result.query;
        // Recursively handle nested objects
        for (const key of Object.keys(result)) {
          if (result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
            const nested = { ...(result[key] as Record<string, unknown>) };
            if (!config.showClicks) delete nested.clicks;
            result[key] = nested;
          }
        }
        return result;
      }),
    }),
    getClientVisibilityServiceSync: vi.fn(),
  };
});

describe("visibilityMiddleware", () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      params: { clientId: "client-123" },
      body: {},
      headers: new Map([["x-workspace-id", "workspace-456"]]),
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe("middleware creation", () => {
    it("should return a middleware function", () => {
      const middleware = visibilityMiddleware();
      expect(typeof middleware).toBe("function");
    });
  });

  describe("workspace validation", () => {
    it("should return 403 for wrong workspace", async () => {
      const { getClientVisibilityService } = await import("../services/ClientVisibilityService");
      const mockService = {
        getVisibilityConfig: vi.fn().mockResolvedValue(DEFAULT_VISIBILITY),
        validateWorkspaceAccess: vi.fn().mockResolvedValue(false),
        filterByVisibility: vi.fn((data) => data),
      };
      vi.mocked(getClientVisibilityService).mockResolvedValueOnce(mockService as any);

      const middleware = visibilityMiddleware();
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "ACCESS_DENIED",
        message: "Client not in your workspace",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next() for valid workspace", async () => {
      const middleware = visibilityMiddleware();
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("config attachment", () => {
    it("should attach visibility config to request", async () => {
      const middleware = visibilityMiddleware();
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.visibilityConfig).toBeDefined();
      expect(mockRequest.visibilityConfig).toEqual(DEFAULT_VISIBILITY);
    });
  });

  describe("response filtering", () => {
    it("should wrap res.json to filter response", async () => {
      const middleware = visibilityMiddleware();
      const originalJson = mockResponse.json;

      await middleware(mockRequest, mockResponse, mockNext);

      // json should be wrapped
      expect(mockResponse.json).not.toBe(originalJson);
    });
  });
});

describe("applyVisibilityFilter", () => {
  it("should filter data based on visibility config", async () => {
    const data = { clicks: 100, query: "test", impressions: 1000 };
    const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showClicks: false };

    const filtered = await applyVisibilityFilter(data, config);

    expect(filtered.clicks).toBeUndefined();
    expect(filtered.impressions).toBe(1000);
  });

  it("should handle null data gracefully", async () => {
    const filtered = await applyVisibilityFilter(null, DEFAULT_VISIBILITY);
    expect(filtered).toBeNull();
  });

  it("should handle undefined data gracefully", async () => {
    const filtered = await applyVisibilityFilter(undefined, DEFAULT_VISIBILITY);
    expect(filtered).toBeUndefined();
  });

  it("should preserve non-metric fields", async () => {
    const data = { success: true, data: { clicks: 100 }, error: null };
    const config: VisibilityConfig = { ...DEFAULT_VISIBILITY, showClicks: false };

    const filtered = await applyVisibilityFilter(data, config);

    expect(filtered.success).toBe(true);
    expect(filtered.error).toBeNull();
    expect(filtered.data?.clicks).toBeUndefined();
  });
});
