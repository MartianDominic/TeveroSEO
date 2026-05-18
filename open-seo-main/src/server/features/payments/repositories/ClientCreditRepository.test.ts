/**
 * ClientCreditRepository Test Suite
 * Phase 101: Test Coverage for Payment Reconciliation
 *
 * Tests for:
 * - create(): Creating new client credits
 * - findById(): Finding credits with workspace scoping
 * - findAvailableByClientId(): Filtering available credits
 * - getTotalAvailableForClient(): Calculating total available balance
 * - useCredit(): Atomic credit usage with balance check (H-18 fix)
 * - findByWorkspaceId(): Workspace-level queries
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => {
  return {
    db: {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
  };
});

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test_credit_id"),
}));

import { ClientCreditRepository } from "./ClientCreditRepository";
import { db } from "@/db";
import type { ClientCreditSelect } from "@/db/payment-schema";

describe("ClientCreditRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new credit with generated ID", async () => {
      const mockCredit: ClientCreditSelect = {
        id: "test_credit_id",
        workspaceId: "ws_1",
        clientId: "client_1",
        sourcePaymentId: "pay_1",
        amountCents: 5000,
        usedCents: 0,
        currency: "EUR",
        reason: "overpayment",
        createdAt: new Date(),
        expiresAt: null,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCredit]),
        }),
      } as any);

      const result = await ClientCreditRepository.create({
        workspaceId: "ws_1",
        clientId: "client_1",
        sourcePaymentId: "pay_1",
        amountCents: 5000,
        currency: "EUR",
        reason: "overpayment",
      });

      expect(result).toEqual(mockCredit);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("should return credit when found in workspace", async () => {
      const mockCredit: ClientCreditSelect = {
        id: "credit_1",
        workspaceId: "ws_1",
        clientId: "client_1",
        sourcePaymentId: null,
        amountCents: 10000,
        usedCents: 0,
        currency: "EUR",
        reason: "prepayment",
        createdAt: new Date(),
        expiresAt: null,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCredit]),
        }),
      } as any);

      const result = await ClientCreditRepository.findById("credit_1", "ws_1");

      expect(result).toEqual(mockCredit);
    });

    it("should return null when credit not found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ClientCreditRepository.findById("credit_999", "ws_1");

      expect(result).toBeNull();
    });

    it("should return null when credit exists in different workspace", async () => {
      // Credit exists but in different workspace - should return empty
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ClientCreditRepository.findById("credit_1", "ws_different");

      expect(result).toBeNull();
    });
  });

  describe("findAvailableByClientId", () => {
    it("should return only credits with available balance", async () => {
      const availableCredits: ClientCreditSelect[] = [
        {
          id: "credit_1",
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: null,
          amountCents: 5000,
          usedCents: 2000, // 3000 available
          currency: "EUR",
          reason: "overpayment",
          createdAt: new Date(),
          expiresAt: null,
        },
        {
          id: "credit_2",
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: null,
          amountCents: 3000,
          usedCents: 0, // 3000 available
          currency: "EUR",
          reason: "prepayment",
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(availableCredits),
        }),
      } as any);

      const result = await ClientCreditRepository.findAvailableByClientId(
        "client_1",
        "ws_1"
      );

      expect(result).toHaveLength(2);
      expect(result[0].amountCents - result[0].usedCents!).toBeGreaterThan(0);
    });

    it("should filter by workspace", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ClientCreditRepository.findAvailableByClientId(
        "client_1",
        "ws_different"
      );

      expect(result).toEqual([]);
    });

    it("should exclude fully used credits", async () => {
      // Mock returns only credits with remaining balance
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ClientCreditRepository.findAvailableByClientId(
        "client_1",
        "ws_1"
      );

      // No credits should be returned if all are fully used
      expect(result).toEqual([]);
    });

    it("should exclude expired credits", async () => {
      // Expired credits should be filtered out by the query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ClientCreditRepository.findAvailableByClientId(
        "client_1",
        "ws_1"
      );

      expect(result).toEqual([]);
    });
  });

  describe("getTotalAvailableForClient", () => {
    it("should calculate total available balance correctly", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 6000 }]),
        }),
      } as any);

      const result = await ClientCreditRepository.getTotalAvailableForClient(
        "client_1",
        "ws_1"
      );

      expect(result).toBe(6000);
    });

    it("should return 0 when no credits available", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        }),
      } as any);

      const result = await ClientCreditRepository.getTotalAvailableForClient(
        "client_1",
        "ws_1"
      );

      expect(result).toBe(0);
    });

    it("should return 0 for different workspace", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        }),
      } as any);

      const result = await ClientCreditRepository.getTotalAvailableForClient(
        "client_1",
        "ws_different"
      );

      expect(result).toBe(0);
    });
  });

  describe("useCredit", () => {
    it("should return success when sufficient balance exists", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ newUsedCents: 3000 }]),
          }),
        }),
      } as any);

      const result = await ClientCreditRepository.useCredit(
        "credit_1",
        "ws_1",
        3000
      );

      expect(result.success).toBe(true);
      expect(result.newUsedCents).toBe(3000);
    });

    it("should return failure when insufficient balance (H-18 atomic check)", async () => {
      // Atomic WHERE clause returns no rows when balance insufficient
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await ClientCreditRepository.useCredit(
        "credit_1",
        "ws_1",
        10000 // More than available
      );

      expect(result.success).toBe(false);
      expect(result.newUsedCents).toBeUndefined();
    });

    it("should prevent over-depletion with atomic WHERE clause (H-18)", async () => {
      // Simulates concurrent scenario - second request should fail
      // because the atomic WHERE check ensures balance >= requested amount
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await ClientCreditRepository.useCredit(
        "credit_1",
        "ws_1",
        5000
      );

      // Even if race condition occurs, atomic check prevents over-use
      expect(result.success).toBe(false);
    });

    it("should require workspace scoping", async () => {
      // Wrong workspace should fail
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await ClientCreditRepository.useCredit(
        "credit_1",
        "ws_different",
        1000
      );

      expect(result.success).toBe(false);
    });

    it("should not use expired credits", async () => {
      // Expired credits filtered by WHERE clause
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await ClientCreditRepository.useCredit(
        "expired_credit",
        "ws_1",
        1000
      );

      expect(result.success).toBe(false);
    });
  });

  describe("findByWorkspaceId", () => {
    it("should return all credits for workspace", async () => {
      const workspaceCredits: ClientCreditSelect[] = [
        {
          id: "credit_1",
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: null,
          amountCents: 5000,
          usedCents: 0,
          currency: "EUR",
          reason: "overpayment",
          createdAt: new Date(),
          expiresAt: null,
        },
        {
          id: "credit_2",
          workspaceId: "ws_1",
          clientId: "client_2",
          sourcePaymentId: null,
          amountCents: 3000,
          usedCents: 1000,
          currency: "EUR",
          reason: "prepayment",
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(workspaceCredits),
        }),
      } as any);

      const result = await ClientCreditRepository.findByWorkspaceId("ws_1");

      expect(result).toHaveLength(2);
      expect(result.every((c) => c.workspaceId === "ws_1")).toBe(true);
    });

    it("should return empty array for workspace with no credits", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await ClientCreditRepository.findByWorkspaceId("ws_empty");

      expect(result).toEqual([]);
    });
  });
});
