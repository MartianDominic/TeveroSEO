/**
 * Tests for PortalTokenService
 * Phase 87-01: Client Portal Foundation
 *
 * TDD tests for token generation, validation, revocation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to create mocks that survive hoisting
const mocks = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnThis();
  const mockValues = vi.fn().mockReturnThis();
  const mockReturning = vi.fn().mockResolvedValue([{ id: "token-id" }]);
  const mockUpdate = vi.fn().mockReturnThis();
  const mockSet = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockReturnThis();
  const mockFindFirst = vi.fn();
  const mockFindMany = vi.fn();

  return {
    mockInsert,
    mockValues,
    mockReturning,
    mockUpdate,
    mockSet,
    mockWhere,
    mockFindFirst,
    mockFindMany,
    mockDb: {
      insert: mockInsert,
      values: mockValues,
      returning: mockReturning,
      update: mockUpdate,
      set: mockSet,
      where: mockWhere,
      query: {
        portalTokens: {
          findFirst: mockFindFirst,
          findMany: mockFindMany,
        },
      },
    },
  };
});

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "abc123xyz789"),
}));

// Mock db using hoisted mocks
vi.mock("@/db", () => ({
  db: mocks.mockDb,
  portalTokens: { id: "id", token: "token", clientId: "client_id" },
}));

// Import after mocks
import {
  PortalTokenService,
  createPortalTokenService,
} from "./PortalTokenService";

describe("PortalTokenService", () => {
  let service: PortalTokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain methods
    mocks.mockInsert.mockReturnThis();
    mocks.mockValues.mockReturnThis();
    mocks.mockUpdate.mockReturnThis();
    mocks.mockSet.mockReturnThis();
    mocks.mockWhere.mockReturnThis();
    mocks.mockReturning.mockResolvedValue([{ id: "token-id" }]);

    service = createPortalTokenService(mocks.mockDb as any);
  });

  describe("generateToken", () => {
    it("should generate a 12-character token", async () => {
      const token = await service.generateToken({ clientId: "client-123" });
      expect(token).toBe("abc123xyz789");
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it("should use default auth level token_only", async () => {
      await service.generateToken({ clientId: "client-123" });
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          authLevel: "token_only",
        })
      );
    });

    it("should use provided auth level", async () => {
      await service.generateToken({
        clientId: "client-123",
        authLevel: "email_verify",
      });
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          authLevel: "email_verify",
        })
      );
    });

    it("should default to 30 day expiry", async () => {
      const now = new Date("2026-05-05T12:00:00Z");
      vi.setSystemTime(now);

      await service.generateToken({ clientId: "client-123" });

      const calledWith = mocks.mockValues.mock.calls[0][0];
      const expiresAt = new Date(calledWith.expiresAt);
      const expectedExpiry = new Date(now);
      expectedExpiry.setDate(expectedExpiry.getDate() + 30);

      expect(expiresAt.getDate()).toBe(expectedExpiry.getDate());
      vi.useRealTimers();
    });

    it("should use custom expiry days", async () => {
      const now = new Date("2026-05-05T12:00:00Z");
      vi.setSystemTime(now);

      await service.generateToken({
        clientId: "client-123",
        expiresInDays: 7,
      });

      const calledWith = mocks.mockValues.mock.calls[0][0];
      const expiresAt = new Date(calledWith.expiresAt);
      const expectedExpiry = new Date(now);
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);

      expect(expiresAt.getDate()).toBe(expectedExpiry.getDate());
      vi.useRealTimers();
    });
  });

  describe("validateToken", () => {
    it("should return not_found for missing token", async () => {
      mocks.mockFindFirst.mockResolvedValue(null);

      const result = await service.validateToken("nonexistent");

      expect(result).toEqual({ valid: false, error: "not_found" });
    });

    it("should return revoked for revoked token", async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: "token-id",
        clientId: "client-123",
        authLevel: "token_only",
        isRevoked: true,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.validateToken("revoked-token");

      expect(result).toEqual({ valid: false, error: "revoked" });
    });

    it("should return expired for expired token", async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: "token-id",
        clientId: "client-123",
        authLevel: "token_only",
        isRevoked: false,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      const result = await service.validateToken("expired-token");

      expect(result).toEqual({ valid: false, error: "expired" });
    });

    it("should return valid result for valid token", async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: "token-id",
        clientId: "client-123",
        authLevel: "email_verify",
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        accessCount: 5,
      });

      const result = await service.validateToken("valid-token");

      expect(result).toEqual({
        valid: true,
        clientId: "client-123",
        authLevel: "email_verify",
      });
    });

    it("should update access tracking on valid token", async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: "token-id",
        clientId: "client-123",
        authLevel: "token_only",
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        accessCount: 5,
      });

      await service.validateToken("valid-token");

      expect(mocks.mockUpdate).toHaveBeenCalled();
      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          accessCount: 6,
        })
      );
    });
  });

  describe("revokeToken", () => {
    it("should revoke token and return true", async () => {
      mocks.mockReturning.mockResolvedValue([{ id: "token-id" }]);

      const result = await service.revokeToken("token-to-revoke");

      expect(result).toBe(true);
      expect(mocks.mockUpdate).toHaveBeenCalled();
      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isRevoked: true,
        })
      );
    });

    it("should return false when token not found", async () => {
      mocks.mockReturning.mockResolvedValue([]);

      const result = await service.revokeToken("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("listClientTokens", () => {
    it("should return all tokens for client", async () => {
      const mockTokens = [
        { id: "1", token: "token1", clientId: "client-123" },
        { id: "2", token: "token2", clientId: "client-123" },
      ];
      mocks.mockFindMany.mockResolvedValue(mockTokens);

      const result = await service.listClientTokens("client-123");

      expect(result).toEqual(mockTokens);
    });
  });

  describe("createPortalTokenService factory", () => {
    it("should create service instance", () => {
      const service = createPortalTokenService(mocks.mockDb as any);
      expect(service).toBeInstanceOf(PortalTokenService);
    });
  });
});
