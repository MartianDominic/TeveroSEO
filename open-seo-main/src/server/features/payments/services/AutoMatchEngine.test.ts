/**
 * AutoMatchEngine Test Suite
 * Phase 101-02: Payment Reconciliation
 *
 * Tests the confidence-based auto-matching engine with priority cascade:
 * 1. Invoice # in memo -> 100% confidence
 * 2. Exact amount + client email -> 95%
 * 3. Exact amount + date within 7 days -> 85%
 * 4. Fuzzy amount (+-EUR0.50) + client name -> 70%
 * 5. No match -> 0% (review queue)
 *
 * Query flow per payment fields:
 * - memo set: memo query runs
 * - payerEmail set: email query runs
 * - receivedAt always set: date query always runs
 * - payerName set: name query runs
 * - finally: suggestions query always runs if no match
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database before importing AutoMatchEngine
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../repositories/PaymentRepository", () => ({
  PaymentRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

import { AutoMatchEngine } from "./AutoMatchEngine";
import { db } from "@/db";
import { PaymentRepository } from "../repositories/PaymentRepository";
import type { PaymentSelect } from "@/db/payment-schema";

describe("AutoMatchEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("autoMatch", () => {
    it("should return 100% confidence for invoice # in memo (INV-042)", async () => {
      // Only memo query runs, returns match immediately
      const mockInvoice = { id: "inv_1", invoiceNumber: "INV-042", totalCents: 35000 };
      vi.mocked(db.limit).mockResolvedValueOnce([mockInvoice]);

      const payment = {
        id: "pay_1",
        workspaceId: "ws_1",
        grossAmountCents: 35000,
        memo: "Payment for INV-042",
        receivedAt: new Date(),
        provider: "stripe",
        netAmountCents: 35000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(100);
      expect(result.matchType).toBe("invoice_memo");
      expect(result.invoiceId).toBe("inv_1");
    });

    it("should return 100% confidence for invoice # in memo (#042)", async () => {
      const mockInvoice = { id: "inv_2", invoiceNumber: "042", totalCents: 25000 };
      vi.mocked(db.limit).mockResolvedValueOnce([mockInvoice]);

      const payment = {
        id: "pay_2",
        workspaceId: "ws_1",
        grossAmountCents: 25000,
        memo: "Invoice #042 payment",
        receivedAt: new Date(),
        provider: "revolut",
        netAmountCents: 25000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(100);
      expect(result.matchType).toBe("invoice_memo");
    });

    it("should return 95% confidence for exact amount + client email", async () => {
      // Payment has payerEmail but NO memo
      // Query flow: email query (match)
      const mockInvoice = { id: "inv_3", invoiceNumber: "INV-043", totalCents: 50000 };
      vi.mocked(db.limit).mockResolvedValueOnce([{ invoice: mockInvoice }]);

      const payment = {
        id: "pay_3",
        workspaceId: "ws_1",
        grossAmountCents: 50000,
        payerEmail: "client@example.com",
        // NO memo - skips memo query
        receivedAt: new Date(),
        provider: "stripe",
        netAmountCents: 50000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(95);
      expect(result.matchType).toBe("exact_amount_email");
      expect(result.invoiceId).toBe("inv_3");
    });

    it("should return 85% confidence for exact amount + date within 7 days", async () => {
      // Payment has NO memo, NO payerEmail
      // Query flow: date query (match)
      const mockInvoice = { id: "inv_4", invoiceNumber: "INV-044", totalCents: 75000 };
      vi.mocked(db.limit).mockResolvedValueOnce([mockInvoice]);

      const payment = {
        id: "pay_4",
        workspaceId: "ws_1",
        grossAmountCents: 75000,
        // NO memo, NO payerEmail
        receivedAt: new Date(),
        provider: "bank_transfer",
        netAmountCents: 75000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(85);
      expect(result.matchType).toBe("exact_amount_date");
      expect(result.invoiceId).toBe("inv_4");
    });

    it("should return 70% confidence for fuzzy amount + client name", async () => {
      // Payment has payerName but NO memo, NO payerEmail
      // Query flow: date query (no match), name query (match)
      vi.mocked(db.limit).mockResolvedValueOnce([]); // date query - no match
      const mockInvoice = { id: "inv_5", invoiceNumber: "INV-045", totalCents: 10025 }; // Within 50 cents
      vi.mocked(db.limit).mockResolvedValueOnce([{ invoice: mockInvoice }]); // name query - match

      const payment = {
        id: "pay_5",
        workspaceId: "ws_1",
        grossAmountCents: 10000,
        payerName: "ACME Corp",
        // NO memo, NO payerEmail
        receivedAt: new Date(),
        provider: "revolut",
        netAmountCents: 10000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(70);
      expect(result.matchType).toBe("fuzzy_amount_name");
      expect(result.invoiceId).toBe("inv_5");
    });

    it("should return 0% confidence with suggestions when no match found", async () => {
      // Payment has NO memo, NO payerEmail, NO payerName
      // Query flow: date query (no match), suggestions query (returns candidates)
      vi.mocked(db.limit).mockResolvedValueOnce([]); // date query - no match
      // Suggestions query returns candidates
      const suggestions = [
        { id: "inv_6", invoiceNumber: "INV-050", totalCents: 9500, sentAt: new Date() },
        { id: "inv_7", invoiceNumber: "INV-051", totalCents: 10500, sentAt: new Date() },
      ];
      vi.mocked(db.limit).mockResolvedValueOnce(suggestions);

      const payment = {
        id: "pay_6",
        workspaceId: "ws_1",
        grossAmountCents: 10000,
        // NO memo, NO payerEmail, NO payerName
        receivedAt: new Date(),
        provider: "cash",
        netAmountCents: 10000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(0);
      expect(result.matchType).toBe("none");
      expect(result.invoiceId).toBeNull();
      expect(result.suggestedInvoices).toBeDefined();
      expect(result.suggestedInvoices!.length).toBe(2);
    });

    it("should skip email match if amount/email query fails and try date match", async () => {
      // Payment has payerEmail but email query finds nothing
      // Query flow: email query (no match), date query (match)
      vi.mocked(db.limit).mockResolvedValueOnce([]); // email query - no match
      const mockInvoice = { id: "inv_8", invoiceNumber: "INV-048", totalCents: 30000 };
      vi.mocked(db.limit).mockResolvedValueOnce([mockInvoice]); // date query - match

      const payment = {
        id: "pay_8",
        workspaceId: "ws_1",
        grossAmountCents: 30000,
        payerEmail: "client@example.com",
        // NO memo
        receivedAt: new Date(),
        provider: "stripe",
        netAmountCents: 30000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const result = await AutoMatchEngine.autoMatch(payment);

      expect(result.confidence).toBe(85);
      expect(result.matchType).toBe("exact_amount_date");
    });
  });

  describe("processPayment", () => {
    it("should auto-match and update status to 'matched' for >= 90% confidence", async () => {
      const mockPayment = {
        id: "pay_7",
        workspaceId: "ws_1",
        memo: "INV-042",
        grossAmountCents: 50000,
        receivedAt: new Date(),
        provider: "stripe",
        netAmountCents: 50000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const mockInvoice = { id: "inv_9", invoiceNumber: "INV-042", totalCents: 50000 };

      vi.mocked(PaymentRepository.findById).mockResolvedValue(mockPayment);
      vi.mocked(db.limit).mockResolvedValueOnce([mockInvoice]); // memo query - match
      vi.mocked(PaymentRepository.updateStatus).mockResolvedValue({
        ...mockPayment,
        status: "matched",
        matchedInvoiceId: "inv_9",
        confidence: 100,
        matchType: "invoice_memo",
      });

      await AutoMatchEngine.processPayment("pay_7", "ws_1");

      expect(PaymentRepository.updateStatus).toHaveBeenCalledWith(
        "pay_7",
        "ws_1",
        "matched",
        expect.objectContaining({ confidence: 100, matchType: "invoice_memo" })
      );
    });

    it("should set status to 'review' for < 90% confidence", async () => {
      const mockPayment = {
        id: "pay_9",
        workspaceId: "ws_1",
        payerName: "ACME",
        // NO memo, NO payerEmail
        grossAmountCents: 10000,
        receivedAt: new Date(),
        provider: "revolut",
        netAmountCents: 10000,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentSelect;

      const mockInvoice = { id: "inv_10", invoiceNumber: "INV-046", totalCents: 10025 };

      vi.mocked(PaymentRepository.findById).mockResolvedValue(mockPayment);
      // Query flow: date query (no match), name query (match at 70%)
      vi.mocked(db.limit).mockResolvedValueOnce([]); // date query - no match
      vi.mocked(db.limit).mockResolvedValueOnce([{ invoice: mockInvoice }]); // name query - match
      vi.mocked(PaymentRepository.updateStatus).mockResolvedValue({
        ...mockPayment,
        status: "review",
        matchedInvoiceId: "inv_10",
        confidence: 70,
        matchType: "fuzzy_amount_name",
      });

      await AutoMatchEngine.processPayment("pay_9", "ws_1");

      expect(PaymentRepository.updateStatus).toHaveBeenCalledWith(
        "pay_9",
        "ws_1",
        "review",
        expect.objectContaining({ confidence: 70, matchType: "fuzzy_amount_name" })
      );
    });

    it("should throw error when payment not found", async () => {
      vi.mocked(PaymentRepository.findById).mockResolvedValue(null);

      await expect(AutoMatchEngine.processPayment("pay_999", "ws_1")).rejects.toThrow(
        "Payment not found: pay_999"
      );
    });
  });
});
