import { describe, it, expect } from "vitest";
import {
  contractedKeywords,
  contractGoals,
  outOfScopeRequests,
  changeOrders,
  KEYWORD_LOCK_STATUS,
  FUNNEL_STAGES,
  GOAL_STATUS,
  GOAL_METRICS,
  OUT_OF_SCOPE_STATUS,
  CHANGE_ORDER_STATUS,
  FEE_TYPES,
  type ContractedKeywordSelect,
  type ContractedKeywordInsert,
  type ContractGoalSelect,
  type ContractGoalInsert,
  type OutOfScopeRequestSelect,
  type OutOfScopeRequestInsert,
  type ChangeOrderSelect,
  type ChangeOrderInsert,
} from "./keyword-lockin-schema";

describe("keyword-lockin-schema", () => {
  describe("KEYWORD_LOCK_STATUS", () => {
    it("has exactly 3 values", () => {
      expect(KEYWORD_LOCK_STATUS).toHaveLength(3);
    });

    it("includes active, completed, replaced", () => {
      expect(KEYWORD_LOCK_STATUS).toContain("active");
      expect(KEYWORD_LOCK_STATUS).toContain("completed");
      expect(KEYWORD_LOCK_STATUS).toContain("replaced");
    });
  });

  describe("FUNNEL_STAGES", () => {
    it("has exactly 3 values", () => {
      expect(FUNNEL_STAGES).toHaveLength(3);
    });

    it("includes BOFU, MOFU, TOFU", () => {
      expect(FUNNEL_STAGES).toContain("BOFU");
      expect(FUNNEL_STAGES).toContain("MOFU");
      expect(FUNNEL_STAGES).toContain("TOFU");
    });
  });

  describe("GOAL_STATUS", () => {
    it("has exactly 3 values", () => {
      expect(GOAL_STATUS).toHaveLength(3);
    });

    it("includes in_progress, achieved, missed", () => {
      expect(GOAL_STATUS).toContain("in_progress");
      expect(GOAL_STATUS).toContain("achieved");
      expect(GOAL_STATUS).toContain("missed");
    });
  });

  describe("GOAL_METRICS", () => {
    it("includes keywords_in_top_10", () => {
      expect(GOAL_METRICS).toContain("keywords_in_top_10");
    });

    it("includes traffic_increase and ranking_improvement", () => {
      expect(GOAL_METRICS).toContain("traffic_increase");
      expect(GOAL_METRICS).toContain("ranking_improvement");
    });
  });

  describe("OUT_OF_SCOPE_STATUS", () => {
    it("has exactly 4 values", () => {
      expect(OUT_OF_SCOPE_STATUS).toHaveLength(4);
    });

    it("includes pending, approved, rejected, change_order", () => {
      expect(OUT_OF_SCOPE_STATUS).toContain("pending");
      expect(OUT_OF_SCOPE_STATUS).toContain("approved");
      expect(OUT_OF_SCOPE_STATUS).toContain("rejected");
      expect(OUT_OF_SCOPE_STATUS).toContain("change_order");
    });
  });

  describe("CHANGE_ORDER_STATUS", () => {
    it("has exactly 4 values", () => {
      expect(CHANGE_ORDER_STATUS).toHaveLength(4);
    });

    it("includes draft, sent, approved, rejected", () => {
      expect(CHANGE_ORDER_STATUS).toContain("draft");
      expect(CHANGE_ORDER_STATUS).toContain("sent");
      expect(CHANGE_ORDER_STATUS).toContain("approved");
      expect(CHANGE_ORDER_STATUS).toContain("rejected");
    });
  });

  describe("FEE_TYPES", () => {
    it("has exactly 2 values", () => {
      expect(FEE_TYPES).toHaveLength(2);
    });

    it("includes one_time and monthly", () => {
      expect(FEE_TYPES).toContain("one_time");
      expect(FEE_TYPES).toContain("monthly");
    });
  });

  describe("contractedKeywords table", () => {
    it("has id column", () => {
      expect(contractedKeywords.id).toBeDefined();
    });

    it("has contractId column", () => {
      expect(contractedKeywords.contractId).toBeDefined();
    });

    it("has keywordText column", () => {
      expect(contractedKeywords.keywordText).toBeDefined();
    });

    it("has baselinePosition column", () => {
      expect(contractedKeywords.baselinePosition).toBeDefined();
    });

    it("has searchVolume column", () => {
      expect(contractedKeywords.searchVolume).toBeDefined();
    });

    it("has difficulty column", () => {
      expect(contractedKeywords.difficulty).toBeDefined();
    });

    it("has funnelStage column", () => {
      expect(contractedKeywords.funnelStage).toBeDefined();
    });

    it("has lockedAt column", () => {
      expect(contractedKeywords.lockedAt).toBeDefined();
    });

    it("has status column", () => {
      expect(contractedKeywords.status).toBeDefined();
    });

    it("has replacement tracking columns", () => {
      expect(contractedKeywords.replacedBy).toBeDefined();
      expect(contractedKeywords.replacedAt).toBeDefined();
      expect(contractedKeywords.replacementReason).toBeDefined();
    });

    it("has changeOrderId column", () => {
      expect(contractedKeywords.changeOrderId).toBeDefined();
    });
  });

  describe("contractGoals table", () => {
    it("has id column", () => {
      expect(contractGoals.id).toBeDefined();
    });

    it("has contractId column", () => {
      expect(contractGoals.contractId).toBeDefined();
    });

    it("has metric column", () => {
      expect(contractGoals.metric).toBeDefined();
    });

    it("has targetValue column", () => {
      expect(contractGoals.targetValue).toBeDefined();
    });

    it("has targetDeadline column", () => {
      expect(contractGoals.targetDeadline).toBeDefined();
    });

    it("has currentValue column", () => {
      expect(contractGoals.currentValue).toBeDefined();
    });

    it("has achievementPercent column", () => {
      expect(contractGoals.achievementPercent).toBeDefined();
    });

    it("has status column", () => {
      expect(contractGoals.status).toBeDefined();
    });

    it("has achievedAt column", () => {
      expect(contractGoals.achievedAt).toBeDefined();
    });
  });

  describe("changeOrders table", () => {
    it("has id column", () => {
      expect(changeOrders.id).toBeDefined();
    });

    it("has contractId column", () => {
      expect(changeOrders.contractId).toBeDefined();
    });

    it("has description column", () => {
      expect(changeOrders.description).toBeDefined();
    });

    it("has keywordsAdded array column", () => {
      expect(changeOrders.keywordsAdded).toBeDefined();
    });

    it("has keywordsRemoved array column", () => {
      expect(changeOrders.keywordsRemoved).toBeDefined();
    });

    it("has additionalFee column", () => {
      expect(changeOrders.additionalFee).toBeDefined();
    });

    it("has feeType column", () => {
      expect(changeOrders.feeType).toBeDefined();
    });

    it("has status column", () => {
      expect(changeOrders.status).toBeDefined();
    });

    it("has approvedAt column", () => {
      expect(changeOrders.approvedAt).toBeDefined();
    });

    it("has approvedBy column", () => {
      expect(changeOrders.approvedBy).toBeDefined();
    });
  });

  describe("outOfScopeRequests table", () => {
    it("has id column", () => {
      expect(outOfScopeRequests.id).toBeDefined();
    });

    it("has clientId column", () => {
      expect(outOfScopeRequests.clientId).toBeDefined();
    });

    it("has contractId column", () => {
      expect(outOfScopeRequests.contractId).toBeDefined();
    });

    it("has keywordText column", () => {
      expect(outOfScopeRequests.keywordText).toBeDefined();
    });

    it("has requestedBy column", () => {
      expect(outOfScopeRequests.requestedBy).toBeDefined();
    });

    it("has requestedAt column", () => {
      expect(outOfScopeRequests.requestedAt).toBeDefined();
    });

    it("has status column", () => {
      expect(outOfScopeRequests.status).toBeDefined();
    });

    it("has changeOrderId FK column", () => {
      expect(outOfScopeRequests.changeOrderId).toBeDefined();
    });

    it("has resolutionNotes column", () => {
      expect(outOfScopeRequests.resolutionNotes).toBeDefined();
    });

    it("has resolvedAt column", () => {
      expect(outOfScopeRequests.resolvedAt).toBeDefined();
    });
  });

  describe("type exports", () => {
    it("exports ContractedKeywordSelect type", () => {
      const select: ContractedKeywordSelect = {
        id: "uuid",
        contractId: "contract-1",
        keywordId: null,
        keywordText: "test keyword",
        searchVolume: 1000,
        difficulty: 50,
        funnelStage: "BOFU",
        baselinePosition: 15,
        lockedAt: new Date(),
        status: "active",
        replacedBy: null,
        replacedAt: null,
        replacementReason: null,
        changeOrderId: null,
        createdAt: new Date(),
      };
      expect(select.keywordText).toBe("test keyword");
    });

    it("exports ContractedKeywordInsert type", () => {
      const insert: ContractedKeywordInsert = {
        contractId: "contract-1",
        keywordText: "test keyword",
      };
      expect(insert.keywordText).toBe("test keyword");
    });

    it("exports ContractGoalSelect type", () => {
      const select: ContractGoalSelect = {
        id: "uuid",
        contractId: "contract-1",
        metric: "keywords_in_top_10",
        targetValue: 10,
        targetDeadline: new Date(),
        currentValue: 15,
        achievementPercent: "150.00",
        status: "achieved",
        achievedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(select.metric).toBe("keywords_in_top_10");
    });

    it("exports ContractGoalInsert type", () => {
      const insert: ContractGoalInsert = {
        contractId: "contract-1",
        targetValue: 10,
        targetDeadline: new Date(),
      };
      expect(insert.targetValue).toBe(10);
    });

    it("exports ChangeOrderSelect type", () => {
      const select: ChangeOrderSelect = {
        id: "uuid",
        contractId: "contract-1",
        description: "Add 5 keywords",
        keywordsAdded: ["kw1", "kw2"],
        keywordsRemoved: [],
        additionalFee: "500.00",
        feeType: "one_time",
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "client@example.com",
        createdAt: new Date(),
      };
      expect(select.keywordsAdded).toEqual(["kw1", "kw2"]);
    });

    it("exports ChangeOrderInsert type", () => {
      const insert: ChangeOrderInsert = {
        contractId: "contract-1",
        description: "Add keywords",
      };
      expect(insert.description).toBe("Add keywords");
    });

    it("exports OutOfScopeRequestSelect type", () => {
      const select: OutOfScopeRequestSelect = {
        id: "uuid",
        clientId: "client-uuid",
        contractId: "contract-1",
        keywordText: "new keyword",
        requestedAt: new Date(),
        requestedBy: "client@example.com",
        status: "pending",
        resolvedAt: null,
        resolutionNotes: null,
        changeOrderId: null,
        createdAt: new Date(),
      };
      expect(select.status).toBe("pending");
    });

    it("exports OutOfScopeRequestInsert type", () => {
      const insert: OutOfScopeRequestInsert = {
        clientId: "client-uuid",
        contractId: "contract-1",
        keywordText: "new keyword",
      };
      expect(insert.keywordText).toBe("new keyword");
    });
  });
});
