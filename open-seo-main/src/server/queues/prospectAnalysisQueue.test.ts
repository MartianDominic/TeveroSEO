/**
 * Tests for prospect analysis queue definition.
 * Phase 26: Prospect Data Model
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis connection
vi.mock("@/server/lib/redis", () => ({
  getSharedBullMQConnection: vi.fn().mockReturnValue({}),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock database for getWorkspaceAnalysisCountToday
const mockDbSelect = vi.fn();
vi.mock("@/db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: mockDbSelect,
        }),
      }),
    }),
  },
}));

// Mock prospect schema
vi.mock("@/db/prospect-schema", () => ({
  prospectAnalyses: { prospectId: "prospectId", createdAt: "createdAt" },
  prospects: { id: "id", workspaceId: "workspaceId" },
}));

// Mock BullMQ Queue with hoisted functions
vi.mock("bullmq", async () => {
  const mockAdd = vi.fn().mockResolvedValue({});

  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockAdd,
    })),
    __mockAdd: mockAdd,
  };
});

describe("prospectAnalysisQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("queue name", () => {
    it("should use correct queue name 'prospect-analysis'", async () => {
      const { PROSPECT_ANALYSIS_QUEUE_NAME } = await import("./prospectAnalysisQueue");
      expect(PROSPECT_ANALYSIS_QUEUE_NAME).toBe("prospect-analysis");
    });
  });

  describe("ProspectAnalysisJobData interface", () => {
    it("should include prospectId, workspaceId, and analysisType", async () => {
      // Import module to verify types compile
      await import("./prospectAnalysisQueue");

      const jobData: import("./prospectAnalysisQueue").ProspectAnalysisJobData = {
        prospectId: "prospect-123",
        workspaceId: "workspace-456",
        analysisType: "quick_scan",
        analysisId: "analysis-789",
        triggeredAt: new Date().toISOString(),
        triggeredBy: "user-001",
      };

      expect(jobData.prospectId).toBe("prospect-123");
      expect(jobData.workspaceId).toBe("workspace-456");
      expect(jobData.analysisType).toBe("quick_scan");
      expect(jobData.analysisId).toBe("analysis-789");
    });

    it("should support all analysis types", async () => {
      type ProspectAnalysisType = import("./prospectAnalysisQueue").ProspectAnalysisType;
      const types: ProspectAnalysisType[] = [
        "quick_scan",
        "deep_dive",
        "opportunity_discovery",
      ];

      for (const type of types) {
        const jobData: import("./prospectAnalysisQueue").ProspectAnalysisJobData = {
          prospectId: "prospect-123",
          workspaceId: "workspace-456",
          analysisType: type,
          analysisId: "analysis-789",
          triggeredAt: new Date().toISOString(),
          triggeredBy: "user-001",
        };
        expect(jobData.analysisType).toBe(type);
      }
    });

    it("should allow optional targetRegion and targetLanguage", async () => {
      const jobData: import("./prospectAnalysisQueue").ProspectAnalysisJobData = {
        prospectId: "prospect-123",
        workspaceId: "workspace-456",
        analysisType: "quick_scan",
        analysisId: "analysis-789",
        targetRegion: "US",
        targetLanguage: "en",
        triggeredAt: new Date().toISOString(),
        triggeredBy: "user-001",
      };

      expect(jobData.targetRegion).toBe("US");
      expect(jobData.targetLanguage).toBe("en");
    });
  });

  describe("ProspectAnalysisDLQJobData interface", () => {
    it("should include error information and original job data", async () => {
      type ProspectAnalysisJobData = import("./prospectAnalysisQueue").ProspectAnalysisJobData;
      type ProspectAnalysisDLQJobData = import("./prospectAnalysisQueue").ProspectAnalysisDLQJobData;

      const originalData: ProspectAnalysisJobData = {
        prospectId: "prospect-123",
        workspaceId: "workspace-456",
        analysisType: "deep_dive",
        analysisId: "analysis-789",
        triggeredAt: new Date().toISOString(),
        triggeredBy: "user-001",
      };

      const dlqData: ProspectAnalysisDLQJobData = {
        originalJobId: "job-001",
        originalJobName: "analyze-prospect",
        data: originalData,
        error: "DataForSEO API timeout",
        stack: "Error: DataForSEO API timeout\n    at ...",
        failedAt: new Date().toISOString(),
        attemptsMade: 3,
      };

      expect(dlqData.originalJobId).toBe("job-001");
      expect(dlqData.data.prospectId).toBe("prospect-123");
      expect(dlqData.error).toBe("DataForSEO API timeout");
      expect(dlqData.attemptsMade).toBe(3);
    });
  });

  describe("submitProspectAnalysis", () => {
    it("should add job to queue with unique job ID", async () => {
      const bullmq = await import("bullmq");
      const mockAdd = (bullmq as unknown as { __mockAdd: ReturnType<typeof vi.fn> }).__mockAdd;
      const { submitProspectAnalysis } = await import("./prospectAnalysisQueue");

      const jobData: import("./prospectAnalysisQueue").ProspectAnalysisJobData = {
        prospectId: "prospect-123",
        workspaceId: "workspace-456",
        analysisType: "quick_scan",
        analysisId: "analysis-789",
        triggeredAt: new Date().toISOString(),
        triggeredBy: "user-001",
      };

      const jobId = await submitProspectAnalysis(jobData);

      expect(mockAdd).toHaveBeenCalledWith(
        "analyze-prospect",
        jobData,
        expect.objectContaining({
          jobId: expect.stringMatching(/^prospect-prospect-123-\d+$/),
        }),
      );
      expect(jobId).toMatch(/^prospect-prospect-123-\d+$/);
    });
  });

  describe("getWorkspaceAnalysisCountToday", () => {
    it("should count analyses from database for workspace today", async () => {
      // Mock database to return count of 4 analyses
      mockDbSelect.mockResolvedValueOnce([{ count: 4 }]);

      const { getWorkspaceAnalysisCountToday } = await import("./prospectAnalysisQueue");
      const count = await getWorkspaceAnalysisCountToday("ws-123");

      expect(count).toBe(4);
      expect(mockDbSelect).toHaveBeenCalled();
    });

    it("should return 0 when no analyses found", async () => {
      // Mock database to return empty result
      mockDbSelect.mockResolvedValueOnce([{ count: 0 }]);

      const { getWorkspaceAnalysisCountToday } = await import("./prospectAnalysisQueue");
      const count = await getWorkspaceAnalysisCountToday("ws-empty");

      expect(count).toBe(0);
    });

    it("should handle null result gracefully", async () => {
      // Mock database to return undefined
      mockDbSelect.mockResolvedValueOnce([]);

      const { getWorkspaceAnalysisCountToday } = await import("./prospectAnalysisQueue");
      const count = await getWorkspaceAnalysisCountToday("ws-null");

      expect(count).toBe(0);
    });
  });
});
