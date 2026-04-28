/**
 * Tests for pipeline scheduler with Flow Producer.
 *
 * @module pipeline-scheduler.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PhaseNode } from "./types";

// Mock the pipelineFlowProducer
const mockFlowProducerAdd = vi.fn();

vi.mock("@/server/queues/pipelineQueue", () => ({
  pipelineFlowProducer: {
    add: mockFlowProducerAdd,
  },
  PHASE_QUEUE_NAME: "pipeline-phase",
  PLAN_QUEUE_NAME: "pipeline-plan",
  PLAN_STEP: {
    INITIAL: "initial",
    EXECUTING: "executing",
    VERIFYING: "verifying",
    COMPLETE: "complete",
  },
}));

// Mock the logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  }),
}));

// Mock fs/promises for ROADMAP.md reading
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

// Mock roadmap-parser
vi.mock("./roadmap-parser", () => ({
  parseRoadmap: vi.fn(),
}));

// Mock dependency-resolver
vi.mock("./dependency-resolver", () => ({
  resolveExecutionOrder: vi.fn(),
}));

describe("pipeline-scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlowProducerAdd.mockResolvedValue({
      job: { id: "phase-38-123456" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("schedulePhase", () => {
    it("should create Flow with phase as parent and plans as children", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 38,
        name: "Autonomous Pipeline Orchestration",
        slug: "autonomous-pipeline-orchestration",
        dependencies: [37],
        requirements: ["AUTO-01", "AUTO-02"],
        status: "not_started",
        planCount: 3,
      };

      await schedulePhase(testPhase, "ws-123");

      expect(mockFlowProducerAdd).toHaveBeenCalledTimes(1);
      const flowArg = mockFlowProducerAdd.mock.calls[0][0];

      // Verify parent job
      expect(flowArg.name).toBe("phase-38");
      expect(flowArg.queueName).toBe("pipeline-phase");
      expect(flowArg.data.phaseNumber).toBe(38);
      expect(flowArg.data.phaseName).toBe("Autonomous Pipeline Orchestration");
      expect(flowArg.data.workspaceId).toBe("ws-123");
      expect(flowArg.data.planIds).toEqual(["38-01", "38-02", "38-03"]);

      // Verify children
      expect(flowArg.children).toHaveLength(3);
      expect(flowArg.children[0].name).toBe("plan-38-01");
      expect(flowArg.children[0].queueName).toBe("pipeline-plan");
      expect(flowArg.children[0].data.planId).toBe("38-01");
      expect(flowArg.children[1].data.planId).toBe("38-02");
      expect(flowArg.children[2].data.planId).toBe("38-03");
    });

    it("should derive correct planPath from phase slug", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 38,
        name: "Autonomous Pipeline Orchestration",
        slug: "autonomous-pipeline-orchestration",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 2,
      };

      await schedulePhase(testPhase, "ws-456");

      const flowArg = mockFlowProducerAdd.mock.calls[0][0];
      expect(flowArg.children[0].data.planPath).toBe(
        ".planning/phases/38-autonomous-pipeline-orchestration/38-01-PLAN.md"
      );
      expect(flowArg.children[1].data.planPath).toBe(
        ".planning/phases/38-autonomous-pipeline-orchestration/38-02-PLAN.md"
      );
    });

    it("should propagate workspaceId to all job data", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 30,
        name: "Interactive Proposals",
        slug: "interactive-proposals",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 2,
      };

      await schedulePhase(testPhase, "ws-test-workspace");

      const flowArg = mockFlowProducerAdd.mock.calls[0][0];
      expect(flowArg.data.workspaceId).toBe("ws-test-workspace");
      expect(flowArg.children[0].data.workspaceId).toBe("ws-test-workspace");
      expect(flowArg.children[1].data.workspaceId).toBe("ws-test-workspace");
    });

    it("should set initial step for all plan jobs", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 35,
        name: "Internal Linking",
        slug: "internal-linking",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 2,
      };

      await schedulePhase(testPhase, "ws-789");

      const flowArg = mockFlowProducerAdd.mock.calls[0][0];
      expect(flowArg.children[0].data.step).toBe("initial");
      expect(flowArg.children[1].data.step).toBe("initial");
    });

    it("should return the flow job ID", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 38,
        name: "Test Phase",
        slug: "test-phase",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      };

      const jobId = await schedulePhase(testPhase, "ws-123");
      expect(jobId).toBe("phase-38-123456");
    });

    it("should handle phases with no plans", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 99,
        name: "Empty Phase",
        slug: "empty-phase",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 0,
      };

      await schedulePhase(testPhase, "ws-123");

      const flowArg = mockFlowProducerAdd.mock.calls[0][0];
      expect(flowArg.children).toHaveLength(0);
      expect(flowArg.data.planIds).toHaveLength(0);
    });
  });

  describe("schedulePipeline", () => {
    it("should read ROADMAP.md and schedule phases in order", async () => {
      const { readFile } = await import("fs/promises");
      const { parseRoadmap } = await import("./roadmap-parser");
      const { resolveExecutionOrder } = await import("./dependency-resolver");
      const { schedulePipeline } = await import("./pipeline-scheduler");

      const mockPhases: PhaseNode[] = [
        {
          number: 37,
          name: "Brand Voice",
          slug: "brand-voice",
          dependencies: [],
          requirements: [],
          status: "complete",
          planCount: 2,
        },
        {
          number: 38,
          name: "Pipeline Orchestration",
          slug: "pipeline-orchestration",
          dependencies: [37],
          requirements: [],
          status: "not_started",
          planCount: 3,
        },
      ];

      (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        "# Mock ROADMAP content"
      );
      (parseRoadmap as ReturnType<typeof vi.fn>).mockReturnValue(mockPhases);
      (resolveExecutionOrder as ReturnType<typeof vi.fn>).mockReturnValue({
        phases: [37, 38],
        waves: new Map([
          [1, [37]],
          [2, [38]],
        ]),
      });

      const result = await schedulePipeline({ workspaceId: "ws-123" });

      // Should only schedule incomplete phases
      expect(mockFlowProducerAdd).toHaveBeenCalledTimes(1);
      expect(result.scheduledPhases).toEqual([38]);
      expect(result.executionOrder.phases).toEqual([37, 38]);
    });

    it("should skip phases before startFromPhase", async () => {
      const { readFile } = await import("fs/promises");
      const { parseRoadmap } = await import("./roadmap-parser");
      const { resolveExecutionOrder } = await import("./dependency-resolver");
      const { schedulePipeline } = await import("./pipeline-scheduler");

      const mockPhases: PhaseNode[] = [
        {
          number: 35,
          name: "Internal Linking",
          slug: "internal-linking",
          dependencies: [],
          requirements: [],
          status: "not_started",
          planCount: 2,
        },
        {
          number: 36,
          name: "Content Brief",
          slug: "content-brief",
          dependencies: [35],
          requirements: [],
          status: "not_started",
          planCount: 3,
        },
        {
          number: 37,
          name: "Brand Voice",
          slug: "brand-voice",
          dependencies: [36],
          requirements: [],
          status: "not_started",
          planCount: 2,
        },
      ];

      (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        "# Mock ROADMAP content"
      );
      (parseRoadmap as ReturnType<typeof vi.fn>).mockReturnValue(mockPhases);
      (resolveExecutionOrder as ReturnType<typeof vi.fn>).mockReturnValue({
        phases: [35, 36, 37],
        waves: new Map([
          [1, [35]],
          [2, [36]],
          [3, [37]],
        ]),
      });

      const result = await schedulePipeline({
        workspaceId: "ws-123",
        startFromPhase: 36,
      });

      // Should only schedule phases 36 and 37
      expect(mockFlowProducerAdd).toHaveBeenCalledTimes(2);
      expect(result.scheduledPhases).toEqual([36, 37]);
    });

    it("should return empty array when all phases are complete", async () => {
      const { readFile } = await import("fs/promises");
      const { parseRoadmap } = await import("./roadmap-parser");
      const { resolveExecutionOrder } = await import("./dependency-resolver");
      const { schedulePipeline } = await import("./pipeline-scheduler");

      const mockPhases: PhaseNode[] = [
        {
          number: 37,
          name: "Brand Voice",
          slug: "brand-voice",
          dependencies: [],
          requirements: [],
          status: "complete",
          planCount: 2,
        },
      ];

      (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        "# Mock ROADMAP content"
      );
      (parseRoadmap as ReturnType<typeof vi.fn>).mockReturnValue(mockPhases);
      (resolveExecutionOrder as ReturnType<typeof vi.fn>).mockReturnValue({
        phases: [37],
        waves: new Map([[1, [37]]]),
      });

      const result = await schedulePipeline({ workspaceId: "ws-123" });

      expect(mockFlowProducerAdd).not.toHaveBeenCalled();
      expect(result.scheduledPhases).toEqual([]);
    });
  });

  describe("generatePlanIds", () => {
    it("should generate correct plan IDs for a phase", async () => {
      // Test via schedulePhase since generatePlanIds is internal
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 5,
        name: "Early Phase",
        slug: "early-phase",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 4,
      };

      await schedulePhase(testPhase, "ws-123");

      const flowArg = mockFlowProducerAdd.mock.calls[0][0];
      expect(flowArg.data.planIds).toEqual(["05-01", "05-02", "05-03", "05-04"]);
    });

    it("should pad phase numbers correctly", async () => {
      const { schedulePhase } = await import("./pipeline-scheduler");

      const testPhase: PhaseNode = {
        number: 100,
        name: "Triple Digit Phase",
        slug: "triple-digit-phase",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      };

      await schedulePhase(testPhase, "ws-123");

      const flowArg = mockFlowProducerAdd.mock.calls[0][0];
      // Phase 100 should still be padded to at least 2 digits
      expect(flowArg.data.planIds).toEqual(["100-01"]);
    });
  });
});
