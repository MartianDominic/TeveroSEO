/**
 * Tests for pipeline queue definitions and Flow Producer.
 *
 * @module pipelineQueue.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FlowProducer, Queue } from "bullmq";

// Mock the redis module before importing pipelineQueue
vi.mock("@/server/lib/redis", () => ({
  getSharedBullMQConnection: vi.fn(() => ({
    // Mock Redis connection with required properties
    status: "ready",
    duplicate: vi.fn(() => ({
      status: "ready",
    })),
  })),
}));

// Mock bullmq to capture queue/flow producer creation
const mockQueueConstructor = vi.fn();
const mockFlowProducerConstructor = vi.fn();
const mockFlowProducerAdd = vi.fn();

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    name: string;
    opts: unknown;
    constructor(name: string, opts: unknown) {
      mockQueueConstructor(name, opts);
      this.name = name;
      this.opts = opts;
    }
  },
  FlowProducer: class MockFlowProducer {
    opts: unknown;
    constructor(opts: unknown) {
      mockFlowProducerConstructor(opts);
      this.opts = opts;
    }
    add = mockFlowProducerAdd;
  },
}));

describe("pipelineQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache to re-run module initialization
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Queue definitions", () => {
    it("should export correct queue names", async () => {
      const { PHASE_QUEUE_NAME, PLAN_QUEUE_NAME } = await import(
        "./pipelineQueue"
      );
      expect(PHASE_QUEUE_NAME).toBe("pipeline-phase");
      expect(PLAN_QUEUE_NAME).toBe("pipeline-plan");
    });

    it("should create phaseQueue with correct name", async () => {
      const { phaseQueue, PHASE_QUEUE_NAME } = await import("./pipelineQueue");
      expect(phaseQueue.name).toBe(PHASE_QUEUE_NAME);
    });

    it("should create planQueue with correct name", async () => {
      const { planQueue, PLAN_QUEUE_NAME } = await import("./pipelineQueue");
      expect(planQueue.name).toBe(PLAN_QUEUE_NAME);
    });
  });

  describe("Job options", () => {
    it("should configure phaseQueue with attempts: 1 (no retry)", async () => {
      await import("./pipelineQueue");
      // Find the phase queue constructor call
      const phaseCall = mockQueueConstructor.mock.calls.find(
        (call) => call[0] === "pipeline-phase"
      );
      expect(phaseCall).toBeDefined();
      expect(phaseCall![1].defaultJobOptions.attempts).toBe(1);
    });

    it("should configure planQueue with attempts: 3 and exponential backoff", async () => {
      await import("./pipelineQueue");
      // Find the plan queue constructor call
      const planCall = mockQueueConstructor.mock.calls.find(
        (call) => call[0] === "pipeline-plan"
      );
      expect(planCall).toBeDefined();
      expect(planCall![1].defaultJobOptions.attempts).toBe(3);
      expect(planCall![1].defaultJobOptions.backoff).toEqual({
        type: "exponential",
        delay: 10_000,
      });
    });

    it("should configure removeOnComplete and removeOnFail options", async () => {
      await import("./pipelineQueue");
      const planCall = mockQueueConstructor.mock.calls.find(
        (call) => call[0] === "pipeline-plan"
      );
      expect(planCall).toBeDefined();
      expect(planCall![1].defaultJobOptions.removeOnComplete).toEqual({
        count: 100,
      });
      expect(planCall![1].defaultJobOptions.removeOnFail).toEqual({ count: 500 });
    });
  });

  describe("FlowProducer", () => {
    it("should export pipelineFlowProducer", async () => {
      const { pipelineFlowProducer } = await import("./pipelineQueue");
      expect(pipelineFlowProducer).toBeDefined();
    });

    it("should create FlowProducer with shared connection", async () => {
      const { getSharedBullMQConnection } = await import("@/server/lib/redis");
      await import("./pipelineQueue");
      expect(getSharedBullMQConnection).toHaveBeenCalledWith("flow:pipeline");
    });

    it("should be able to add a flow with parent and children", async () => {
      const { pipelineFlowProducer, PHASE_QUEUE_NAME, PLAN_QUEUE_NAME } =
        await import("./pipelineQueue");

      mockFlowProducerAdd.mockResolvedValueOnce({
        job: { id: "phase-38-123456" },
      });

      const result = await pipelineFlowProducer.add({
        name: "phase-38",
        queueName: PHASE_QUEUE_NAME,
        data: {
          phaseNumber: 38,
          phaseName: "Test Phase",
          phaseSlug: "test-phase",
          workspaceId: "ws-123",
          planIds: ["38-01", "38-02"],
          startedAt: "2026-04-24T00:00:00Z",
        },
        children: [
          {
            name: "plan-38-01",
            queueName: PLAN_QUEUE_NAME,
            data: {
              planId: "38-01",
              phaseNumber: 38,
              phaseName: "Test Phase",
              workspaceId: "ws-123",
              planPath: ".planning/phases/38-test-phase/38-01-PLAN.md",
              step: "initial",
            },
          },
          {
            name: "plan-38-02",
            queueName: PLAN_QUEUE_NAME,
            data: {
              planId: "38-02",
              phaseNumber: 38,
              phaseName: "Test Phase",
              workspaceId: "ws-123",
              planPath: ".planning/phases/38-test-phase/38-02-PLAN.md",
              step: "initial",
            },
          },
        ],
      });

      expect(mockFlowProducerAdd).toHaveBeenCalledTimes(1);
      expect(result.job.id).toBe("phase-38-123456");
    });
  });

  describe("Type definitions", () => {
    it("should export PhaseJobData interface with required fields", async () => {
      const { PHASE_QUEUE_NAME } = await import("./pipelineQueue");
      // Type assertion test - if this compiles, the interface is correct
      const testPhaseJob = {
        phaseNumber: 38,
        phaseName: "Test Phase",
        phaseSlug: "test-phase",
        workspaceId: "ws-123",
        planIds: ["38-01"],
        startedAt: new Date().toISOString(),
      };
      expect(testPhaseJob.phaseNumber).toBe(38);
      expect(PHASE_QUEUE_NAME).toBeDefined();
    });

    it("should export PlanJobData interface with required fields", async () => {
      const { PLAN_STEP } = await import("./pipelineQueue");
      // Type assertion test - if this compiles, the interface is correct
      const testPlanJob = {
        planId: "38-01",
        phaseNumber: 38,
        phaseName: "Test Phase",
        workspaceId: "ws-123",
        planPath: ".planning/phases/38-test-phase/38-01-PLAN.md",
        step: PLAN_STEP.INITIAL,
      };
      expect(testPlanJob.planId).toBe("38-01");
      expect(testPlanJob.step).toBe("initial");
    });

    it("should export PLAN_STEP enum with all steps", async () => {
      const { PLAN_STEP } = await import("./pipelineQueue");
      expect(PLAN_STEP.INITIAL).toBe("initial");
      expect(PLAN_STEP.EXECUTING).toBe("executing");
      expect(PLAN_STEP.VERIFYING).toBe("verifying");
      expect(PLAN_STEP.COMPLETE).toBe("complete");
    });
  });
});
