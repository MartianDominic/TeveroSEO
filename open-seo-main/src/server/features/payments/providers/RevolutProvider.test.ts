/**
 * RevolutProvider Unit Tests
 * Phase 54-02: RevolutProvider Implementation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RevolutProvider } from "./RevolutProvider";
import type { InvoiceSelect } from "@/db/invoice-schema";
import {
  PaymentSessionError,
  WebhookVerificationError,
} from "../types";
import crypto from "crypto";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock runtime-env
vi.mock("@/server/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn(() => "https://app.tevero.lt"),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("RevolutProvider", () => {
  const mockCredentials = {
    revolutApiKey: "sk_sandbox_test_key_12345",
    revolutWebhookSecret: "whsec_test_secret_67890",
  };

  const mockInvoice: InvoiceSelect = {
    id: "inv_123",
    workspaceId: "ws_456",
    contractId: "con_789",
    clientId: "cli_101",
    invoiceNumber: "INV-2026-001",
    status: "pending",
    totalCents: 250000,
    currency: "EUR",
    lineItems: [
      {
        description: "SEO Services",
        quantity: 1,
        unitPriceCents: 250000,
        totalCents: 250000,
      },
    ],
    dueDate: new Date("2026-05-15"),
    createdAt: new Date(),
    updatedAt: new Date(),
    issuedAt: null,
    paidAt: null,
    paymentProvider: null,
    externalPaymentId: null,
  };

  const mockRevolutOrder = {
    id: "ord_abc123",
    token: "tok_xyz789",
    type: "payment",
    state: "pending",
    checkout_url: "https://checkout.revolut.com/pay/abc123",
    amount: 250000,
    currency: "EUR",
    description: "Invoice INV-2026-001",
    capture_mode: "automatic",
    metadata: {
      invoice_id: "inv_123",
      workspace_id: "ws_456",
      contract_id: "con_789",
    },
    created_at: "2026-04-30T12:00:00Z",
    updated_at: "2026-04-30T12:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with valid credentials", () => {
      const provider = new RevolutProvider(mockCredentials);
      expect(provider.providerType).toBe("revolut");
    });

    it("should throw if API key is missing", () => {
      expect(() => new RevolutProvider({})).toThrow("Revolut API key is required");
    });

    it("should detect sandbox mode from key prefix", () => {
      const sandboxProvider = new RevolutProvider({
        revolutApiKey: "sk_sandbox_test",
      });
      expect(sandboxProvider.providerType).toBe("revolut");

      const prodProvider = new RevolutProvider({
        revolutApiKey: "sk_live_test",
      });
      expect(prodProvider.providerType).toBe("revolut");
    });
  });

  describe("createPaymentSession", () => {
    it("should create payment session successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockRevolutOrder)),
      });

      const provider = new RevolutProvider(mockCredentials);
      const session = await provider.createPaymentSession(mockInvoice);

      expect(session).toEqual({
        provider: "revolut",
        externalId: "ord_abc123",
        paymentUrl: "https://checkout.revolut.com/pay/abc123",
        token: "tok_xyz789",
        rawResponse: mockRevolutOrder,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://sandbox-merchant.revolut.com/api/orders",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_sandbox_test_key_12345",
            "Revolut-Api-Version": "2024-09-01",
          }),
        })
      );
    });

    it("should throw PaymentSessionError on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve(JSON.stringify({ code: 400, message: "Invalid request" })),
      });

      const provider = new RevolutProvider(mockCredentials);

      await expect(provider.createPaymentSession(mockInvoice)).rejects.toThrow(
        PaymentSessionError
      );
    });

    it("should include contract_id in metadata when present", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockRevolutOrder)),
      });

      const provider = new RevolutProvider(mockCredentials);
      await provider.createPaymentSession(mockInvoice);

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(calledBody.metadata.contract_id).toBe("con_789");
    });
  });

  describe("verifyWebhook", () => {
    const webhookPayload = JSON.stringify({
      event: "ORDER_COMPLETED",
      order_id: "ord_abc123",
    });

    function createValidSignature(
      payload: string,
      secret: string,
      timestamp: string
    ): string {
      const payloadToSign = `v1.${timestamp}.${payload}`;
      return crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");
    }

    it("should verify valid webhook signature", () => {
      const timestamp = "1714500000";
      const signature = createValidSignature(
        webhookPayload,
        mockCredentials.revolutWebhookSecret!,
        timestamp
      );

      const headers = new Headers({
        "Revolut-Signature": `v1=${signature}`,
        "Revolut-Request-Timestamp": timestamp,
      });

      const provider = new RevolutProvider(mockCredentials);
      const event = provider.verifyWebhook(Buffer.from(webhookPayload), headers);

      expect(event).toEqual({
        type: "ORDER_COMPLETED",
        orderId: "ord_abc123",
        invoiceId: undefined,
        data: { event: "ORDER_COMPLETED", order_id: "ord_abc123" },
        rawEvent: { event: "ORDER_COMPLETED", order_id: "ord_abc123" },
      });
    });

    it("should throw if webhook secret not configured", () => {
      const provider = new RevolutProvider({
        revolutApiKey: "sk_sandbox_test",
      });
      const headers = new Headers();

      expect(() =>
        provider.verifyWebhook(Buffer.from(webhookPayload), headers)
      ).toThrow(WebhookVerificationError);
    });

    it("should throw if signature header missing", () => {
      const headers = new Headers({
        "Revolut-Request-Timestamp": "1714500000",
      });

      const provider = new RevolutProvider(mockCredentials);

      expect(() =>
        provider.verifyWebhook(Buffer.from(webhookPayload), headers)
      ).toThrow("Missing Revolut-Signature header");
    });

    it("should throw if timestamp header missing", () => {
      const headers = new Headers({
        "Revolut-Signature": "v1=abc123",
      });

      const provider = new RevolutProvider(mockCredentials);

      expect(() =>
        provider.verifyWebhook(Buffer.from(webhookPayload), headers)
      ).toThrow("Missing Revolut-Request-Timestamp header");
    });

    it("should throw if signature is invalid", () => {
      const headers = new Headers({
        "Revolut-Signature": "v1=invalid_signature_here",
        "Revolut-Request-Timestamp": "1714500000",
      });

      const provider = new RevolutProvider(mockCredentials);

      expect(() =>
        provider.verifyWebhook(Buffer.from(webhookPayload), headers)
      ).toThrow("Invalid webhook signature");
    });
  });

  describe("getPaymentStatus", () => {
    it("should return pending status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              ...mockRevolutOrder,
              state: "pending",
            })
          ),
      });

      const provider = new RevolutProvider(mockCredentials);
      const status = await provider.getPaymentStatus("ord_abc123");

      expect(status.status).toBe("pending");
    });

    it("should return paid status for completed orders", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              ...mockRevolutOrder,
              state: "completed",
              payments: [
                {
                  id: "pay_001",
                  state: "captured",
                  amount: 250000,
                  currency: "EUR",
                  created_at: "2026-04-30T12:00:00Z",
                  updated_at: "2026-04-30T12:05:00Z",
                },
              ],
            })
          ),
      });

      const provider = new RevolutProvider(mockCredentials);
      const status = await provider.getPaymentStatus("ord_abc123");

      expect(status.status).toBe("paid");
      expect(status.amountPaidCents).toBe(250000);
      expect(status.currency).toBe("EUR");
      expect(status.paidAt).toBeInstanceOf(Date);
    });

    it("should return cancelled status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              ...mockRevolutOrder,
              state: "cancelled",
            })
          ),
      });

      const provider = new RevolutProvider(mockCredentials);
      const status = await provider.getPaymentStatus("ord_abc123");

      expect(status.status).toBe("cancelled");
    });

    it("should return failed status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              ...mockRevolutOrder,
              state: "failed",
            })
          ),
      });

      const provider = new RevolutProvider(mockCredentials);
      const status = await provider.getPaymentStatus("ord_abc123");

      expect(status.status).toBe("failed");
    });

    it("should return processing status for authorised orders", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              ...mockRevolutOrder,
              state: "authorised",
            })
          ),
      });

      const provider = new RevolutProvider(mockCredentials);
      const status = await provider.getPaymentStatus("ord_abc123");

      expect(status.status).toBe("processing");
    });
  });
});

describe("revolut-client", () => {
  describe("rate limiting", () => {
    it("should throw RevolutRateLimitError on 429", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "60" }),
        text: () => Promise.resolve(""),
      });

      const { createRevolutClient } = await import("./revolut-client");
      const client = createRevolutClient({
        secretKey: "sk_sandbox_test",
        sandbox: true,
      });

      const { RevolutRateLimitError } = await import("./revolut-client");
      await expect(client.getOrder("ord_123")).rejects.toBeInstanceOf(
        RevolutRateLimitError
      );
    });
  });
});
