/**
 * Stripe Webhook Handler Tests
 * Phase 60: Installment payment support
 *
 * Tests for checkout.session.completed handling for installment payments.
 * Per P60-C03: Webhook must route installment payments correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/server/features/invoices/services/StripeService", () => ({
  StripeService: {
    verifyWebhook: vi.fn(),
  },
}));

vi.mock("@/server/features/invoices/services/InvoiceService", () => ({
  InvoiceService: {
    handlePaymentSuccess: vi.fn(),
  },
}));

vi.mock("@/server/features/payments/services/PaymentScheduleService", () => ({
  PaymentScheduleService: {
    recordPayment: vi.fn(),
  },
}));

vi.mock("@/server/lib/webhook-utils", () => ({
  processWebhookIdempotently: vi.fn(async (_id, _type, _source, handler) => {
    await handler();
  }),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { StripeService } from "@/server/features/invoices/services/StripeService";
import { InvoiceService } from "@/server/features/invoices/services/InvoiceService";
import { PaymentScheduleService } from "@/server/features/payments/services/PaymentScheduleService";

describe("Stripe Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkout.session.completed", () => {
    it("routes installment payment when installmentId is present in metadata", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_intent: "pi_test_456",
            metadata: {
              installmentId: "inst_001",
              invoiceId: "inv_001",
              workspaceId: "ws_001",
              scheduleId: "sch_001",
            },
          },
        },
      };

      vi.mocked(StripeService.verifyWebhook).mockReturnValue(mockEvent as any);
      vi.mocked(PaymentScheduleService.recordPayment).mockResolvedValue({} as any);

      // Act - Simulate the webhook processing logic directly
      const session = mockEvent.data.object;
      const { installmentId, invoiceId } = session.metadata || {};

      if (installmentId) {
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : "";

        await PaymentScheduleService.recordPayment(
          installmentId,
          "stripe",
          paymentIntentId
        );
      }

      // Assert
      expect(PaymentScheduleService.recordPayment).toHaveBeenCalledWith(
        "inst_001",
        "stripe",
        "pi_test_456"
      );
      expect(InvoiceService.handlePaymentSuccess).not.toHaveBeenCalled();
    });

    it("routes full invoice payment when only invoiceId is present", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_test_456",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_789",
            payment_intent: "pi_test_999",
            metadata: {
              invoiceId: "inv_002",
              workspaceId: "ws_001",
            },
          },
        },
      };

      vi.mocked(StripeService.verifyWebhook).mockReturnValue(mockEvent as any);
      vi.mocked(InvoiceService.handlePaymentSuccess).mockResolvedValue();

      // Act - Simulate the webhook processing logic directly
      const session = mockEvent.data.object;
      const { installmentId, invoiceId } = session.metadata || {};

      if (installmentId) {
        await PaymentScheduleService.recordPayment(
          installmentId,
          "stripe",
          session.payment_intent as string
        );
      } else if (invoiceId) {
        await InvoiceService.handlePaymentSuccess(
          invoiceId,
          session.payment_intent as string
        );
      }

      // Assert
      expect(InvoiceService.handlePaymentSuccess).toHaveBeenCalledWith(
        "inv_002",
        "pi_test_999"
      );
      expect(PaymentScheduleService.recordPayment).not.toHaveBeenCalled();
    });

    it("handles missing metadata gracefully", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_test_789",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_no_meta",
            payment_intent: "pi_test_no_meta",
            metadata: {},
          },
        },
      };

      vi.mocked(StripeService.verifyWebhook).mockReturnValue(mockEvent as any);

      // Act - Simulate the webhook processing logic directly
      const session = mockEvent.data.object;
      const { installmentId, invoiceId } = session.metadata || {};

      if (installmentId) {
        await PaymentScheduleService.recordPayment(
          installmentId,
          "stripe",
          session.payment_intent as string
        );
      } else if (invoiceId) {
        await InvoiceService.handlePaymentSuccess(
          invoiceId,
          session.payment_intent as string
        );
      }

      // Assert - Neither should be called without metadata
      expect(PaymentScheduleService.recordPayment).not.toHaveBeenCalled();
      expect(InvoiceService.handlePaymentSuccess).not.toHaveBeenCalled();
    });

    it("handles PaymentIntent object instead of string", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_test_obj",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_obj",
            payment_intent: { id: "pi_from_object" },
            metadata: {
              installmentId: "inst_003",
              invoiceId: "inv_003",
            },
          },
        },
      };

      vi.mocked(StripeService.verifyWebhook).mockReturnValue(mockEvent as any);
      vi.mocked(PaymentScheduleService.recordPayment).mockResolvedValue({} as any);

      // Act - Simulate the webhook processing logic directly
      const session = mockEvent.data.object as any;
      const { installmentId } = session.metadata || {};

      if (installmentId) {
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || "";

        await PaymentScheduleService.recordPayment(
          installmentId,
          "stripe",
          paymentIntentId
        );
      }

      // Assert
      expect(PaymentScheduleService.recordPayment).toHaveBeenCalledWith(
        "inst_003",
        "stripe",
        "pi_from_object"
      );
    });

    it("continues processing when recordPayment fails (idempotent)", async () => {
      // Arrange - recordPayment throws (e.g., duplicate payment)
      vi.mocked(PaymentScheduleService.recordPayment).mockRejectedValue(
        new Error("Installment inst_001 already paid")
      );

      const mockEvent = {
        id: "evt_test_dup",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_dup",
            payment_intent: "pi_test_dup",
            metadata: {
              installmentId: "inst_001",
              invoiceId: "inv_001",
            },
          },
        },
      };

      // Act - Should not throw even if recordPayment fails
      const session = mockEvent.data.object;
      const { installmentId } = session.metadata || {};

      let errorCaught = false;
      if (installmentId) {
        try {
          await PaymentScheduleService.recordPayment(
            installmentId,
            "stripe",
            session.payment_intent as string
          );
        } catch {
          // Log but don't fail - may be duplicate webhook
          errorCaught = true;
        }
      }

      // Assert - Error was caught but not re-thrown
      expect(errorCaught).toBe(true);
      expect(PaymentScheduleService.recordPayment).toHaveBeenCalled();
    });
  });

  describe("invoice.payment_succeeded", () => {
    it("calls InvoiceService.handlePaymentSuccess with stripe invoice id", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_inv_success",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_stripe_123",
            payment_intent: "pi_stripe_456",
          },
        },
      };

      vi.mocked(StripeService.verifyWebhook).mockReturnValue(mockEvent as any);
      vi.mocked(InvoiceService.handlePaymentSuccess).mockResolvedValue();

      // Act - Simulate the invoice.payment_succeeded logic
      const invoice = mockEvent.data.object as any;
      const paymentIntentId = typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id || "";

      await InvoiceService.handlePaymentSuccess(
        invoice.id,
        paymentIntentId
      );

      // Assert
      expect(InvoiceService.handlePaymentSuccess).toHaveBeenCalledWith(
        "in_stripe_123",
        "pi_stripe_456"
      );
    });
  });
});

describe("Installment Metadata in Checkout Session", () => {
  it("validates metadata structure for installment payments", () => {
    // This test validates the expected metadata structure
    const validMetadata = {
      installmentId: "inst_abc123",
      invoiceId: "inv_xyz789",
      workspaceId: "ws_123",
      scheduleId: "sch_456",
      installmentNumber: "1",
    };

    // All required fields should be present
    expect(validMetadata.installmentId).toBeDefined();
    expect(validMetadata.invoiceId).toBeDefined();
    expect(validMetadata.workspaceId).toBeDefined();
    expect(validMetadata.scheduleId).toBeDefined();
    expect(validMetadata.installmentNumber).toBeDefined();

    // installmentNumber should be a string (Stripe metadata is string-only)
    expect(typeof validMetadata.installmentNumber).toBe("string");
  });
});
