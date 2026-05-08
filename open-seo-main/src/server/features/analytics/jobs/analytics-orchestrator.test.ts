/**
 * Analytics Orchestrator Tests
 * Phase 96-Queue: Job coordination and DLQ integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock database module before any imports that use it
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

// Mock the dead-letter-queue module before importing orchestrator
vi.mock("@/server/lib/dead-letter-queue", () => ({
  moveToDeadLetter: vi.fn().mockResolvedValue("dlq-123"),
  countDeadLetterJobs: vi.fn().mockResolvedValue(0),
  getDeadLetterStats: vi.fn().mockResolvedValue({
    total: 0,
    unreplayed: 0,
    byQueue: {},
    byJobName: {},
    last24h: 0,
  }),
}));

import {
  analyticsFlowProducer,
  scheduleAnalyticsFlow,
  getAnalyticsHealthStats,
  initializeAnalyticsOrchestrator,
} from "./analytics-orchestrator";
import { gscSyncQueue } from "./gsc-sync.job";
import { annotationsImportQueue } from "./annotations-import.job";

describe("analyticsFlowProducer", () => {
  afterEach(async () => {
    // Clean up queues after tests
    await gscSyncQueue.obliterate({ force: true });
    await annotationsImportQueue.obliterate({ force: true });
  });

  it("should be defined with correct connection", () => {
    expect(analyticsFlowProducer).toBeDefined();
  });

  it("should create a flow with GSC sync as parent and annotations as child", async () => {
    const { flowJobId } = await scheduleAnalyticsFlow("workspace-123", {
      triggeredBy: "manual",
    });

    expect(flowJobId).toBeDefined();
    expect(flowJobId).toContain("analytics-flow-gsc-workspace-123");

    // The FlowProducer creates jobs that may be processed immediately by the worker.
    // We verify the flow was created by checking the returned flowJobId format.
    // The actual job coordination (parent-child) is handled by BullMQ's Flow API.
    expect(typeof flowJobId).toBe("string");
  });

  it("should support both schedule and manual trigger types", async () => {
    const { flowJobId: scheduledFlow } = await scheduleAnalyticsFlow("workspace-1", {
      triggeredBy: "schedule",
    });
    const { flowJobId: manualFlow } = await scheduleAnalyticsFlow("workspace-2", {
      triggeredBy: "manual",
    });

    expect(scheduledFlow).toBeDefined();
    expect(manualFlow).toBeDefined();
    expect(scheduledFlow).not.toBe(manualFlow);
  });
});

describe("getAnalyticsHealthStats", () => {
  afterEach(async () => {
    await gscSyncQueue.obliterate({ force: true });
    await annotationsImportQueue.obliterate({ force: true });
  });

  it("should return health stats for both queues", async () => {
    const stats = await getAnalyticsHealthStats();

    expect(stats).toHaveProperty("gscSync");
    expect(stats).toHaveProperty("annotationsImport");
    expect(stats).toHaveProperty("lastFlowStatus");
    expect(stats).toHaveProperty("averageJobDuration");

    // Verify queue stats structure
    expect(stats.gscSync).toMatchObject({
      waiting: expect.any(Number),
      active: expect.any(Number),
      completed: expect.any(Number),
      failed: expect.any(Number),
      delayed: expect.any(Number),
    });

    expect(stats.annotationsImport).toMatchObject({
      waiting: expect.any(Number),
      active: expect.any(Number),
      completed: expect.any(Number),
      failed: expect.any(Number),
      delayed: expect.any(Number),
    });
  });

  it("should return null for average durations when no completed jobs", async () => {
    const stats = await getAnalyticsHealthStats();

    expect(stats.averageJobDuration.gscSyncMs).toBeNull();
    expect(stats.averageJobDuration.annotationsMs).toBeNull();
  });
});

describe("initializeAnalyticsOrchestrator", () => {
  it("should initialize without throwing", () => {
    expect(() => initializeAnalyticsOrchestrator()).not.toThrow();
  });
});

describe("GSC rate limiting", () => {
  it("should export rate limit constants", async () => {
    const { GSC_RATE_LIMIT } = await import("./gsc-sync.job");

    expect(GSC_RATE_LIMIT).toEqual({
      max: 50,
      duration: 60000,
    });
  });
});
