/**
 * Tests for Crawl Lane Router
 *
 * Per 64-03-PLAN.md and 64-RESEARCH.md Pattern 2:
 * - Type A (FULL_AUDIT) routes to heavy-crawl queue (auditQueue)
 * - Types B/C/D/E/F route to fast-api queue
 * - Fast-api queue SLA: <1 minute
 * - Heavy-crawl queue SLA: <15 minutes
 *
 * @module crawlLaneRouter.test
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock auditQueue with all necessary exports
vi.mock("./auditQueue", () => ({
  auditQueue: {
    add: vi.fn().mockResolvedValue({ id: "audit-job-1" }),
  },
  AUDIT_QUEUE_NAME: "audit-queue",
  AUDIT_STEP: {
    DISCOVER: "discover",
    CRAWL: "crawl",
    LIGHTHOUSE_SELECT: "lighthouse-select",
    LIGHTHOUSE_RUN: "lighthouse-run",
    FINALIZE: "finalize",
  },
}));

// Mock fastApiQueue (doesn't exist yet - this is RED phase)
vi.mock("./fastApiQueue", () => ({
  fastApiQueue: {
    add: vi.fn().mockResolvedValue({ id: "fast-api-job-1" }),
  },
  FAST_API_QUEUE_NAME: "fast-api",
}));

// Import after mocking
import { routeJob, determineJobType, JobType, type JobTypeValue } from "./crawlLaneRouter";
import { auditQueue } from "./auditQueue";
import { fastApiQueue } from "./fastApiQueue";

describe("crawlLaneRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JobType constants", () => {
    it("defines all expected job types", () => {
      expect(JobType.FULL_AUDIT).toBe("A");
      expect(JobType.COMPETITOR_SNAPSHOT).toBe("B");
      expect(JobType.KEYWORD_GAP).toBe("C");
      expect(JobType.BACKLINK_PROFILE).toBe("D");
      expect(JobType.CONTENT_GAP).toBe("E");
      expect(JobType.LOCAL_SEO).toBe("F");
    });
  });

  describe("determineJobType", () => {
    it("returns valid JobTypeValue for known types", () => {
      expect(determineJobType("A")).toBe("A");
      expect(determineJobType("B")).toBe("B");
      expect(determineJobType("C")).toBe("C");
      expect(determineJobType("D")).toBe("D");
      expect(determineJobType("E")).toBe("E");
      expect(determineJobType("F")).toBe("F");
    });

    it("throws for unknown job types", () => {
      expect(() => determineJobType("X")).toThrow();
      expect(() => determineJobType("")).toThrow();
      expect(() => determineJobType("G")).toThrow();
    });
  });

  describe("routeJob", () => {
    const baseJobData = {
      projectId: "proj-123",
      url: "https://example.com",
      tenantId: "tenant-456",
      payload: {},
    };

    describe("Type A (FULL_AUDIT) - heavy-crawl lane", () => {
      it("routes Type A to auditQueue (heavy-crawl)", async () => {
        const result = await routeJob("A" as JobTypeValue, {
          ...baseJobData,
          config: { maxPages: 500 },
        });

        expect(auditQueue.add).toHaveBeenCalledTimes(1);
        expect(fastApiQueue.add).not.toHaveBeenCalled();
        expect(result.lane).toBe("heavy-crawl");
        expect(result.jobId).toBeDefined();
      });

      it("adds routing metadata to heavy-crawl jobs", async () => {
        await routeJob("A" as JobTypeValue, {
          ...baseJobData,
          config: { maxPages: 100 },
        });

        const addCall = (auditQueue.add as Mock).mock.calls[0];
        const [jobName, jobData] = addCall;

        expect(jobName).toContain("audit");
        expect(jobData.lane).toBe("heavy-crawl");
        expect(jobData.enqueuedAt).toBeDefined();
        expect(jobData.jobType).toBe("A");
      });
    });

    describe("Type B (COMPETITOR_SNAPSHOT) - fast-api lane", () => {
      it("routes Type B to fastApiQueue", async () => {
        const result = await routeJob("B" as JobTypeValue, baseJobData);

        expect(fastApiQueue.add).toHaveBeenCalledTimes(1);
        expect(auditQueue.add).not.toHaveBeenCalled();
        expect(result.lane).toBe("fast-api");
        expect(result.jobId).toBeDefined();
      });
    });

    describe("Types C/D/E/F - fast-api lane", () => {
      it.each([
        ["C", "KEYWORD_GAP"],
        ["D", "BACKLINK_PROFILE"],
        ["E", "CONTENT_GAP"],
        ["F", "LOCAL_SEO"],
      ])("routes Type %s (%s) to fastApiQueue", async (type) => {
        vi.clearAllMocks();

        const result = await routeJob(type as JobTypeValue, baseJobData);

        expect(fastApiQueue.add).toHaveBeenCalledTimes(1);
        expect(auditQueue.add).not.toHaveBeenCalled();
        expect(result.lane).toBe("fast-api");
      });
    });

    describe("routing metadata", () => {
      it("includes lane, enqueuedAt, and jobType in job data", async () => {
        await routeJob("C" as JobTypeValue, baseJobData);

        const addCall = (fastApiQueue.add as Mock).mock.calls[0];
        const [, jobData] = addCall;

        expect(jobData.lane).toBe("fast-api");
        expect(typeof jobData.enqueuedAt).toBe("number");
        expect(jobData.enqueuedAt).toBeGreaterThan(0);
        expect(jobData.jobType).toBe("C");
      });

      it("preserves original job data when routing", async () => {
        const customPayload = { competitorUrls: ["https://competitor.com"] };
        await routeJob("B" as JobTypeValue, {
          ...baseJobData,
          payload: customPayload,
        });

        const addCall = (fastApiQueue.add as Mock).mock.calls[0];
        const [, jobData] = addCall;

        expect(jobData.projectId).toBe("proj-123");
        expect(jobData.url).toBe("https://example.com");
        expect(jobData.tenantId).toBe("tenant-456");
        expect(jobData.payload).toEqual(customPayload);
      });
    });

    describe("error handling", () => {
      it("rejects invalid job types at runtime", async () => {
        // TypeScript would prevent this at compile time, but test runtime behavior
        await expect(routeJob("Z" as JobTypeValue, baseJobData)).rejects.toThrow();
      });
    });
  });
});
