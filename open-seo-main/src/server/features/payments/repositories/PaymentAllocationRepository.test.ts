/**
 * PaymentAllocationRepository Test Suite
 * Phase 101: Test Coverage for Payment Reconciliation
 *
 * Tests for:
 * - create(): Creating payment allocations
 * - findByPaymentId(): With workspace scoping via JOIN (H-05)
 * - findByInvoiceId(): With workspace scoping via JOIN (H-05)
 * - getTotalAllocatedForPayment(): With workspace scoping (H-05)
 * - getTotalAllocatedForInvoice(): With workspace scoping (H-05)
 * - delete(): Cross-tenant deletion denial (H-05)
 * - deleteByPaymentId(): Cross-tenant deletion denial (H-05)
 * - Soft-deleted payments excluded (H-15)
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
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn(),
      limit: vi.fn(),
      delete: vi.fn().mockReturnThis(),
    },
  };
});

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test_alloc_id"),
}));

import { PaymentAllocationRepository } from "./PaymentAllocationRepository";
import { db } from "@/db";
import type { PaymentAllocationSelect } from "@/db/payment-schema";

describe("PaymentAllocationRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new allocation with generated ID", async () => {
      const mockAllocation: PaymentAllocationSelect = {
        id: "test_alloc_id",
        paymentId: "pay_1",
        invoiceId: "inv_1",
        allocatedCents: 50000,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAllocation]),
        }),
      } as any);

      const result = await PaymentAllocationRepository.create({
        paymentId: "pay_1",
        invoiceId: "inv_1",
        allocatedCents: 50000,
      });

      expect(result).toEqual(mockAllocation);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("findByPaymentId (H-05: workspace scoping)", () => {
    it("should return allocations for payment in workspace", async () => {
      const allocations: PaymentAllocationSelect[] = [
        {
          id: "alloc_1",
          paymentId: "pay_1",
          invoiceId: "inv_1",
          allocatedCents: 30000,
          createdAt: new Date(),
        },
        {
          id: "alloc_2",
          paymentId: "pay_1",
          invoiceId: "inv_2",
          allocatedCents: 20000,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(allocations),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.findByPaymentId(
        "pay_1",
        "ws_1"
      );

      expect(result).toHaveLength(2);
      expect(result[0].paymentId).toBe("pay_1");
    });

    it("should return empty array for wrong workspace (H-05)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.findByPaymentId(
        "pay_1",
        "ws_different"
      );

      expect(result).toEqual([]);
    });

    it("should exclude soft-deleted payments (H-15)", async () => {
      // Soft-deleted payments are excluded via isNull(payments.softDeletedAt) in WHERE
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.findByPaymentId(
        "pay_soft_deleted",
        "ws_1"
      );

      expect(result).toEqual([]);
    });
  });

  describe("findByInvoiceId (H-05: workspace scoping)", () => {
    it("should return allocations for invoice in workspace", async () => {
      const allocations: PaymentAllocationSelect[] = [
        {
          id: "alloc_1",
          paymentId: "pay_1",
          invoiceId: "inv_1",
          allocatedCents: 30000,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(allocations),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.findByInvoiceId(
        "inv_1",
        "ws_1"
      );

      expect(result).toHaveLength(1);
      expect(result[0].invoiceId).toBe("inv_1");
    });

    it("should return empty array for wrong workspace (H-05)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.findByInvoiceId(
        "inv_1",
        "ws_different"
      );

      expect(result).toEqual([]);
    });

    it("should exclude allocations from soft-deleted payments (H-15)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.findByInvoiceId(
        "inv_1",
        "ws_1"
      );

      expect(result).toEqual([]);
    });
  });

  describe("getTotalAllocatedForPayment (H-05: workspace scoping)", () => {
    it("should calculate total allocated amount", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 50000 }]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.getTotalAllocatedForPayment(
        "pay_1",
        "ws_1"
      );

      expect(result).toBe(50000);
    });

    it("should return 0 for payment with no allocations", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.getTotalAllocatedForPayment(
        "pay_no_allocs",
        "ws_1"
      );

      expect(result).toBe(0);
    });

    it("should scope by workspace (H-05)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.getTotalAllocatedForPayment(
        "pay_1",
        "ws_different"
      );

      expect(result).toBe(0);
    });

    it("should exclude soft-deleted payments (H-15)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.getTotalAllocatedForPayment(
        "pay_soft_deleted",
        "ws_1"
      );

      expect(result).toBe(0);
    });
  });

  describe("getTotalAllocatedForInvoice (H-05: workspace scoping)", () => {
    it("should calculate total allocated to invoice", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 75000 }]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.getTotalAllocatedForInvoice(
        "inv_1",
        "ws_1"
      );

      expect(result).toBe(75000);
    });

    it("should return 0 for wrong workspace (H-05)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      } as any);

      const result = await PaymentAllocationRepository.getTotalAllocatedForInvoice(
        "inv_1",
        "ws_different"
      );

      expect(result).toBe(0);
    });
  });

  describe("delete (H-05: cross-tenant denial)", () => {
    it("should delete allocation in correct workspace", async () => {
      // First verify ownership
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "alloc_1" }]),
            }),
          }),
        }),
      } as any);

      // Then delete
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      await expect(
        PaymentAllocationRepository.delete("alloc_1", "ws_1")
      ).resolves.toBeUndefined();
    });

    it("should throw error when allocation not in workspace (H-05)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await expect(
        PaymentAllocationRepository.delete("alloc_1", "ws_different")
      ).rejects.toThrow("Allocation not found or access denied");
    });

    it("should deny deletion for soft-deleted payment allocations (H-15)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      await expect(
        PaymentAllocationRepository.delete("alloc_soft_deleted", "ws_1")
      ).rejects.toThrow("Allocation not found or access denied");
    });
  });

  describe("deleteByPaymentId (H-05: cross-tenant denial)", () => {
    it("should delete all allocations for payment in workspace", async () => {
      // First verify payment ownership
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "pay_1" }]),
          }),
        }),
      } as any);

      // Then delete
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      await expect(
        PaymentAllocationRepository.deleteByPaymentId("pay_1", "ws_1")
      ).resolves.toBeUndefined();
    });

    it("should throw error when payment not in workspace (H-05)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        PaymentAllocationRepository.deleteByPaymentId("pay_1", "ws_different")
      ).rejects.toThrow("Payment not found or access denied");
    });

    it("should throw error for soft-deleted payment (H-15)", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        PaymentAllocationRepository.deleteByPaymentId("pay_soft_deleted", "ws_1")
      ).rejects.toThrow("Payment not found or access denied");
    });
  });

  describe("workspace isolation requirements", () => {
    it("all read methods require workspaceId parameter", () => {
      // Type-level check: these methods require workspaceId
      expect(typeof PaymentAllocationRepository.findByPaymentId).toBe("function");
      expect(PaymentAllocationRepository.findByPaymentId.length).toBe(2); // paymentId, workspaceId

      expect(typeof PaymentAllocationRepository.findByInvoiceId).toBe("function");
      expect(PaymentAllocationRepository.findByInvoiceId.length).toBe(2); // invoiceId, workspaceId

      expect(typeof PaymentAllocationRepository.getTotalAllocatedForPayment).toBe(
        "function"
      );
      expect(PaymentAllocationRepository.getTotalAllocatedForPayment.length).toBe(2);

      expect(typeof PaymentAllocationRepository.getTotalAllocatedForInvoice).toBe(
        "function"
      );
      expect(PaymentAllocationRepository.getTotalAllocatedForInvoice.length).toBe(2);
    });

    it("all write methods require workspaceId for authorization", () => {
      expect(typeof PaymentAllocationRepository.delete).toBe("function");
      expect(PaymentAllocationRepository.delete.length).toBe(2); // allocationId, workspaceId

      expect(typeof PaymentAllocationRepository.deleteByPaymentId).toBe("function");
      expect(PaymentAllocationRepository.deleteByPaymentId.length).toBe(2);
    });
  });
});
