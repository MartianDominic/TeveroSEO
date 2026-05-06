import { describe, it, expect, vi } from "vitest";
import {
  ContractedKeywordRepository,
  insertContractedKeywords,
  getContractedKeywordsByContract,
  getActiveKeywordCount,
  getContractedKeywordById,
  updateContractedKeywordStatus,
} from "./ContractedKeywordRepository";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { id: "kw-1", contractId: "c-1", keywordText: "test", status: "active" },
        ]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "kw-1", contractId: "c-1", keywordText: "test", status: "active" },
          ]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "kw-1", status: "completed" },
          ]),
        }),
      }),
    }),
  },
}));

describe("ContractedKeywordRepository", () => {
  describe("insertContractedKeywords", () => {
    it("is a function", () => {
      expect(typeof insertContractedKeywords).toBe("function");
    });

    it("returns a promise", () => {
      const result = insertContractedKeywords([
        { contractId: "c-1", keywordText: "test" },
      ]);
      expect(result).toBeInstanceOf(Promise);
    });

    it("returns empty array for empty input", async () => {
      const result = await insertContractedKeywords([]);
      expect(result).toEqual([]);
    });
  });

  describe("getContractedKeywordsByContract", () => {
    it("is a function", () => {
      expect(typeof getContractedKeywordsByContract).toBe("function");
    });

    it("accepts contractId and options", () => {
      const result = getContractedKeywordsByContract("c-1", { status: "active" });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("getActiveKeywordCount", () => {
    it("is a function", () => {
      expect(typeof getActiveKeywordCount).toBe("function");
    });
  });

  describe("getContractedKeywordById", () => {
    it("is a function", () => {
      expect(typeof getContractedKeywordById).toBe("function");
    });
  });

  describe("updateContractedKeywordStatus", () => {
    it("is a function", () => {
      expect(typeof updateContractedKeywordStatus).toBe("function");
    });

    it("accepts status and optional replacement data", () => {
      const result = updateContractedKeywordStatus("kw-1", "replaced", {
        replacedBy: "kw-2",
        replacementReason: "Better keyword found",
      });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("ContractedKeywordRepository namespace", () => {
    it("exports all repository functions", () => {
      expect(ContractedKeywordRepository.insertContractedKeywords).toBe(insertContractedKeywords);
      expect(ContractedKeywordRepository.getContractedKeywordsByContract).toBe(getContractedKeywordsByContract);
      expect(ContractedKeywordRepository.getActiveKeywordCount).toBe(getActiveKeywordCount);
      expect(ContractedKeywordRepository.getContractedKeywordById).toBe(getContractedKeywordById);
      expect(ContractedKeywordRepository.updateContractedKeywordStatus).toBe(updateContractedKeywordStatus);
    });
  });
});
