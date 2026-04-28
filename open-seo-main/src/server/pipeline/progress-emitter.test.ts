/**
 * Tests for progress event emitter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  emitPipelineProgress,
  emitPipelineBlocker,
  emitPlanComplete,
  emitPhaseComplete,
  type PipelineProgressData,
  type PipelineBlockerData,
} from "./progress-emitter";
import { emitActivityEvent } from "@/server/websocket/socket-server";

// Mock socket-server
vi.mock("@/server/websocket/socket-server", () => ({
  emitActivityEvent: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-event-id",
}));

describe("emitPipelineProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends progress event via Socket.IO", () => {
    const workspaceId = "workspace-123";
    const data: PipelineProgressData = {
      status: "running",
      currentPhase: { number: 38, name: "Autonomous Pipeline", slug: "autonomous-pipeline" },
      currentPlan: { id: "38-01", index: 0, total: 4 },
      progress: { completedPlans: 2, totalPlans: 10, percentage: 20 },
      eta: {
        eta: new Date("2026-04-24T18:00:00Z"),
        remainingMinutes: 60,
        confidence: "medium",
        basedOnSamples: 3,
      },
    };

    emitPipelineProgress(workspaceId, data);

    expect(emitActivityEvent).toHaveBeenCalledOnce();
    expect(emitActivityEvent).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        id: "test-event-id",
        type: "pipeline:progress",
        data: expect.objectContaining({
          status: "running",
          currentPhase: { number: 38, name: "Autonomous Pipeline", slug: "autonomous-pipeline" },
          progress: { completedPlans: 2, totalPlans: 10, percentage: 20 },
        }),
      })
    );
  });

  it("includes phase, plan, progress percentage, and ETA", () => {
    const workspaceId = "workspace-123";
    const data: PipelineProgressData = {
      status: "running",
      currentPhase: { number: 38, name: "Test Phase", slug: "test-phase" },
      currentPlan: { id: "38-02", index: 1, total: 5 },
      progress: { completedPlans: 5, totalPlans: 20, percentage: 25 },
      eta: {
        eta: new Date("2026-04-24T19:30:00Z"),
        remainingMinutes: 90,
        confidence: "high",
        basedOnSamples: 5,
      },
    };

    emitPipelineProgress(workspaceId, data);

    const call = vi.mocked(emitActivityEvent).mock.calls[0];
    const event = call[1];
    const eventData = event.data as {
      currentPhase: { number: number; name: string; slug: string };
      currentPlan: { id: string; index: number; total: number };
      progress: { percentage: number };
      eta: { eta: string; remainingMinutes: number; confidence: string };
    };

    expect(eventData.currentPhase).toEqual({ number: 38, name: "Test Phase", slug: "test-phase" });
    expect(eventData.currentPlan).toEqual({ id: "38-02", index: 1, total: 5 });
    expect(eventData.progress.percentage).toBe(25);
    expect(eventData.eta).toEqual({
      eta: "2026-04-24T19:30:00.000Z",
      remainingMinutes: 90,
      confidence: "high",
    });
  });

  it("handles null ETA gracefully", () => {
    const workspaceId = "workspace-123";
    const data: PipelineProgressData = {
      status: "running",
      currentPhase: { number: 38, name: "Test", slug: "test" },
      currentPlan: null,
      progress: { completedPlans: 0, totalPlans: 10, percentage: 0 },
      eta: null,
    };

    emitPipelineProgress(workspaceId, data);

    const call = vi.mocked(emitActivityEvent).mock.calls[0];
    expect(call[1].data.eta).toBeNull();
  });

  it("workspace ID determines Socket.IO room", () => {
    const workspace1 = "workspace-1";
    const workspace2 = "workspace-2";
    const data: PipelineProgressData = {
      status: "running",
      currentPhase: { number: 38, name: "Test", slug: "test" },
      currentPlan: null,
      progress: { completedPlans: 0, totalPlans: 10, percentage: 0 },
      eta: null,
    };

    emitPipelineProgress(workspace1, data);
    emitPipelineProgress(workspace2, data);

    const calls = vi.mocked(emitActivityEvent).mock.calls;
    expect(calls[0][0]).toBe(workspace1);
    expect(calls[1][0]).toBe(workspace2);
  });
});

describe("emitPipelineBlocker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends blocker event via Socket.IO", () => {
    const workspaceId = "workspace-123";
    const data: PipelineBlockerData = {
      blocker: {
        type: "verification_failed",
        message: "Test verification failed",
        context: { exitCode: 1 },
        recoverable: true,
        suggestedAction: "Review and fix the issue",
      },
      phaseNumber: 38,
      planId: "38-02",
    };

    emitPipelineBlocker(workspaceId, data);

    expect(emitActivityEvent).toHaveBeenCalledOnce();
    expect(emitActivityEvent).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        id: "test-event-id",
        type: "pipeline:blocker",
        data: expect.objectContaining({
          blocker: expect.objectContaining({
            type: "verification_failed",
            message: "Test verification failed",
            suggestedAction: "Review and fix the issue",
            recoverable: true,
          }),
          phaseNumber: 38,
          planId: "38-02",
        }),
      })
    );
  });
});

describe("emitPlanComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends plan complete event via Socket.IO", () => {
    const workspaceId = "workspace-123";

    emitPlanComplete(workspaceId, "38-03", 38, 15);

    expect(emitActivityEvent).toHaveBeenCalledOnce();
    expect(emitActivityEvent).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        type: "pipeline:plan-complete",
        data: {
          planId: "38-03",
          phaseNumber: 38,
          durationMinutes: 15,
        },
      })
    );
  });
});

describe("emitPhaseComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends phase complete event via Socket.IO", () => {
    const workspaceId = "workspace-123";

    emitPhaseComplete(workspaceId, 38, "Autonomous Pipeline");

    expect(emitActivityEvent).toHaveBeenCalledOnce();
    expect(emitActivityEvent).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        type: "pipeline:phase-complete",
        data: {
          phaseNumber: 38,
          phaseName: "Autonomous Pipeline",
        },
      })
    );
  });
});
