/**
 * PipelineService tests.
 * Phase 30.5-04: Pipeline stage management
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { nanoid } from "nanoid";

// Mock the database module
vi.mock("@/db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
}));

// Import after mock
import { db } from "@/db/index";
import { PipelineService } from "./PipelineService";

describe("PipelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transitionStage", () => {
    it("should update pipelineStage and updatedAt", async () => {
      const prospectId = nanoid();
      const mockProspect = { pipelineStage: "new" };

      // Mock select to return prospect
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProspect]),
          }),
        }),
      } as any);

      // Mock update
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // Mock insert for log
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await PipelineService.transitionStage(prospectId, "analyzing", "test_rule");

      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it("should log the transition in pipelineAutomationLogs", async () => {
      const prospectId = nanoid();
      const mockProspect = { pipelineStage: "analyzing" };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProspect]),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await PipelineService.transitionStage(prospectId, "scored", "analysis_complete");

      expect(db.insert).toHaveBeenCalled();
    });

    it("should reject invalid stage transitions", async () => {
      const prospectId = nanoid();
      const mockProspect = { pipelineStage: "archived" };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProspect]),
          }),
        }),
      } as any);

      // archived -> analyzing should be invalid
      await expect(
        PipelineService.transitionStage(prospectId, "analyzing", "manual")
      ).rejects.toThrow("Invalid stage transition");
    });
  });

  describe("getProspectsByStage", () => {
    it("should return prospects filtered by stage", async () => {
      const workspaceId = nanoid();
      const mockProspects = [
        { id: nanoid(), pipelineStage: "qualified" },
        { id: nanoid(), pipelineStage: "qualified" },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockProspects),
        }),
      } as any);

      const result = await PipelineService.getProspectsByStage(workspaceId, "qualified");

      expect(result).toHaveLength(2);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getStageDistribution", () => {
    it("should return count per stage for workspace", async () => {
      const workspaceId = nanoid();
      const mockCounts = [
        { stage: "new", count: 5 },
        { stage: "scored", count: 3 },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue(mockCounts),
          }),
        }),
      } as any);

      const result = await PipelineService.getStageDistribution(workspaceId);

      // Should include all 8 stages, even with 0 counts
      expect(result).toHaveLength(8);
      expect(result.find((r) => r.stage === "new")?.count).toBe(5);
      expect(result.find((r) => r.stage === "scored")?.count).toBe(3);
      expect(result.find((r) => r.stage === "qualified")?.count).toBe(0);
    });
  });

  describe("handleAnalysisComplete", () => {
    it("should transition to scored and then qualified if score >= 70", async () => {
      const prospectId = nanoid();
      const transitionSpy = vi.spyOn(PipelineService, "transitionStage").mockResolvedValue();

      await PipelineService.handleAnalysisComplete(prospectId, 85);

      expect(transitionSpy).toHaveBeenCalledTimes(2);
      expect(transitionSpy).toHaveBeenNthCalledWith(1, prospectId, "scored", "analysis_complete");
      expect(transitionSpy).toHaveBeenNthCalledWith(2, prospectId, "qualified", "auto_qualify_high_score");

      transitionSpy.mockRestore();
    });

    it("should only transition to scored if score < 70", async () => {
      const prospectId = nanoid();
      const transitionSpy = vi.spyOn(PipelineService, "transitionStage").mockResolvedValue();

      await PipelineService.handleAnalysisComplete(prospectId, 50);

      expect(transitionSpy).toHaveBeenCalledTimes(1);
      expect(transitionSpy).toHaveBeenCalledWith(prospectId, "scored", "analysis_complete");

      transitionSpy.mockRestore();
    });
  });
});
