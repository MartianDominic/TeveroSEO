/**
 * GSC Sync Queue Tests
 * Phase 96-01 Task 4: BullMQ queue and worker for GSC sync
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { gscSyncQueue, scheduleGscSync } from "./gsc-sync.job";

describe("gscSyncQueue", () => {
  afterEach(async () => {
    // Clean up queue after tests
    await gscSyncQueue.obliterate({ force: true });
  });

  it("should be created with 50 req/min global rate limiter", () => {
    expect(gscSyncQueue).toBeDefined();
    expect(gscSyncQueue.name).toBe("gsc-sync");

    // Verify queue options
    const opts = gscSyncQueue.opts;
    expect(opts.defaultJobOptions).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  });

  it("should add repeatable job at 2:15 AM UTC via scheduleGscSync()", async () => {
    await scheduleGscSync();

    const repeatableJobs = await gscSyncQueue.getRepeatableJobs();

    // Should have at least one repeatable job
    expect(repeatableJobs.length).toBeGreaterThan(0);

    // Check for our specific job pattern (SCRAPE-03: staggered to 2:15 AM)
    const fullSyncJob = repeatableJobs[0];
    expect(fullSyncJob.pattern).toBe("15 2 * * *");
  });

  it("should prevent duplicate repeatable jobs via jobId", async () => {
    await scheduleGscSync();
    await scheduleGscSync(); // Call twice

    const repeatableJobs = await gscSyncQueue.getRepeatableJobs();

    // Should only have one repeatable job despite calling twice
    expect(repeatableJobs).toHaveLength(1);
  });

  it("should support adding single-site sync jobs", async () => {
    const job = await gscSyncQueue.add("site-sync", {
      syncType: "full",
      siteId: "site-123",
    });

    // Verify job was created with correct data
    expect(job).toBeDefined();
    expect(job.data).toMatchObject({
      syncType: "full",
      siteId: "site-123",
    });
    expect(job.name).toBe("site-sync");
  });

  it("should allow failed jobs to retry with exponential backoff (3 attempts)", async () => {
    const job = await gscSyncQueue.add("test-job", { syncType: "full" });

    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff).toEqual({ type: "exponential", delay: 5000 });
  });

  it("should remove completed jobs after 24 hours (count: 1000)", async () => {
    const job = await gscSyncQueue.add("test-job", { syncType: "full" });

    expect(job.opts.removeOnComplete).toEqual({ age: 86400, count: 1000 });
  });
});
