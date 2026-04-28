/**
 * Tests for proposal signing service.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "mock-signature-id",
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock PDF generation
vi.mock("./pdf", () => ({
  generateContractPdf: vi.fn().mockResolvedValue(Buffer.from("mock-pdf-content")),
  calculateDocumentHash: vi.fn().mockReturnValue("mock-hash-abc123"),
}));

// Mock Dokobit client
const mockDokobitClient = {
  initiateSmartIdSigning: vi.fn(),
  initiateMobileIdSigning: vi.fn(),
  getSigningStatus: vi.fn(),
  downloadSignedDocument: vi.fn(),
};

vi.mock("@/server/lib/dokobit", () => ({
  createDokobitClient: () => mockDokobitClient,
}));

// Mock R2 storage
vi.mock("@/server/lib/r2", () => ({
  putTextToR2: vi.fn().mockResolvedValue({ key: "proposals/proposal-123/signed.pdf", sizeBytes: 1000 }),
}));

// Mock database
const mockSelectResult = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelectResult,
        }),
      }),
    }),
    insert: () => ({
      values: mockInsertValues.mockReturnValue({
        returning: mockReturning,
      }),
    }),
    update: () => ({
      set: mockUpdateSet.mockReturnValue({
        where: () => ({
          returning: mockReturning,
        }),
      }),
    }),
  },
}));

// Mock ProposalService
vi.mock("../services/ProposalService", () => ({
  ProposalService: {
    findById: vi.fn(),
  },
}));

describe("SigningService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      DOKOBIT_ACCESS_TOKEN: "test-token",
      PERSONAL_CODE_SALT: "test-salt-12345",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("initiateProposalSigning", () => {
    const mockProposal = {
      id: "proposal-123",
      prospectId: "prospect-456",
      workspaceId: "workspace-789",
      template: "standard",
      content: {
        hero: { headline: "Test Company", subheadline: "SEO", trafficValue: 1000 },
        currentState: { traffic: 100, keywords: 50, value: 500, chartData: [] },
        opportunities: [],
        roi: { projectedTrafficGain: 500, trafficValue: 2500, defaultConversionRate: 0.02, defaultAov: 100 },
        investment: { setupFee: 2000, monthlyFee: 1000, inclusions: [] },
        nextSteps: [],
      },
      setupFeeCents: 200000,
      monthlyFeeCents: 100000,
      currency: "EUR",
      status: "accepted",
      token: "token-abc",
      brandConfig: null,
      expiresAt: null,
      sentAt: new Date(),
      firstViewedAt: new Date(),
      acceptedAt: new Date(),
      signedAt: null,
      paidAt: null,
      declinedReason: null,
      declinedNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should initiate Smart-ID signing and return session info", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue({
        ...mockProposal,
        views: [],
        signatures: [],
        payments: [],
      } as ReturnType<typeof ProposalService.findById> extends Promise<infer T> ? T : never);

      mockDokobitClient.initiateSmartIdSigning.mockResolvedValue({
        sessionId: "dokobit-session-123",
        verificationCode: "1234",
      });

      mockReturning.mockResolvedValue([{ id: "signature-123" }]);

      const { initiateProposalSigning } = await import("./signing");

      const result = await initiateProposalSigning({
        proposalId: "proposal-123",
        accessToken: "token-abc",
        method: "smart_id",
        personalCode: "38501010001",
        signerName: "Jonas Jonaitis",
      });

      expect(result.sessionId).toBe("dokobit-session-123");
      expect(result.verificationCode).toBe("1234");
      expect(mockDokobitClient.initiateSmartIdSigning).toHaveBeenCalled();
    });

    it("should initiate Mobile-ID signing with phone number", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue({
        ...mockProposal,
        views: [],
        signatures: [],
        payments: [],
      } as ReturnType<typeof ProposalService.findById> extends Promise<infer T> ? T : never);

      mockDokobitClient.initiateMobileIdSigning.mockResolvedValue({
        sessionId: "mobile-session-456",
        verificationCode: "5678",
      });

      mockReturning.mockResolvedValue([{ id: "signature-456" }]);

      const { initiateProposalSigning } = await import("./signing");

      const result = await initiateProposalSigning({
        proposalId: "proposal-123",
        accessToken: "token-abc",
        method: "mobile_id",
        personalCode: "38501010001",
        phoneNumber: "+37060012345",
        signerName: "Jonas Jonaitis",
      });

      expect(result.sessionId).toBe("mobile-session-456");
      expect(result.verificationCode).toBe("5678");
      expect(mockDokobitClient.initiateMobileIdSigning).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+37060012345",
        })
      );
    });

    it("should throw error if proposal not found", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue(null);

      const { initiateProposalSigning } = await import("./signing");

      await expect(
        initiateProposalSigning({
          proposalId: "nonexistent",
          accessToken: "any-token",
          method: "smart_id",
          personalCode: "38501010001",
          signerName: "Test User",
        })
      ).rejects.toThrow(/not found/i);
    });

    it("should throw FORBIDDEN error if access token does not match", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue({
        ...mockProposal,
        views: [],
        signatures: [],
        payments: [],
      } as ReturnType<typeof ProposalService.findById> extends Promise<infer T> ? T : never);

      const { initiateProposalSigning } = await import("./signing");

      await expect(
        initiateProposalSigning({
          proposalId: "proposal-123",
          accessToken: "wrong-token",
          method: "smart_id",
          personalCode: "38501010001",
          signerName: "Test User",
        })
      ).rejects.toThrow(/not authorized/i);
    });

    it("should throw error if proposal not in accepted status", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue({
        ...mockProposal,
        status: "draft",
        views: [],
        signatures: [],
        payments: [],
      } as ReturnType<typeof ProposalService.findById> extends Promise<infer T> ? T : never);

      const { initiateProposalSigning } = await import("./signing");

      await expect(
        initiateProposalSigning({
          proposalId: "proposal-123",
          accessToken: "token-abc",
          method: "smart_id",
          personalCode: "38501010001",
          signerName: "Test User",
        })
      ).rejects.toThrow(/must be accepted/i);
    });

    it("should hash personal code for GDPR compliance", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue({
        ...mockProposal,
        views: [],
        signatures: [],
        payments: [],
      } as ReturnType<typeof ProposalService.findById> extends Promise<infer T> ? T : never);

      mockDokobitClient.initiateSmartIdSigning.mockResolvedValue({
        sessionId: "session-789",
        verificationCode: "9012",
      });

      mockReturning.mockResolvedValue([{ id: "signature-789" }]);

      const { initiateProposalSigning } = await import("./signing");

      await initiateProposalSigning({
        proposalId: "proposal-123",
        accessToken: "token-abc",
        method: "smart_id",
        personalCode: "38501010001",
        signerName: "Test User",
      });

      // Verify insert was called with hashed personal code
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          signerPersonalCodeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        })
      );

      // Verify raw personal code was NOT stored
      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.signerPersonalCodeHash).not.toContain("38501010001");
    });

    it("should store signature record in database", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue({
        ...mockProposal,
        views: [],
        signatures: [],
        payments: [],
      } as ReturnType<typeof ProposalService.findById> extends Promise<infer T> ? T : never);

      mockDokobitClient.initiateSmartIdSigning.mockResolvedValue({
        sessionId: "session-store-test",
        verificationCode: "1111",
      });

      mockReturning.mockResolvedValue([{ id: "signature-store" }]);

      const { initiateProposalSigning } = await import("./signing");

      await initiateProposalSigning({
        proposalId: "proposal-123",
        accessToken: "token-abc",
        method: "smart_id",
        personalCode: "38501010001",
        signerName: "Jonas Jonaitis",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: "proposal-123",
          signerName: "Jonas Jonaitis",
          signingMethod: "smart_id",
          dokobitSessionId: "session-store-test",
        })
      );
    });
  });

  describe("checkSigningStatus", () => {
    it("should return pending status while signing in progress", async () => {
      mockDokobitClient.getSigningStatus.mockResolvedValue({
        status: "pending",
      });

      const { checkSigningStatus } = await import("./signing");

      const result = await checkSigningStatus("proposal-123", "session-123");

      expect(result.status).toBe("pending");
      expect(result.signedDocumentUrl).toBeUndefined();
    });

    it("should handle completed status and upload signed PDF", async () => {
      mockDokobitClient.getSigningStatus.mockResolvedValue({
        status: "completed",
        signedDocumentUrl: "https://dokobit.com/signed.pdf",
      });

      mockDokobitClient.downloadSignedDocument.mockResolvedValue(
        Buffer.from("signed-pdf-content")
      );

      mockReturning.mockResolvedValue([{ id: "updated" }]);

      const { checkSigningStatus } = await import("./signing");

      const result = await checkSigningStatus("proposal-123", "session-123");

      expect(result.status).toBe("completed");
      expect(mockDokobitClient.downloadSignedDocument).toHaveBeenCalledWith("session-123");
    });

    it("should return failed status with error message", async () => {
      mockDokobitClient.getSigningStatus.mockResolvedValue({
        status: "failed",
        error: "User cancelled",
      });

      const { checkSigningStatus } = await import("./signing");

      const result = await checkSigningStatus("proposal-123", "session-123");

      expect(result.status).toBe("failed");
      expect(result.error).toBe("User cancelled");
    });

    it("should return expired status", async () => {
      mockDokobitClient.getSigningStatus.mockResolvedValue({
        status: "expired",
      });

      const { checkSigningStatus } = await import("./signing");

      const result = await checkSigningStatus("proposal-123", "session-123");

      expect(result.status).toBe("expired");
    });
  });

  describe("hashPersonalCode", () => {
    it("should produce consistent hash for same input and salt", async () => {
      const { hashPersonalCode } = await import("./signing");

      const hash1 = hashPersonalCode("38501010001");
      const hash2 = hashPersonalCode("38501010001");

      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different personal codes", async () => {
      const { hashPersonalCode } = await import("./signing");

      const hash1 = hashPersonalCode("38501010001");
      const hash2 = hashPersonalCode("38501010002");

      expect(hash1).not.toBe(hash2);
    });

    it("should return 64 character hex string", async () => {
      const { hashPersonalCode } = await import("./signing");

      const hash = hashPersonalCode("38501010001");

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("validatePersonalCode", () => {
    it("should accept valid Lithuanian personal code", async () => {
      const { validatePersonalCode } = await import("./signing");

      expect(validatePersonalCode("38501010001")).toBe(true);
      expect(validatePersonalCode("49001010001")).toBe(true);
    });

    it("should reject invalid personal codes", async () => {
      const { validatePersonalCode } = await import("./signing");

      expect(validatePersonalCode("123")).toBe(false); // Too short
      expect(validatePersonalCode("123456789012")).toBe(false); // Too long
      expect(validatePersonalCode("abcdefghijk")).toBe(false); // Non-numeric
      expect(validatePersonalCode("")).toBe(false); // Empty
    });
  });
});
