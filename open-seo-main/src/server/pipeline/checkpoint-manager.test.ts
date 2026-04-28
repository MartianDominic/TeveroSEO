/**
 * Tests for checkpoint manager.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, writeFile } from "fs/promises";
import type { Checkpoint, ResumePoint } from "./checkpoint-manager";
import { readCheckpoint, writeCheckpoint, getResumePoint } from "./checkpoint-manager";
import { PipelineError } from "./types";

vi.mock("fs/promises");

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

describe("checkpoint-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("readCheckpoint", () => {
    it("should return checkpoint from STATE.md frontmatter", async () => {
      const stateContent = `---
gsd_state_version: 1.0
status: running
stopped_at: Completed 38-02
last_updated: "2026-04-23T10:00:00Z"
pipeline_state:
  current_phase_slug: 38-autonomous-pipeline-orchestration
  last_completed_phase_slug: 38-autonomous-pipeline-orchestration
  last_completed_plan: "38-02"
  started_at: "2026-04-23T09:00:00Z"
---

# Project State
`;

      mockReadFile.mockResolvedValue(stateContent);

      const checkpoint = await readCheckpoint();

      expect(checkpoint).toEqual({
        status: "running",
        stoppedAt: "Completed 38-02",
        lastUpdated: "2026-04-23T10:00:00Z",
        pipelineState: {
          currentPhaseSlug: "38-autonomous-pipeline-orchestration",
          lastCompletedPhaseSlug: "38-autonomous-pipeline-orchestration",
          lastCompletedPlan: "38-02",
          startedAt: "2026-04-23T09:00:00Z",
        },
      });
    });

    it("should return null when STATE.md is missing", async () => {
      const error = new Error("ENOENT: no such file") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockReadFile.mockRejectedValue(error);

      const checkpoint = await readCheckpoint();

      expect(checkpoint).toBeNull();
    });

    it("should return null when YAML frontmatter is missing", async () => {
      mockReadFile.mockResolvedValue("# Project State\n\nNo frontmatter here");

      const checkpoint = await readCheckpoint();

      expect(checkpoint).toBeNull();
    });

    it("should throw PipelineError on corrupted YAML", async () => {
      mockReadFile.mockResolvedValue(`---
invalid: yaml: structure: [
---`);

      await expect(readCheckpoint()).rejects.toThrow(PipelineError);
      await expect(readCheckpoint()).rejects.toMatchObject({
        code: "CHECKPOINT_READ_ERROR",
      });
    });
  });

  describe("writeCheckpoint", () => {
    const baseStateContent = `---
gsd_state_version: 1.0
status: idle
stopped_at: null
last_updated: "2026-04-23T09:00:00Z"
last_activity: 2026-04-23
---

# Project State
`;

    beforeEach(() => {
      mockReadFile.mockResolvedValue(baseStateContent);
    });

    it("should update status and stopped_at fields", async () => {
      await writeCheckpoint({
        status: "paused",
        stoppedAt: "Completed 38-03",
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      expect(writtenContent).toContain("status: paused");
      expect(writtenContent).toContain("stopped_at: Completed 38-03");
    });

    it("should preserve all other frontmatter fields", async () => {
      await writeCheckpoint({
        status: "running",
      });

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      // YAML normalizes 1.0 to 1, so check for either
      expect(writtenContent).toMatch(/gsd_state_version: 1(?:\.0)?/);
      expect(writtenContent).toContain("# Project State");
    });

    it("should update last_updated and last_activity timestamps", async () => {
      const beforeWrite = new Date().toISOString();

      await writeCheckpoint({
        status: "running",
      });

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      // YAML may quote or not quote the timestamp, so match both formats
      const lastUpdatedMatch = writtenContent.match(/last_updated: ["']?([^"'\n]+)["']?/);
      const lastActivityMatch = writtenContent.match(/last_activity: ["']?(\d{4}-\d{2}-\d{2})["']?/);

      expect(lastUpdatedMatch).toBeTruthy();
      expect(lastActivityMatch).toBeTruthy();

      const afterWrite = new Date().toISOString();
      const writtenTimestamp = lastUpdatedMatch![1];

      expect(writtenTimestamp >= beforeWrite).toBe(true);
      expect(writtenTimestamp <= afterWrite).toBe(true);
    });

    it("should write pipeline_state when provided", async () => {
      await writeCheckpoint({
        pipelineState: {
          currentPhaseSlug: "38-autonomous-pipeline-orchestration",
          lastCompletedPhaseSlug: "38-autonomous-pipeline-orchestration",
          lastCompletedPlan: "38-03",
          startedAt: "2026-04-23T10:00:00Z",
        },
      });

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      expect(writtenContent).toContain("pipeline_state:");
      expect(writtenContent).toContain("current_phase_slug: 38-autonomous-pipeline-orchestration");
      expect(writtenContent).toContain("last_completed_plan: 38-03");
    });

    it("should throw PipelineError when STATE.md has no frontmatter", async () => {
      mockReadFile.mockResolvedValue("# Project State\n\nNo frontmatter");

      await expect(
        writeCheckpoint({ status: "running" })
      ).rejects.toThrow(PipelineError);
      await expect(
        writeCheckpoint({ status: "running" })
      ).rejects.toMatchObject({
        code: "INVALID_STATE_FORMAT",
      });
    });
  });

  describe("getResumePoint", () => {
    it("should return first plan when no checkpoint exists", async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

      const phases = [
        { slug: "38-autonomous-pipeline-orchestration", planCount: 4 },
        { slug: "39-next-phase", planCount: 3 },
      ];

      const resumePoint = await getResumePoint(phases);

      expect(resumePoint).toEqual({
        phaseSlug: "38-autonomous-pipeline-orchestration",
        planId: "38-01",
        planIndex: 0,
      });
    });

    it("should return next plan in same phase", async () => {
      const stateContent = `---
gsd_state_version: 1.0
pipeline_state:
  last_completed_plan: "38-02"
---`;

      mockReadFile.mockResolvedValue(stateContent);

      const phases = [
        { slug: "38-autonomous-pipeline-orchestration", planCount: 4 },
        { slug: "39-next-phase", planCount: 3 },
      ];

      const resumePoint = await getResumePoint(phases);

      expect(resumePoint).toEqual({
        phaseSlug: "38-autonomous-pipeline-orchestration",
        planId: "38-03",
        planIndex: 2,
      });
    });

    it("should return first plan of next phase when current phase complete", async () => {
      const stateContent = `---
gsd_state_version: 1.0
pipeline_state:
  last_completed_plan: "38-04"
---`;

      mockReadFile.mockResolvedValue(stateContent);

      const phases = [
        { slug: "38-autonomous-pipeline-orchestration", planCount: 4 },
        { slug: "39-next-phase", planCount: 3 },
      ];

      const resumePoint = await getResumePoint(phases);

      expect(resumePoint).toEqual({
        phaseSlug: "39-next-phase",
        planId: "39-01",
        planIndex: 0,
      });
    });

    it("should return null when pipeline is complete", async () => {
      const stateContent = `---
gsd_state_version: 1.0
pipeline_state:
  last_completed_plan: "39-03"
---`;

      mockReadFile.mockResolvedValue(stateContent);

      const phases = [
        { slug: "38-autonomous-pipeline-orchestration", planCount: 4 },
        { slug: "39-next-phase", planCount: 3 },
      ];

      const resumePoint = await getResumePoint(phases);

      expect(resumePoint).toBeNull();
    });

    it("should return null when last completed plan references unknown phase", async () => {
      const stateContent = `---
gsd_state_version: 1.0
pipeline_state:
  last_completed_plan: "99-01"
---`;

      mockReadFile.mockResolvedValue(stateContent);

      const phases = [
        { slug: "38-autonomous-pipeline-orchestration", planCount: 4 },
        { slug: "39-next-phase", planCount: 3 },
      ];

      const resumePoint = await getResumePoint(phases);

      expect(resumePoint).toBeNull();
    });

    it("should return null when phases array is empty", async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

      const resumePoint = await getResumePoint([]);

      expect(resumePoint).toBeNull();
    });
  });
});
