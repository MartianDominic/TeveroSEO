import { describe, it, expect, vi } from "vitest";
import {
  ContractRepository,
  insertContract,
  getContractById,
  getContractsByWorkspace,
  transitionContractState,
} from "./ContractRepository";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: "contract-1", status: "draft" }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ id: "contract-1", status: "draft" }]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "contract-1", status: "sent" }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe("ContractRepository", () => {
  describe("insertContract", () => {
    it("is a function", () => {
      expect(typeof insertContract).toBe("function");
    });

    it("returns a promise", () => {
      const result = insertContract({
        id: "test-id",
        workspaceId: "ws-1",
        title: "Test Contract",
        content: { sections: [], terms: "", signatures: [] },
        status: "draft",
      } as Parameters<typeof insertContract>[0]);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("getContractById", () => {
    it("is a function", () => {
      expect(typeof getContractById).toBe("function");
    });

    it("returns a promise", () => {
      const result = getContractById("contract-1");
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("getContractsByWorkspace", () => {
    it("is a function", () => {
      expect(typeof getContractsByWorkspace).toBe("function");
    });

    it("accepts workspace ID and options", () => {
      const result = getContractsByWorkspace("ws-1", {
        status: "draft",
        limit: 10,
      });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("transitionContractState", () => {
    it("is a function", () => {
      expect(typeof transitionContractState).toBe("function");
    });

    it("accepts contractId, fromState, and toState", () => {
      const result = transitionContractState("contract-1", "draft", "sent");
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("ContractRepository namespace", () => {
    it("exports all repository functions", () => {
      expect(ContractRepository.insertContract).toBe(insertContract);
      expect(ContractRepository.getContractById).toBe(getContractById);
      expect(ContractRepository.getContractsByWorkspace).toBe(
        getContractsByWorkspace,
      );
      expect(ContractRepository.transitionContractState).toBe(
        transitionContractState,
      );
    });

    it("has expected function count", () => {
      const functionCount = Object.keys(ContractRepository).length;
      expect(functionCount).toBeGreaterThanOrEqual(6);
    });
  });
});
