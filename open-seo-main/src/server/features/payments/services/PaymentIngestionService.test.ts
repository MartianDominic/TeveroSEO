/**
 * PaymentIngestionService Tests
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * TDD tests for payment normalization from:
 * - Stripe (PaymentIntent webhook)
 * - Revolut (Transaction API polling)
 * - Manual entry (bank transfer, cash)
 *
 * Tests idempotency (duplicate ingestion returns existing record).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the repository before importing the service
vi.mock("../repositories/PaymentRepository", () => ({
  PaymentRepository: {
    create: vi.fn(),
    findByExternalId: vi.fn(),
  },
}));

// Mock the logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PaymentIngestionService } from "./PaymentIngestionService";
import { PaymentRepository } from "../repositories/PaymentRepository";

describe("PaymentIngestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ingestFromStripe", () => {
    it("should normalize Stripe payment intent to payment entity", async () => {
      const mockPayment = {
        id: "pay_1",
        workspaceId: "ws_1",
        provider: "stripe",
        externalId: "pi_abc123",
        grossAmountCents: 35000,
        providerFeeCents: 0,
        netAmountCents: 35000,
        currency: "EUR",
        payerEmail: "client@example.com",
        memo: "INV-042",
        status: "pending",
        receivedAt: new Date("2024-05-14T00:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(PaymentRepository.findByExternalId).mockResolvedValue(null);
      vi.mocked(PaymentRepository.create).mockResolvedValue(mockPayment as any);

      const stripeIntent = {
        id: "pi_abc123",
        amount: 35000,
        amount_received: 35000,
        currency: "eur",
        receipt_email: "client@example.com",
        description: "INV-042",
        created: 1715644800, // 2024-05-14
      };

      const result = await PaymentIngestionService.ingestFromStripe(
        stripeIntent,
        "ws_1"
      );

      expect(PaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "stripe",
          externalId: "pi_abc123",
          grossAmountCents: 35000,
          currency: "EUR",
          payerEmail: "client@example.com",
          memo: "INV-042",
        })
      );
      expect(result.isNew).toBe(true);
    });

    it("should return existing payment for duplicate ingestion (idempotency)", async () => {
      const existingPayment = {
        id: "pay_existing",
        workspaceId: "ws_1",
        provider: "stripe",
        externalId: "pi_abc123",
        grossAmountCents: 35000,
        status: "pending",
      };
      vi.mocked(PaymentRepository.findByExternalId).mockResolvedValue(
        existingPayment as any
      );

      const result = await PaymentIngestionService.ingestFromStripe(
        {
          id: "pi_abc123",
          amount: 35000,
          amount_received: 35000,
          currency: "eur",
          created: 1715644800,
        },
        "ws_1"
      );

      expect(PaymentRepository.create).not.toHaveBeenCalled();
      expect(result.isNew).toBe(false);
      expect(result.payment.id).toBe("pay_existing");
    });

    it("should calculate net amount after Stripe fees", async () => {
      const mockPayment = {
        id: "pay_2",
        grossAmountCents: 35000,
        providerFeeCents: 1050, // 3% fee
        netAmountCents: 33950,
      };
      vi.mocked(PaymentRepository.findByExternalId).mockResolvedValue(null);
      vi.mocked(PaymentRepository.create).mockResolvedValue(mockPayment as any);

      const stripeIntent = {
        id: "pi_withfee",
        amount: 35000,
        amount_received: 35000,
        currency: "eur",
        created: 1715644800,
        application_fee_amount: 1050,
      };

      await PaymentIngestionService.ingestFromStripe(stripeIntent, "ws_1");

      expect(PaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grossAmountCents: 35000,
          providerFeeCents: 1050,
          netAmountCents: 33950,
        })
      );
    });
  });

  describe("ingestFromRevolut", () => {
    it("should normalize Revolut transaction to payment entity", async () => {
      const mockPayment = {
        id: "pay_2",
        grossAmountCents: 50000,
        providerFeeCents: 150,
        netAmountCents: 49850,
      };
      vi.mocked(PaymentRepository.findByExternalId).mockResolvedValue(null);
      vi.mocked(PaymentRepository.create).mockResolvedValue(mockPayment as any);

      const revolutTx = {
        id: "rev_xyz789",
        type: "transfer",
        state: "completed",
        amount: { value: 500.0, currency: "EUR" },
        fee: { value: 1.5, currency: "EUR" },
        reference: "ACME-INV-042",
        counterparty: { name: "ACME Corp", email: "pay@acme.com" },
        created_at: "2024-05-14T10:00:00Z",
      };

      const result = await PaymentIngestionService.ingestFromRevolut(
        revolutTx,
        "ws_1"
      );

      expect(PaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "revolut",
          externalId: "rev_xyz789",
          grossAmountCents: 50000,
          providerFeeCents: 150,
          netAmountCents: 49850,
          payerName: "ACME Corp",
          payerEmail: "pay@acme.com",
          payerReference: "ACME-INV-042",
        })
      );
      expect(result.isNew).toBe(true);
    });

    it("should return existing payment for duplicate Revolut transaction", async () => {
      const existingPayment = {
        id: "pay_rev_existing",
        externalId: "rev_xyz789",
      };
      vi.mocked(PaymentRepository.findByExternalId).mockResolvedValue(
        existingPayment as any
      );

      const revolutTx = {
        id: "rev_xyz789",
        type: "transfer",
        state: "completed",
        amount: { value: 500.0, currency: "EUR" },
        created_at: "2024-05-14T10:00:00Z",
      };

      const result = await PaymentIngestionService.ingestFromRevolut(
        revolutTx,
        "ws_1"
      );

      expect(PaymentRepository.create).not.toHaveBeenCalled();
      expect(result.isNew).toBe(false);
    });
  });

  describe("ingestManual", () => {
    it("should create payment from manual input", async () => {
      const mockPayment = {
        id: "pay_3",
        grossAmountCents: 100000,
        providerFeeCents: 0,
        netAmountCents: 100000,
      };
      vi.mocked(PaymentRepository.create).mockResolvedValue(mockPayment as any);

      const result = await PaymentIngestionService.ingestManual(
        {
          grossAmountCents: 100000,
          currency: "EUR",
          payerName: "John Doe",
          memo: "Bank transfer for INV-043",
          receivedAt: new Date("2024-05-14"),
          provider: "bank_transfer",
        },
        "ws_1"
      );

      expect(PaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "bank_transfer",
          grossAmountCents: 100000,
          providerFeeCents: 0,
          netAmountCents: 100000,
          payerName: "John Doe",
        })
      );
      expect(result.isNew).toBe(true);
    });

    it("should use default currency EUR when not specified", async () => {
      const mockPayment = { id: "pay_4", currency: "EUR" };
      vi.mocked(PaymentRepository.create).mockResolvedValue(mockPayment as any);

      await PaymentIngestionService.ingestManual(
        {
          grossAmountCents: 50000,
          receivedAt: new Date(),
        },
        "ws_1"
      );

      expect(PaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "EUR",
        })
      );
    });

    it("should use default provider bank_transfer when not specified", async () => {
      const mockPayment = { id: "pay_5", provider: "bank_transfer" };
      vi.mocked(PaymentRepository.create).mockResolvedValue(mockPayment as any);

      await PaymentIngestionService.ingestManual(
        {
          grossAmountCents: 50000,
          receivedAt: new Date(),
        },
        "ws_1"
      );

      expect(PaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "bank_transfer",
        })
      );
    });
  });
});
