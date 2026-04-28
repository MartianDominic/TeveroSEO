/**
 * Prospect automation engine tests.
 * Phase 30.5-04: Pipeline automation rules
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
  },
}));

// Mock PipelineService
vi.mock("../services/PipelineService", () => ({
  PipelineService: {
    transitionStage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mock
import { db } from "@/db/index";
import { PipelineService } from "../services/PipelineService";
import {
  DEFAULT_PROSPECT_RULES,
  hasBeenExecutedForProspect,
  processProspectAutomations,
} from "./prospectAutomation";

describe("prospectAutomation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DEFAULT_PROSPECT_RULES", () => {
    it("should contain auto_qualify_high_score rule", () => {
      const autoQualifyRule = DEFAULT_PROSPECT_RULES.find(
        (r) => r.id === "auto_qualify_high_score"
      );

      expect(autoQualifyRule).toBeDefined();
      expect(autoQualifyRule?.trigger.type).toBe("score_threshold");
      expect(autoQualifyRule?.trigger.scoreThreshold).toBe(70);
      expect(autoQualifyRule?.action.type).toBe("update_stage");
      expect(autoQualifyRule?.action.newStage).toBe("qualified");
    });
  });

  describe("hasBeenExecutedForProspect", () => {
    it("should return true if log exists", async () => {
      const prospectId = nanoid();
      const ruleId = "auto_qualify_high_score";

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "log1" }]),
          }),
        }),
      } as any);

      const result = await hasBeenExecutedForProspect(prospectId, ruleId);

      expect(result).toBe(true);
    });

    it("should return false if no log exists", async () => {
      const prospectId = nanoid();
      const ruleId = "auto_qualify_high_score";

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await hasBeenExecutedForProspect(prospectId, ruleId);

      expect(result).toBe(false);
    });
  });

  describe("processProspectAutomations", () => {
    it("should find scored prospects with score >= 70", async () => {
      const workspaceId = nanoid();
      const mockProspects = [
        { id: nanoid(), pipelineStage: "scored", priorityScore: 85 },
      ];

      // Mock finding matching prospects
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockProspects),
        }),
      } as any);

      await processProspectAutomations(workspaceId);

      expect(db.select).toHaveBeenCalled();
    });

    it("should skip already-executed rules", async () => {
      const workspaceId = nanoid();
      const prospectId = nanoid();
      const mockProspects = [
        { id: prospectId, pipelineStage: "scored", priorityScore: 85 },
      ];

      // First call finds prospects, subsequent call checks execution logs
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Finding matching prospects
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockProspects),
            }),
          } as any;
        }
        // Checking if already executed - return existing log
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "existing_log" }]),
            }),
          }),
        } as any;
      });

      const result = await processProspectAutomations(workspaceId);

      // Should have processed but not executed due to existing log
      expect(result.processed).toBe(1);
      expect(result.executed).toBe(0);
    });

    it("should transition qualified prospects", async () => {
      const workspaceId = nanoid();
      const prospectId = nanoid();
      const mockProspects = [
        { id: prospectId, pipelineStage: "scored", priorityScore: 85 },
      ];

      // First call finds prospects, subsequent call checks no existing logs
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockProspects),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any;
      });

      const result = await processProspectAutomations(workspaceId);

      expect(result.executed).toBe(1);
      expect(PipelineService.transitionStage).toHaveBeenCalledWith(
        prospectId,
        "qualified",
        "auto_qualify_high_score"
      );
    });
  });
});
