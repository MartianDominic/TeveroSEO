/**
 * Tests for rankingQueue.
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

// Mock BullMQ Queue with hoisted functions
vi.mock("bullmq", async () => {
  const mockAdd = vi.fn().mockResolvedValue({});
  const mockGetRepeatableJobs = vi.fn().mockResolvedValue([]);
  const mockRemoveRepeatableByKey = vi.fn().mockResolvedValue(undefined);

  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockAdd,
      getRepeatableJobs: mockGetRepeatableJobs,
      removeRepeatableByKey: mockRemoveRepeatableByKey,
    })),
    __mockAdd: mockAdd,
    __mockGetRepeatableJobs: mockGetRepeatableJobs,
    __mockRemoveRepeatableByKey: mockRemoveRepeatableByKey,
  };
});

describe("rankingQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RANKING_QUEUE_NAME", () => {
    it("should be 'keyword-ranking'", async () => {
      const { RANKING_QUEUE_NAME } = await import("./rankingQueue");
      expect(RANKING_QUEUE_NAME).toBe("keyword-ranking");
    });
  });

  describe("RankingJobData interface", () => {
    it("should have triggeredAt string field", async () => {
      const { rankingQueue } = await import("./rankingQueue");
      const testData: { triggeredAt: string } = {
        triggeredAt: new Date().toISOString(),
      };
      expect(testData.triggeredAt).toBeDefined();
      expect(rankingQueue).toBeDefined();
    });
  });

  describe("initRankingScheduler", () => {
    it("should create repeatable job at '0 3 * * *' (03:00 UTC daily)", async () => {
      const bullmq = await import("bullmq");
      const mockAdd = (bullmq as unknown as { __mockAdd: ReturnType<typeof vi.fn> }).__mockAdd;
      const mockGetRepeatableJobs = (bullmq as unknown as { __mockGetRepeatableJobs: ReturnType<typeof vi.fn> }).__mockGetRepeatableJobs;
      mockGetRepeatableJobs.mockResolvedValueOnce([]);
      const { initRankingScheduler } = await import("./rankingQueue");

      await initRankingScheduler();

      expect(mockAdd).toHaveBeenCalledWith(
        "check-keyword-rankings",
        expect.objectContaining({ triggeredAt: expect.any(String) }),
        expect.objectContaining({
          repeat: { pattern: "0 3 * * *" },
          jobId: "ranking-check",
        }),
      );
    });

    it("should remove existing repeatable jobs before adding new one", async () => {
      const bullmq = await import("bullmq");
      const mockGetRepeatableJobs = (bullmq as unknown as { __mockGetRepeatableJobs: ReturnType<typeof vi.fn> }).__mockGetRepeatableJobs;
      const mockRemoveRepeatableByKey = (bullmq as unknown as { __mockRemoveRepeatableByKey: ReturnType<typeof vi.fn> }).__mockRemoveRepeatableByKey;
      mockGetRepeatableJobs.mockResolvedValueOnce([{ key: "old-job-key" }]);

      const { initRankingScheduler } = await import("./rankingQueue");
      await initRankingScheduler();

      expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("old-job-key");
    });
  });

  describe("triggerRankingCheck", () => {
    it("should add a manual job", async () => {
      const bullmq = await import("bullmq");
      const mockAdd = (bullmq as unknown as { __mockAdd: ReturnType<typeof vi.fn> }).__mockAdd;
      const { triggerRankingCheck } = await import("./rankingQueue");

      await triggerRankingCheck();

      expect(mockAdd).toHaveBeenCalledWith(
        "check-keyword-rankings",
        expect.objectContaining({ triggeredAt: expect.any(String) }),
        expect.objectContaining({
          jobId: expect.stringMatching(/^manual-ranking-\d+$/),
        }),
      );
    });
  });
});
