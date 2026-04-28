/**
 * Tests for AnalysisService.
 * Phase 26: Prospect Data Model
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the queue module
const mockSubmitProspectAnalysis = vi.fn();
const mockGetWorkspaceAnalysisCountToday = vi.fn();

vi.mock("@/server/queues/prospectAnalysisQueue", () => ({
  submitProspectAnalysis: mockSubmitProspectAnalysis,
  getWorkspaceAnalysisCountToday: mockGetWorkspaceAnalysisCountToday,
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "mock-analysis-id",
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockLimit,
        }),
      }),
    }),
    insert: () => ({
      values: mockValues,
    }),
    update: () => ({
      set: () => ({
        where: mockWhere,
      }),
    }),
  },
}));

describe("AnalysisService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitProspectAnalysis.mockResolvedValue("job-123");
    mockGetWorkspaceAnalysisCountToday.mockResolvedValue(0);
  });

  describe("triggerAnalysis", () => {
    it("should throw RATE_LIMITED when >10 analyses today", async () => {
      mockGetWorkspaceAnalysisCountToday.mockResolvedValue(10);

      const { AnalysisService } = await import("./AnalysisService");

      await expect(
        AnalysisService.triggerAnalysis({
          prospectId: "prospect-123",
          workspaceId: "workspace-456",
          analysisType: "quick_scan",
          triggeredBy: "user-001",
        }),
      ).rejects.toThrow(/daily analysis limit/);
    });

    it("should contain MAX_ANALYSES_PER_DAY = 10", async () => {
      // Import and check the constant exists (it's internal but validates the limit)
      const module = await import("./AnalysisService");
      // The service should enforce 10/day limit
      mockGetWorkspaceAnalysisCountToday.mockResolvedValue(9);

      // Should not throw at 9
      mockLimit.mockResolvedValue([{ id: "prospect-123", domain: "example.com" }]);
      mockValues.mockResolvedValue(undefined);

      const result = await module.AnalysisService.triggerAnalysis({
        prospectId: "prospect-123",
        workspaceId: "workspace-456",
        analysisType: "quick_scan",
        triggeredBy: "user-001",
      });

      expect(result).toBeDefined();
    });
  });

  describe("LOCATION_CODES", () => {
    it("should export location codes for common regions", async () => {
      const { LOCATION_CODES } = await import("./AnalysisService");

      expect(LOCATION_CODES.US).toBe(2840);
      expect(LOCATION_CODES.UK).toBe(2826);
      expect(LOCATION_CODES.DE).toBe(2276);
    });
  });
});
