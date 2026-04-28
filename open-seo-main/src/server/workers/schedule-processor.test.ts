/**
 * Tests for schedule-processor.
 * TDD RED phase: Write tests first, then implement.
 *
 * Tests:
 * - Processor finds due schedules (nextRun <= now, enabled=true)
 * - Processor calls enqueueReportGeneration for each due schedule
 * - Processor updates lastRun and calculates new nextRun
 * - Processor skips disabled schedules
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";
import type { ScheduleJobData } from "@/server/queues/scheduleQueue";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock the report queue
vi.mock("@/server/queues/reportQueue", () => ({
  enqueueReportGeneration: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("schedule-processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("processScheduleJob", () => {
    it("should find due schedules where nextRun <= now and enabled = true", async () => {
      const { db } = await import("@/db");
      const processScheduleJob = (await import("./schedule-processor")).default;

      const mockSchedules = [
        {
          id: "sched-1",
          clientId: "client-1",
          cronExpression: "0 6 * * 1", // Every Monday 6am
          timezone: "UTC",
          reportType: "monthly-seo",
          locale: "en",
          recipients: ["test@example.com"],
          enabled: true,
          lastRun: null,
          nextRun: new Date("2026-04-19T06:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Setup mock chain
      const mockLimit = vi.fn().mockResolvedValue(mockSchedules);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      // Mock insert for creating report record
      const mockReturning = vi.fn().mockResolvedValue([{ id: "report-1" }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      // Mock update for schedule
      const mockUpdateWhere = vi.fn().mockResolvedValue([{}]);
      const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T06:00:00Z" },
      } as Job<ScheduleJobData>;

      await processScheduleJob(job);

      // Verify db.select was called
      expect(db.select).toHaveBeenCalled();
    });

    it("should call enqueueReportGeneration for each due schedule", async () => {
      const { db } = await import("@/db");
      const { enqueueReportGeneration } = await import(
        "@/server/queues/reportQueue"
      );
      const processScheduleJob = (await import("./schedule-processor")).default;

      const mockSchedules = [
        {
          id: "sched-1",
          clientId: "client-1",
          cronExpression: "0 6 * * 1",
          timezone: "UTC",
          reportType: "monthly-seo",
          locale: "en",
          recipients: ["test@example.com"],
          enabled: true,
          lastRun: null,
          nextRun: new Date("2026-04-19T06:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue(mockSchedules);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const mockReturning = vi.fn().mockResolvedValue([{ id: "report-1" }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const mockUpdateWhere = vi.fn().mockResolvedValue([{}]);
      const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T06:00:00Z" },
      } as Job<ScheduleJobData>;

      await processScheduleJob(job);

      expect(enqueueReportGeneration).toHaveBeenCalledWith(
        "report-1",
        expect.objectContaining({
          clientId: "client-1",
          reportType: "monthly-seo",
          locale: "en",
        }),
      );
    });

    it("should update lastRun and calculate new nextRun", async () => {
      const { db } = await import("@/db");
      const processScheduleJob = (await import("./schedule-processor")).default;

      const mockSchedules = [
        {
          id: "sched-1",
          clientId: "client-1",
          cronExpression: "0 6 * * 1", // Every Monday 6am
          timezone: "UTC",
          reportType: "monthly-seo",
          locale: "en",
          recipients: ["test@example.com"],
          enabled: true,
          lastRun: null,
          nextRun: new Date("2026-04-19T06:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue(mockSchedules);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const mockReturning = vi.fn().mockResolvedValue([{ id: "report-1" }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const mockUpdateWhere = vi.fn().mockResolvedValue([{}]);
      const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T06:00:00Z" },
      } as Job<ScheduleJobData>;

      await processScheduleJob(job);

      // Verify db.update was called with lastRun and nextRun
      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          lastRun: expect.any(Date),
          nextRun: expect.any(Date),
        }),
      );
    });

    it("should skip disabled schedules (not included in query)", async () => {
      const { db } = await import("@/db");
      const { enqueueReportGeneration } = await import(
        "@/server/queues/reportQueue"
      );
      const processScheduleJob = (await import("./schedule-processor")).default;

      // Return empty array (disabled schedules filtered by query)
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T06:00:00Z" },
      } as Job<ScheduleJobData>;

      await processScheduleJob(job);

      // Should not enqueue any reports
      expect(enqueueReportGeneration).not.toHaveBeenCalled();
    });
  });
});
