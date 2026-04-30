import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InvoiceSelect } from "@/db/invoice-schema";
import type { ContractSelect } from "@/db/contract-schema";

// Mock database queries
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSet = vi.fn();

// Mock repositories
const mockInsertInvoice = vi.fn();
const mockGetInvoiceById = vi.fn();
const mockGetInvoiceByStripeId = vi.fn();
const mockUpdateInvoiceStatus = vi.fn();
const mockInsertActivity = vi.fn();
const mockRecordStatusChange = vi.fn();

// Mock StripeService
const mockCreateInvoice = vi.fn();
const mockGetOrCreateCustomer = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: mockDbFrom,
    }),
    update: mockDbUpdate,
  },
}));

vi.mock("../repositories/InvoiceRepository", () => ({
  InvoiceRepository: {
    insertInvoice: mockInsertInvoice,
    getInvoiceById: mockGetInvoiceById,
    getInvoiceByStripeId: mockGetInvoiceByStripeId,
    updateInvoiceStatus: mockUpdateInvoiceStatus,
  },
}));

vi.mock("../../contracts/repositories/ActivityRepository", () => ({
  ActivityRepository: {
    insertActivity: mockInsertActivity,
    recordStatusChange: mockRecordStatusChange,
  },
}));

vi.mock("./StripeService", () => ({
  StripeService: {
    createInvoice: mockCreateInvoice,
    getOrCreateCustomer: mockGetOrCreateCustomer,
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("InvoiceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain for db queries
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockReturnValue({ limit: mockDbLimit });
    mockDbLimit.mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockDbSet });
    mockDbSet.mockReturnValue({ where: mockDbWhere });
  });

  describe("createFromContract", () => {
    it("should create invoice with status draft from signed contract", async () => {
      const mockContract: Partial<ContractSelect> = {
        id: "contract_123",
        workspaceId: "workspace_123",
        clientId: "client_uuid",
        proposalId: "proposal_123",
        status: "signed",
      };

      const mockProposal = {
        id: "proposal_123",
        setupFeeCents: 250000,
        monthlyFeeCents: 150000,
        currency: "EUR",
      };

      const mockInvoice: Partial<InvoiceSelect> = {
        id: "invoice_123",
        workspaceId: "workspace_123",
        clientId: "client_uuid",
        contractId: "contract_123",
        status: "draft",
        totalCents: 400000,
      };

      // First call returns contract, second returns proposal
      mockDbLimit.mockResolvedValueOnce([mockContract]);
      mockDbLimit.mockResolvedValueOnce([mockProposal]);
      mockInsertInvoice.mockResolvedValue(mockInvoice);
      mockInsertActivity.mockResolvedValue({});

      const { InvoiceService } = await import("./InvoiceService.js");
      const result = await InvoiceService.createFromContract("contract_123", "workspace_123");

      expect(result.status).toBe("draft");
      expect(mockInsertInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "draft",
          workspaceId: "workspace_123",
          contractId: "contract_123",
        })
      );
      expect(mockInsertActivity).toHaveBeenCalled();
    });

    it("should throw CONFLICT if contract is not signed", async () => {
      const mockContract: Partial<ContractSelect> = {
        id: "contract_draft",
        workspaceId: "workspace_123",
        status: "draft",
      };

      mockDbLimit.mockResolvedValue([mockContract]);

      const { InvoiceService } = await import("./InvoiceService.js");
      await expect(
        InvoiceService.createFromContract("contract_draft", "workspace_123")
      ).rejects.toThrow("Cannot create invoice for contract in draft status");
    });

    it("should calculate correct line items from proposal fees", async () => {
      const mockContract: Partial<ContractSelect> = {
        id: "contract_123",
        workspaceId: "workspace_123",
        clientId: "client_uuid",
        proposalId: "proposal_123",
        status: "signed",
      };

      const mockProposal = {
        id: "proposal_123",
        setupFeeCents: 300000,
        monthlyFeeCents: 200000,
        currency: "EUR",
      };

      mockDbLimit.mockResolvedValueOnce([mockContract]);
      mockDbLimit.mockResolvedValueOnce([mockProposal]);
      mockInsertInvoice.mockResolvedValue({});
      mockInsertActivity.mockResolvedValue({});

      const { InvoiceService } = await import("./InvoiceService.js");
      await InvoiceService.createFromContract("contract_123", "workspace_123");

      expect(mockInsertInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotalCents: 500000,
          totalCents: 500000,
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining("Setup"),
              totalCents: 300000,
            }),
            expect.objectContaining({
              description: expect.stringContaining("Monthly"),
              totalCents: 200000,
            }),
          ]),
        })
      );
    });
  });

  describe("sendToClient", () => {
    it("should call StripeService.createInvoice and update status to sent", async () => {
      const mockInvoice: Partial<InvoiceSelect> = {
        id: "invoice_123",
        workspaceId: "workspace_123",
        clientId: "client_uuid",
        contractId: "contract_123",
        status: "draft",
        lineItems: [
          { id: "li_1", description: "SEO Setup Fee", quantity: 1, unitPriceCents: 250000, totalCents: 250000 },
          { id: "li_2", description: "SEO Monthly Service", quantity: 1, unitPriceCents: 150000, totalCents: 150000 },
        ],
        currency: "EUR",
      };

      mockGetInvoiceById.mockResolvedValue(mockInvoice);
      mockGetOrCreateCustomer.mockResolvedValue("cus_123");
      mockCreateInvoice.mockResolvedValue({
        stripeInvoiceId: "in_stripe_123",
        stripePaymentUrl: "https://invoice.stripe.com/i/abc",
        totalCents: 400000,
      });
      mockUpdateInvoiceStatus.mockResolvedValue({ ...mockInvoice, status: "sent" });
      mockRecordStatusChange.mockResolvedValue({});

      const { InvoiceService } = await import("./InvoiceService.js");
      const result = await InvoiceService.sendToClient("invoice_123", "client@example.com", "Client Name");

      expect(mockGetOrCreateCustomer).toHaveBeenCalledWith("client@example.com", "Client Name", "client_uuid");
      expect(mockCreateInvoice).toHaveBeenCalled();
      expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith(
        "invoice_123",
        "sent",
        expect.objectContaining({
          stripeInvoiceId: "in_stripe_123",
          stripePaymentUrl: "https://invoice.stripe.com/i/abc",
        })
      );
    });

    it("should throw CONFLICT if invoice is not in draft status", async () => {
      const mockInvoice: Partial<InvoiceSelect> = {
        id: "invoice_sent",
        status: "sent",
      };

      mockGetInvoiceById.mockResolvedValue(mockInvoice);

      const { InvoiceService } = await import("./InvoiceService.js");
      await expect(
        InvoiceService.sendToClient("invoice_sent", "client@example.com", "Client Name")
      ).rejects.toThrow("Cannot send invoice in sent status");
    });
  });

  describe("handlePaymentSuccess", () => {
    it("should update invoice status to paid and contract status to executed", async () => {
      const mockInvoice: Partial<InvoiceSelect> = {
        id: "invoice_123",
        workspaceId: "workspace_123",
        contractId: "contract_123",
        status: "sent",
      };

      mockGetInvoiceByStripeId.mockResolvedValue(mockInvoice);
      mockUpdateInvoiceStatus.mockResolvedValue({});
      mockDbWhere.mockResolvedValue({});
      mockRecordStatusChange.mockResolvedValue({});

      const { InvoiceService } = await import("./InvoiceService.js");
      await InvoiceService.handlePaymentSuccess("in_stripe_123", "pi_123");

      expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith(
        "invoice_123",
        "paid",
        expect.objectContaining({
          stripePaymentIntentId: "pi_123",
        })
      );
      expect(mockRecordStatusChange).toHaveBeenCalledWith(
        "workspace_123",
        "contract",
        "contract_123",
        "signed",
        "executed"
      );
      expect(mockRecordStatusChange).toHaveBeenCalledWith(
        "workspace_123",
        "invoice",
        "invoice_123",
        "sent",
        "paid"
      );
    });

    it("should be idempotent - skip if already paid", async () => {
      const mockInvoice: Partial<InvoiceSelect> = {
        id: "invoice_paid",
        status: "paid",
      };

      mockGetInvoiceByStripeId.mockResolvedValue(mockInvoice);

      const { InvoiceService } = await import("./InvoiceService.js");
      await InvoiceService.handlePaymentSuccess("in_stripe_paid", "pi_123");

      expect(mockUpdateInvoiceStatus).not.toHaveBeenCalled();
    });

    it("should handle missing invoice gracefully", async () => {
      mockGetInvoiceByStripeId.mockResolvedValue(undefined);

      const { InvoiceService } = await import("./InvoiceService.js");
      await InvoiceService.handlePaymentSuccess("in_stripe_unknown", "pi_123");

      expect(mockUpdateInvoiceStatus).not.toHaveBeenCalled();
    });
  });
});
