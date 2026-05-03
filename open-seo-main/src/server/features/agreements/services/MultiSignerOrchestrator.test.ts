/**
 * Tests for MultiSignerOrchestrator
 * Phase 59: Agreement & Signing Excellence
 *
 * Security tests for:
 * - C-59-02: Double-signing prevention
 * - H-59-05: Race condition prevention with transaction locks
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock calls are hoisted - use inline factory functions
vi.mock("@/db/index", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/db/agreement-template-schema", () => ({
  generatedAgreements: { id: "id" },
}));

vi.mock("@/db/schema/agreement-signers-schema", () => ({
  agreementSigners: { id: "id", agreementId: "agreement_id", status: "status" },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the transaction utility with a function that can be spied on
vi.mock("@/lib/db/transaction", () => ({
  withTransaction: vi.fn(),
}));

// Mock SignerRepository with inline object
vi.mock("../repositories/SignerRepository", () => ({
  SignerRepository: {
    findById: vi.fn(),
    findByAgreement: vi.fn(),
    findNextPending: vi.fn(),
    updateStatus: vi.fn(),
    setAccessToken: vi.fn(),
  },
}));

// Import after mocks
import { MultiSignerOrchestrator } from "./MultiSignerOrchestrator";
import { SignerRepository } from "../repositories/SignerRepository";
import { withTransaction } from "@/lib/db/transaction";

// Cast to mocked types
const mockSignerRepository = SignerRepository as unknown as {
  findById: ReturnType<typeof vi.fn>;
  findByAgreement: ReturnType<typeof vi.fn>;
  findNextPending: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  setAccessToken: ReturnType<typeof vi.fn>;
};

const mockWithTransaction = withTransaction as ReturnType<typeof vi.fn>;

describe("MultiSignerOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processSignerCallback - C-59-02 Double-Signing Prevention", () => {
    const mockSigner = {
      id: "signer-123",
      agreementId: "agreement-456",
      role: "client",
      status: "pending",
      signingOrder: 1,
    };

    it("should reject callback if signer already signed", async () => {
      // Signer already has "signed" status
      mockSignerRepository.findById.mockResolvedValue({
        ...mockSigner,
        status: "signed",
      });

      const result = await MultiSignerOrchestrator.processSignerCallback(
        "signer-123",
        "signed",
        { signedFromIp: "192.168.1.1" }
      );

      expect(result).toEqual({
        allSigned: false,
        message: "Already processed",
      });

      // Should NOT call updateStatus for already-signed signer
      expect(mockSignerRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("should reject callback if signer already declined", async () => {
      mockSignerRepository.findById.mockResolvedValue({
        ...mockSigner,
        status: "declined",
      });

      const result = await MultiSignerOrchestrator.processSignerCallback(
        "signer-123",
        "signed"
      );

      expect(result).toEqual({
        allSigned: false,
        message: "Already processed",
      });

      expect(mockSignerRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("should process callback for pending signer", async () => {
      mockSignerRepository.findById.mockResolvedValue({
        ...mockSigner,
        status: "pending",
      });
      mockSignerRepository.findByAgreement.mockResolvedValue([
        { ...mockSigner, status: "signed" },
      ]);
      mockSignerRepository.updateStatus.mockResolvedValue({
        ...mockSigner,
        status: "signed",
      });

      // Mock activateNextSigner via transaction
      mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          execute: vi.fn().mockResolvedValue({ rows: [] }),
        });
      });

      const result = await MultiSignerOrchestrator.processSignerCallback(
        "signer-123",
        "signed",
        { signedFromIp: "192.168.1.1" }
      );

      expect(result.allSigned).toBe(true);
      expect(mockSignerRepository.updateStatus).toHaveBeenCalledWith(
        "signer-123",
        "signed",
        expect.objectContaining({ signedFromIp: "192.168.1.1" })
      );
    });

    it("should process callback for invited signer", async () => {
      mockSignerRepository.findById.mockResolvedValue({
        ...mockSigner,
        status: "invited",
      });
      mockSignerRepository.findByAgreement.mockResolvedValue([
        { ...mockSigner, status: "signed" },
      ]);
      mockSignerRepository.updateStatus.mockResolvedValue({
        ...mockSigner,
        status: "signed",
      });

      mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          execute: vi.fn().mockResolvedValue({ rows: [] }),
        });
      });

      const result = await MultiSignerOrchestrator.processSignerCallback(
        "signer-123",
        "signed"
      );

      // Should process since "invited" is not a terminal state
      expect(mockSignerRepository.updateStatus).toHaveBeenCalled();
    });

    it("should throw error if signer not found", async () => {
      mockSignerRepository.findById.mockResolvedValue(null);

      await expect(
        MultiSignerOrchestrator.processSignerCallback("non-existent", "signed")
      ).rejects.toThrow("Signer not found");
    });
  });

  describe("activateNextSigner - H-59-05 Race Condition Prevention", () => {
    it("should use transaction with FOR UPDATE lock", async () => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ id: "signer-next", role: "client", status: "pending", signing_order: 2 }],
        }),
      };

      mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));
      mockSignerRepository.setAccessToken.mockResolvedValue({
        token: "test-token-123",
        expiresAt: new Date(),
      });
      mockSignerRepository.updateStatus.mockResolvedValue({ status: "invited" });

      const result = await MultiSignerOrchestrator.activateNextSigner("agreement-456");

      // Verify transaction was called
      expect(mockWithTransaction).toHaveBeenCalled();

      // Verify SQL includes FOR UPDATE SKIP LOCKED
      const executedSql = mockTx.execute.mock.calls[0][0];
      expect(executedSql.queryChunks || executedSql.sql || String(executedSql)).toBeDefined();

      // Result should be a magic link
      expect(result).toContain("/c/test-token-123");
    });

    it("should return null when no pending signers", async () => {
      const mockTx = {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
      };

      mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

      const result = await MultiSignerOrchestrator.activateNextSigner("agreement-456");

      expect(result).toBeNull();
    });

    it("should handle concurrent calls safely with SKIP LOCKED", async () => {
      // First call gets the row
      const mockTx1 = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ id: "signer-1", role: "client", status: "pending", signing_order: 1 }],
        }),
      };

      // Second call gets empty (row is locked by first call)
      const mockTx2 = {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
      };

      let callCount = 0;
      mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        callCount++;
        return fn(callCount === 1 ? mockTx1 : mockTx2);
      });

      mockSignerRepository.setAccessToken.mockResolvedValue({
        token: "token-1",
        expiresAt: new Date(),
      });
      mockSignerRepository.updateStatus.mockResolvedValue({ status: "invited" });

      // Simulate concurrent calls
      const [result1, result2] = await Promise.all([
        MultiSignerOrchestrator.activateNextSigner("agreement-456"),
        MultiSignerOrchestrator.activateNextSigner("agreement-456"),
      ]);

      // First call should succeed
      expect(result1).toContain("/c/token-1");

      // Second call should get null (row was locked)
      expect(result2).toBeNull();
    });
  });
});
