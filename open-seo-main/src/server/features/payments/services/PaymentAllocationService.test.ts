/**
 * PaymentAllocationService Test Suite
 * Phase 101-02: Payment Reconciliation
 *
 * Tests for:
 * - allocateToInvoice: Single payment -> single invoice
 * - allocateToMultiple: Single payment -> multiple invoices (split payment)
 * - createOverpaymentCredit: Excess payment -> client credit
 * - applyCreditsToInvoice: Use client credits to pay invoice
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock repositories
vi.mock("../repositories/PaymentAllocationRepository", () => ({
  PaymentAllocationRepository: {
    create: vi.fn(),
    findByPaymentId: vi.fn(),
    getTotalAllocatedForPayment: vi.fn(),
    getTotalAllocatedForInvoice: vi.fn(),
    deleteByPaymentId: vi.fn(),
  },
}));

vi.mock("../repositories/ClientCreditRepository", () => ({
  ClientCreditRepository: {
    create: vi.fn(),
    findAvailableByClientId: vi.fn(),
    getTotalAvailableForClient: vi.fn(),
    useCredit: vi.fn(),
  },
}));

vi.mock("../repositories/PaymentRepository", () => ({
  PaymentRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

// Store mock payment data for transaction tests
let mockPaymentForTx: any = null;
let mockAllocationSumForTx = 0;

vi.mock("@/db", () => {
  const createMockTx = () => {
    let currentOperation = "";

    const tx: any = {
      select: vi.fn().mockImplementation((fields?: any) => {
        currentOperation = fields ? "selectSum" : "selectPayment";
        return tx;
      }),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        // For selectSum, resolve immediately with the sum
        if (currentOperation === "selectSum") {
          return Promise.resolve([{ total: mockAllocationSumForTx }]);
        }
        return tx;
      }),
      for: vi.fn().mockImplementation(() => {
        // For selectPayment with FOR UPDATE, resolve with payment
        return Promise.resolve(mockPaymentForTx ? [mockPaymentForTx] : []);
      }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockImplementation(() => {
        // Return a mock allocation
        return Promise.resolve([
          {
            id: "alloc_1",
            paymentId: mockPaymentForTx?.id || "pay_1",
            invoiceId: "inv_1",
            allocatedCents: 50000,
            createdAt: new Date(),
          },
        ]);
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    return tx;
  };

  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = createMockTx();
        return callback(tx);
      }),
    },
  };
});

// Helper to set mock data for transaction tests
export const setMockPaymentForTx = (payment: any, allocSum = 0) => {
  mockPaymentForTx = payment;
  mockAllocationSumForTx = allocSum;
};

import { PaymentAllocationService } from "./PaymentAllocationService";
import { PaymentAllocationRepository } from "../repositories/PaymentAllocationRepository";
import { ClientCreditRepository } from "../repositories/ClientCreditRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import type { PaymentSelect } from "@/db/payment-schema";

describe("PaymentAllocationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("allocateToInvoice", () => {
    it("should allocate full payment to single invoice", async () => {
      const payment = {
        id: "pay_1",
        workspaceId: "ws_1",
        netAmountCents: 50000, // EUR 500.00
        status: "matched",
      } as PaymentSelect;

      // Set up transaction mock data
      setMockPaymentForTx(payment, 0); // No prior allocations

      const result = await PaymentAllocationService.allocateToInvoice(
        "pay_1",
        "inv_1",
        50000,
        "ws_1"
      );

      expect(result.allocation).toBeDefined();
      expect(result.allocation.allocatedCents).toBe(50000);
      expect(result.remainingUnallocated).toBe(0);
    });

    it("should throw if payment not found", async () => {
      // Set up transaction mock with no payment
      setMockPaymentForTx(null, 0);

      await expect(
        PaymentAllocationService.allocateToInvoice("pay_999", "inv_1", 50000, "ws_1")
      ).rejects.toThrow("Payment not found: pay_999");
    });

    it("should throw if allocation exceeds unallocated balance", async () => {
      const payment = {
        id: "pay_1",
        workspaceId: "ws_1",
        netAmountCents: 50000,
        status: "matched",
      } as PaymentSelect;

      // Set up transaction mock with 30000 already allocated
      setMockPaymentForTx(payment, 30000);

      await expect(
        PaymentAllocationService.allocateToInvoice("pay_1", "inv_1", 30000, "ws_1") // Trying to allocate 300 more
      ).rejects.toThrow("Cannot allocate 30000 cents"); // Only 20000 unallocated
    });
  });

  describe("allocateToMultiple", () => {
    it("should split payment across multiple invoices using transaction", async () => {
      // RACE-01 FIX TEST: allocateToMultiple now uses db.transaction
      const payment = {
        id: "pay_2",
        workspaceId: "ws_1",
        netAmountCents: 100000, // EUR 1000.00
        status: "matched",
      } as PaymentSelect;

      // Set up transaction mock data (same as allocateToInvoice)
      setMockPaymentForTx(payment, 0); // No prior allocations

      const result = await PaymentAllocationService.allocateToMultiple(
        "pay_2",
        [
          { invoiceId: "inv_1", amountCents: 60000 },
          { invoiceId: "inv_2", amountCents: 40000 },
        ],
        "ws_1"
      );

      // Verify transaction was used (db.transaction is called)
      const { db } = await import("@/db");
      expect(db.transaction).toHaveBeenCalled();

      // Verify allocations created
      expect(result.allocations).toBeDefined();
      expect(result.remainingUnallocated).toBe(0);
    });

    it("should throw if payment not found in transaction", async () => {
      // Set up transaction mock with no payment
      setMockPaymentForTx(null, 0);

      await expect(
        PaymentAllocationService.allocateToMultiple(
          "pay_999",
          [{ invoiceId: "inv_1", amountCents: 50000 }],
          "ws_1"
        )
      ).rejects.toThrow("Payment not found: pay_999");
    });

    it("should throw if total allocations exceed payment amount", async () => {
      const payment = {
        id: "pay_2",
        workspaceId: "ws_1",
        netAmountCents: 50000,
        status: "matched",
      } as PaymentSelect;

      // Set up transaction mock
      setMockPaymentForTx(payment, 0);

      await expect(
        PaymentAllocationService.allocateToMultiple(
          "pay_2",
          [
            { invoiceId: "inv_1", amountCents: 30000 },
            { invoiceId: "inv_2", amountCents: 30000 }, // Total 60000 > 50000
          ],
          "ws_1"
        )
      ).rejects.toThrow("Total allocation 60000 exceeds unallocated balance 50000");
    });

    it("should use FOR UPDATE lock to prevent concurrent modifications", async () => {
      // RACE-01 FIX TEST: Verify FOR UPDATE lock is used
      const payment = {
        id: "pay_2",
        workspaceId: "ws_1",
        netAmountCents: 100000,
        status: "matched",
      } as PaymentSelect;

      setMockPaymentForTx(payment, 0);

      await PaymentAllocationService.allocateToMultiple(
        "pay_2",
        [{ invoiceId: "inv_1", amountCents: 50000 }],
        "ws_1"
      );

      // The mock tx.for("update") is called within the transaction
      // This is verified by the transaction completing successfully
      // with the mock that returns payment only when .for() is called
      const { db } = await import("@/db");
      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe("createOverpaymentCredit", () => {
    it("should create credit for overpayment amount", async () => {
      const payment = {
        id: "pay_3",
        workspaceId: "ws_1",
        netAmountCents: 55000, // EUR 550.00
        matchedInvoiceId: "inv_1",
        status: "matched",
      } as PaymentSelect;

      // Invoice total is 50000, payment is 55000, overpayment = 5000
      vi.mocked(PaymentRepository.findById).mockResolvedValue(payment);
      vi.mocked(PaymentAllocationRepository.getTotalAllocatedForPayment).mockResolvedValue(50000); // Allocated to invoice
      vi.mocked(ClientCreditRepository.create).mockResolvedValue({
        id: "credit_1",
        workspaceId: "ws_1",
        clientId: "client_1",
        sourcePaymentId: "pay_3",
        amountCents: 5000,
        usedCents: 0,
        currency: "EUR",
        reason: "overpayment",
        createdAt: new Date(),
        expiresAt: null,
      });

      const result = await PaymentAllocationService.createOverpaymentCredit(
        "pay_3",
        "client_1",
        "ws_1"
      );

      expect(result.credit).toBeDefined();
      expect(result.credit.amountCents).toBe(5000);
      expect(result.credit.reason).toBe("overpayment");
      expect(ClientCreditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: "pay_3",
          amountCents: 5000,
          reason: "overpayment",
        })
      );
    });

    it("should return null if no overpayment exists", async () => {
      const payment = {
        id: "pay_3",
        workspaceId: "ws_1",
        netAmountCents: 50000,
        status: "matched",
      } as PaymentSelect;

      vi.mocked(PaymentRepository.findById).mockResolvedValue(payment);
      vi.mocked(PaymentAllocationRepository.getTotalAllocatedForPayment).mockResolvedValue(50000); // Fully allocated

      const result = await PaymentAllocationService.createOverpaymentCredit(
        "pay_3",
        "client_1",
        "ws_1"
      );

      expect(result.credit).toBeNull();
      expect(ClientCreditRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("applyCreditsToInvoice", () => {
    it("should apply available credits to invoice", async () => {
      const credits = [
        {
          id: "credit_1",
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: "pay_1",
          amountCents: 3000,
          usedCents: 0,
          currency: "EUR",
          reason: "overpayment",
          createdAt: new Date(),
          expiresAt: null,
        },
        {
          id: "credit_2",
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: "pay_2",
          amountCents: 2000,
          usedCents: 0,
          currency: "EUR",
          reason: "overpayment",
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      vi.mocked(ClientCreditRepository.findAvailableByClientId).mockResolvedValue(credits);
      vi.mocked(ClientCreditRepository.useCredit)
        .mockResolvedValueOnce({ success: true, newUsedCents: 3000 })
        .mockResolvedValueOnce({ success: true, newUsedCents: 1000 });

      const result = await PaymentAllocationService.applyCreditsToInvoice(
        "client_1",
        "inv_1",
        4000, // Need to cover 4000 cents
        "ws_1"
      );

      expect(result.totalApplied).toBe(4000);
      expect(result.creditsUsed).toHaveLength(2);
      // First credit used fully (3000), second credit used partially (1000)
      expect(result.creditsUsed[0].amountUsed).toBe(3000);
      expect(result.creditsUsed[1].amountUsed).toBe(1000);
    });

    it("should apply partial credits if insufficient balance", async () => {
      const credits = [
        {
          id: "credit_1",
          workspaceId: "ws_1",
          clientId: "client_1",
          sourcePaymentId: "pay_1",
          amountCents: 2000,
          usedCents: 0,
          currency: "EUR",
          reason: "overpayment",
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      vi.mocked(ClientCreditRepository.findAvailableByClientId).mockResolvedValue(credits);
      vi.mocked(ClientCreditRepository.useCredit).mockResolvedValueOnce({
        success: true,
        newUsedCents: 2000,
      });

      const result = await PaymentAllocationService.applyCreditsToInvoice(
        "client_1",
        "inv_1",
        5000, // Need 5000, only have 2000
        "ws_1"
      );

      expect(result.totalApplied).toBe(2000);
      expect(result.remainingToCover).toBe(3000);
    });

    it("should return zero if no credits available", async () => {
      vi.mocked(ClientCreditRepository.findAvailableByClientId).mockResolvedValue([]);

      const result = await PaymentAllocationService.applyCreditsToInvoice(
        "client_1",
        "inv_1",
        5000,
        "ws_1"
      );

      expect(result.totalApplied).toBe(0);
      expect(result.creditsUsed).toHaveLength(0);
      expect(result.remainingToCover).toBe(5000);
    });
  });
});
