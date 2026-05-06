import { describe, it, expect, vi } from "vitest";
import {
  OutOfScopeService,
  detectOutOfScope,
  flagOutOfScopeRequest,
  checkAndFlagIfOutOfScope,
  approveRequestDirect,
  rejectRequest,
  resolveWithChangeOrder,
  getPendingSummary,
} from "./OutOfScopeService";

// Mock repositories
vi.mock("../repositories/ContractedKeywordRepository", () => ({
  ContractedKeywordRepository: {
    getContractedKeywordsByContract: vi.fn().mockResolvedValue([
      { id: "kw-1", keywordText: "contracted keyword", status: "active" },
      { id: "kw-2", keywordText: "another keyword", status: "active" },
    ]),
  },
}));

vi.mock("../repositories/OutOfScopeRepository", () => ({
  OutOfScopeRepository: {
    insertOutOfScopeRequest: vi.fn().mockResolvedValue({
      id: "req-1",
      keywordText: "out of scope keyword",
      status: "pending",
    }),
    getRequestsByContract: vi.fn().mockResolvedValue([
      { id: "req-1", keywordText: "pending keyword", status: "pending" },
    ]),
    getRequestById: vi.fn().mockResolvedValue({
      id: "req-1",
      keywordText: "out of scope keyword",
      status: "pending",
    }),
    resolveRequest: vi.fn().mockResolvedValue({
      id: "req-1",
      status: "approved",
    }),
  },
}));

vi.mock("../repositories/ChangeOrderRepository", () => ({
  ChangeOrderRepository: {
    insertChangeOrder: vi.fn().mockResolvedValue({
      id: "co-1",
      description: "Add keywords",
      status: "draft",
    }),
  },
}));

describe("OutOfScopeService", () => {
  describe("detectOutOfScope", () => {
    it("returns isOutOfScope=true for non-contracted keyword", async () => {
      const result = await detectOutOfScope("contract-1", "new keyword");

      expect(result.isOutOfScope).toBe(true);
      expect(result.keywordText).toBe("new keyword");
    });

    it("returns isOutOfScope=false for contracted keyword", async () => {
      const result = await detectOutOfScope("contract-1", "contracted keyword");

      expect(result.isOutOfScope).toBe(false);
    });

    it("returns contracted keywords list", async () => {
      const result = await detectOutOfScope("contract-1", "test");

      expect(result.contractedKeywords).toContain("contracted keyword");
      expect(result.contractedKeywords).toContain("another keyword");
    });

    it("handles case-insensitive comparison", async () => {
      const result = await detectOutOfScope("contract-1", "CONTRACTED KEYWORD");

      expect(result.isOutOfScope).toBe(false);
    });
  });

  describe("flagOutOfScopeRequest", () => {
    it("creates request with pending status", async () => {
      const result = await flagOutOfScopeRequest(
        "client-1",
        "contract-1",
        "new keyword",
        "user@example.com"
      );

      expect(result.status).toBe("pending");
      expect(result.keywordText).toBe("out of scope keyword");
    });
  });

  describe("checkAndFlagIfOutOfScope", () => {
    it("returns null for contracted keyword", async () => {
      const result = await checkAndFlagIfOutOfScope(
        "client-1",
        "contract-1",
        "contracted keyword"
      );

      expect(result).toBeNull();
    });

    it("flags non-contracted keyword", async () => {
      const result = await checkAndFlagIfOutOfScope(
        "client-1",
        "contract-1",
        "new keyword"
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe("pending");
    });
  });

  describe("approveRequestDirect", () => {
    it("updates status to approved", async () => {
      const result = await approveRequestDirect("req-1", "Approved by manager");

      expect(result?.status).toBe("approved");
    });
  });

  describe("rejectRequest", () => {
    it("updates status to rejected", async () => {
      const { OutOfScopeRepository } = await import("../repositories/OutOfScopeRepository");
      vi.mocked(OutOfScopeRepository.resolveRequest).mockResolvedValueOnce({
        id: "req-1",
        status: "rejected",
      } as never);

      const result = await rejectRequest("req-1", "Not in scope");

      expect(result?.status).toBe("rejected");
    });
  });

  describe("resolveWithChangeOrder", () => {
    it("creates change order and links to request", async () => {
      const result = await resolveWithChangeOrder("req-1", "contract-1", {
        description: "Add 3 keywords",
        keywordsAdded: ["kw1", "kw2", "kw3"],
        additionalFee: "300.00",
        feeType: "one_time",
      });

      expect(result).toHaveProperty("request");
      expect(result).toHaveProperty("changeOrder");
      expect(result.changeOrder.description).toBe("Add keywords");
    });
  });

  describe("getPendingSummary", () => {
    it("returns pending count and requests", async () => {
      const result = await getPendingSummary("contract-1");

      expect(result.pendingCount).toBe(1);
      expect(result.requests).toHaveLength(1);
    });
  });

  describe("OutOfScopeService namespace", () => {
    it("exports all service functions", () => {
      expect(OutOfScopeService.detectOutOfScope).toBe(detectOutOfScope);
      expect(OutOfScopeService.flagOutOfScopeRequest).toBe(flagOutOfScopeRequest);
      expect(OutOfScopeService.checkAndFlagIfOutOfScope).toBe(checkAndFlagIfOutOfScope);
      expect(OutOfScopeService.approveRequestDirect).toBe(approveRequestDirect);
      expect(OutOfScopeService.rejectRequest).toBe(rejectRequest);
      expect(OutOfScopeService.resolveWithChangeOrder).toBe(resolveWithChangeOrder);
      expect(OutOfScopeService.getPendingSummary).toBe(getPendingSummary);
    });
  });
});
