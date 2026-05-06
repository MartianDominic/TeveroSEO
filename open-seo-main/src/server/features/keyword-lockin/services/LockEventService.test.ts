import { describe, it, expect, vi } from "vitest";
import {
  LockEventService,
  lockKeywordsAtSigning,
  getLockEventSummary,
  type KeywordToLock,
  type GoalToCreate,
} from "./LockEventService";

// Mock repositories
vi.mock("../repositories/ContractedKeywordRepository", () => ({
  ContractedKeywordRepository: {
    insertContractedKeywords: vi.fn().mockResolvedValue([
      { id: "kw-1", contractId: "c-1", keywordText: "test keyword", status: "active" },
    ]),
    getContractedKeywordsByContract: vi.fn().mockResolvedValue([
      { id: "kw-1", contractId: "c-1", keywordText: "test keyword", status: "active" },
    ]),
    getActiveKeywordCount: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("../repositories/ContractGoalRepository", () => ({
  ContractGoalRepository: {
    insertContractGoal: vi.fn().mockResolvedValue({
      id: "goal-1",
      contractId: "c-1",
      metric: "keywords_in_top_10",
      targetValue: 10,
      status: "in_progress",
    }),
    getGoalsByContract: vi.fn().mockResolvedValue([
      {
        id: "goal-1",
        contractId: "c-1",
        metric: "keywords_in_top_10",
        targetValue: 10,
        status: "in_progress",
      },
    ]),
  },
}));

describe("LockEventService", () => {
  describe("lockKeywordsAtSigning", () => {
    const validKeywords: KeywordToLock[] = [
      {
        keywordText: "test keyword",
        searchVolume: 1000,
        difficulty: 50,
        funnelStage: "BOFU",
        baselinePosition: 15,
      },
    ];

    const validGoal: GoalToCreate = {
      metric: "keywords_in_top_10",
      targetValue: 10,
      targetDeadline: new Date("2026-07-31"),
    };

    it("returns result with keywords and goal", async () => {
      const result = await lockKeywordsAtSigning("contract-1", validKeywords, validGoal);

      expect(result).toHaveProperty("keywords");
      expect(result).toHaveProperty("goal");
      expect(result).toHaveProperty("lockedCount");
      expect(result.lockedCount).toBe(1);
    });

    it("handles empty keyword array", async () => {
      const { ContractedKeywordRepository } = await import("../repositories/ContractedKeywordRepository");
      vi.mocked(ContractedKeywordRepository.insertContractedKeywords).mockResolvedValueOnce([]);

      const result = await lockKeywordsAtSigning("contract-1", [], validGoal);

      expect(result.keywords).toEqual([]);
      expect(result.lockedCount).toBe(0);
    });

    it("throws on missing contractId", async () => {
      await expect(lockKeywordsAtSigning("", validKeywords, validGoal)).rejects.toThrow(
        "VALIDATION_ERROR: contractId is required"
      );
    });

    it("throws on invalid targetValue", async () => {
      await expect(
        lockKeywordsAtSigning("contract-1", validKeywords, { ...validGoal, targetValue: 0 })
      ).rejects.toThrow("VALIDATION_ERROR: goal.targetValue must be positive");
    });

    it("throws on missing targetDeadline", async () => {
      await expect(
        lockKeywordsAtSigning("contract-1", validKeywords, {
          ...validGoal,
          targetDeadline: undefined as unknown as Date,
        })
      ).rejects.toThrow("VALIDATION_ERROR: goal.targetDeadline is required");
    });
  });

  describe("getLockEventSummary", () => {
    it("returns summary with keywords, goals, and activeCount", async () => {
      const result = await getLockEventSummary("contract-1");

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("keywords");
      expect(result).toHaveProperty("goals");
      expect(result).toHaveProperty("activeCount");
    });
  });

  describe("LockEventService namespace", () => {
    it("exports lockKeywordsAtSigning", () => {
      expect(LockEventService.lockKeywordsAtSigning).toBe(lockKeywordsAtSigning);
    });

    it("exports getLockEventSummary", () => {
      expect(LockEventService.getLockEventSummary).toBe(getLockEventSummary);
    });
  });
});
